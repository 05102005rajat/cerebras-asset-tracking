import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Asset,
  DeployScanInput,
  ReceiveScanInput,
  StoreScanInput,
  TransferScanInput,
} from "@/lib/types";

// We mock the api-client at the module level so the orchestration logic in
// scan-server is exercised in isolation. Each test inspects exactly which
// downstream writes fired (and in what order) without touching the network.
//
// vi.hoisted() makes these stubs available inside the vi.mock() factory,
// which Vitest runs before any imports.
const mocks = vi.hoisted(() => ({
  scansReceive: vi.fn(),
  scansStore: vi.fn(),
  scansDeploy: vi.fn(),
  scansTransfer: vi.fn(),
  updateFacilities: vi.fn(),
  updateFinance: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public details?: Record<string, unknown>,
    ) {
      super(message);
    }
  },
  api: {
    scans: {
      receive: mocks.scansReceive,
      store: mocks.scansStore,
      deploy: mocks.scansDeploy,
      transfer: mocks.scansTransfer,
    },
    mock: {
      updateFacilities: mocks.updateFacilities,
      updateFinance: mocks.updateFinance,
    },
  },
}));

const {
  scansReceive,
  scansStore,
  scansDeploy,
  scansTransfer,
  updateFacilities,
  updateFinance,
} = mocks;

import {
  performDeploy,
  performReceive,
  performStore,
  performTransfer,
} from "@/lib/scan-server";

const FIXTURE: Asset = {
  asset_tag: "C0009001",
  serial: "SN-T",
  model: "Test Model",
  manufacturer: "TestCo",
  asset_class: "instrument",
  state: "received",
  location: {
    site: "Lab-Building-A",
    room: "Bay-1",
    row: null,
    rack: "B-04",
    ru: "P-02",
  },
  custodian: "tech-jane",
  parent_asset_tag: null,
  procurement_note: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  scansReceive.mockReset();
  scansStore.mockReset();
  scansDeploy.mockReset();
  scansTransfer.mockReset();
  updateFacilities.mockReset();
  updateFinance.mockReset();
});

describe("performReceive", () => {
  it("does NOT write to facilities or finance", async () => {
    scansReceive.mockResolvedValue(FIXTURE);
    const input: ReceiveScanInput = {
      asset_tag: "C0009001",
      serial: "SN-T",
      model: "Test Model",
      manufacturer: "TestCo",
      asset_class: "instrument",
      location: FIXTURE.location,
      user_id: "tech-jane",
      scan_payload: "C0009001",
    };
    const result = await performReceive(input);
    expect(scansReceive).toHaveBeenCalledTimes(1);
    expect(updateFacilities).not.toHaveBeenCalled();
    expect(updateFinance).not.toHaveBeenCalled();
    expect(result.side_effects).toEqual([]);
  });
});

describe("performStore", () => {
  const input: StoreScanInput = {
    asset_tag: "C0009001",
    location: {
      site: "Lab-Building-A",
      room: "Storage-12",
      row: null,
      rack: null,
      ru: null,
    },
    user_id: "tech-jane",
    scan_payload: "C0009001",
  };

  it("from in_service: fires facilities null (de-rack), no finance write", async () => {
    scansStore.mockResolvedValue({ ...FIXTURE, state: "stored" });
    updateFacilities.mockResolvedValue({ ok: true });
    const result = await performStore(input, "in_service");

    expect(updateFacilities).toHaveBeenCalledWith({
      tagged_id: "C0009001",
      rack_location: null,
    });
    expect(updateFinance).not.toHaveBeenCalled();
    expect(result.side_effects).toEqual([
      { system: "facilities", ok: true, action: "Removed from rack (de-rack)" },
    ]);
  });

  it("from received: NO facilities or finance write", async () => {
    scansStore.mockResolvedValue({ ...FIXTURE, state: "stored" });
    const result = await performStore(input, "received");

    expect(updateFacilities).not.toHaveBeenCalled();
    expect(updateFinance).not.toHaveBeenCalled();
    expect(result.side_effects).toEqual([]);
  });

  it("surfaces facilities write failure as ok=false, doesn't throw", async () => {
    scansStore.mockResolvedValue({ ...FIXTURE, state: "stored" });
    updateFacilities.mockRejectedValue(new Error("upstream offline"));
    const result = await performStore(input, "in_service");

    expect(result.side_effects[0]?.ok).toBe(false);
    expect(result.side_effects[0]?.error).toContain("upstream offline");
  });
});

describe("performDeploy", () => {
  const input: DeployScanInput = {
    asset_tag: "C0009001",
    location: {
      site: "Lab-Building-B",
      room: "Bay-9",
      row: null,
      rack: "R-9",
      ru: "P-01",
    },
    user_id: "tech-jane",
    scan_payload: "C0009001",
  };

  it("fires both facilities (rack location) and finance (capitalize) writes", async () => {
    scansDeploy.mockResolvedValue({
      ...FIXTURE,
      state: "in_service",
      location: input.location,
    });
    updateFacilities.mockResolvedValue({ ok: true });
    updateFinance.mockResolvedValue({ ok: true });

    const result = await performDeploy(input);

    expect(updateFacilities).toHaveBeenCalledWith({
      tagged_id: "C0009001",
      rack_location: "Lab-Building-B/Bay-9//R-9/P-01",
    });
    expect(updateFinance).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "C0009001",
        site: "Lab-Building-B",
        status: "capitalized",
      }),
    );
    expect(result.side_effects.map((s) => s.system)).toEqual([
      "facilities",
      "finance",
    ]);
    expect(result.side_effects.every((s) => s.ok)).toBe(true);
  });

  it("returns finance failure inline without aborting facilities", async () => {
    scansDeploy.mockResolvedValue({
      ...FIXTURE,
      state: "in_service",
      location: input.location,
    });
    updateFacilities.mockResolvedValue({ ok: true });
    updateFinance.mockRejectedValue(new Error("finance maintenance"));

    const result = await performDeploy(input);

    expect(result.side_effects[0]?.ok).toBe(true);
    expect(result.side_effects[1]?.ok).toBe(false);
    expect(result.side_effects[1]?.error).toContain("finance maintenance");
  });
});

describe("performTransfer", () => {
  it("does not write to facilities or finance", async () => {
    scansTransfer.mockResolvedValue({ ...FIXTURE, custodian: "tech-mike" });
    const input: TransferScanInput = {
      asset_tag: "C0009001",
      to_custodian: "tech-mike",
      user_id: "tech-jane",
      scan_payload: "C0009001>tech-mike",
    };
    const result = await performTransfer(input);

    expect(updateFacilities).not.toHaveBeenCalled();
    expect(updateFinance).not.toHaveBeenCalled();
    expect(result.side_effects).toEqual([]);
  });
});
