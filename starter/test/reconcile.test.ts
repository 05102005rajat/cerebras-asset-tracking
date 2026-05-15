import { describe, expect, it } from "vitest";
import { reconcile } from "@/lib/reconcile";
import type {
  Asset,
  FacilitiesRecord,
  FinanceRecord,
} from "@/lib/types";

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    asset_tag: "C0000101",
    serial: "SN-1",
    model: "Model X",
    manufacturer: "Vendor",
    asset_class: "instrument",
    state: "in_service",
    location: {
      site: "Lab-Building-A",
      room: "Bay-12",
      row: "Aisle-3",
      rack: "B-04",
      ru: "P-02",
    },
    custodian: "tech-jane",
    parent_asset_tag: null,
    procurement_note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function facility(overrides: Partial<FacilitiesRecord> = {}): FacilitiesRecord {
  return {
    space_id: "fac-1",
    tagged_id: "C0000101",
    rack_location: "Lab-Building-A/Bay-12/Aisle-3/B-04/P-02",
    last_observed: "2026-05-10T00:00:00Z",
    ...overrides,
  };
}

function finance(overrides: Partial<FinanceRecord> = {}): FinanceRecord {
  return {
    finance_id: "EQ-1",
    tag: "C0000101",
    site: "Lab-Building-A",
    book_value_usd: 1000,
    status: "capitalized",
    capitalized_on: "2025-09-01",
    ...overrides,
  };
}

const now = new Date("2026-05-14T00:00:00Z");

describe("reconcile", () => {
  it("emits no issues when ops/facilities/finance agree on a healthy in_service asset", () => {
    const r = reconcile([asset()], [facility()], [finance()], now);
    expect(r.issues).toHaveLength(0);
    expect(r.totals.assets).toBe(1);
  });

  it("flags a rack mismatch as needs_action", () => {
    const r = reconcile(
      [asset()],
      [facility({ rack_location: "Lab-Building-A/Bay-12/Aisle-3/B-04/P-99" })],
      [finance()],
      now,
    );
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({
      severity: "needs_action",
      category: "rack_mismatch",
    });
    expect(r.issues[0]?.comparison?.ops).toContain("P-02");
    expect(r.issues[0]?.comparison?.facilities).toContain("P-99");
  });

  it("flags an in_service asset missing from facilities", () => {
    const r = reconcile([asset()], [], [finance()], now);
    expect(r.issues.find((i) => i.category === "missing_in_facilities")).toBeDefined();
  });

  it("flags a stored asset that's still racked in facilities", () => {
    const r = reconcile(
      [asset({ state: "stored" })],
      [facility()],
      [finance()],
      now,
    );
    const issue = r.issues.find((i) => i.category === "rack_mismatch");
    expect(issue?.severity).toBe("needs_action");
  });

  it("does NOT flag a stored asset that's correctly absent from facilities", () => {
    const r = reconcile(
      [asset({ state: "stored" })],
      [],
      [finance()],
      now,
    );
    expect(r.issues).toHaveLength(0);
  });

  it("flags disposed-but-capitalized as needs_action", () => {
    const r = reconcile(
      [asset({ state: "disposed" })],
      [],
      [finance({ status: "capitalized" })],
      now,
    );
    expect(
      r.issues.find((i) => i.category === "disposed_but_capitalized"),
    ).toMatchObject({ severity: "needs_action" });
  });

  it("flags ghost in facilities", () => {
    const r = reconcile(
      [],
      [facility({ tagged_id: "C0009999" })],
      [],
      now,
    );
    expect(r.issues[0]).toMatchObject({
      asset_tag: "C0009999",
      category: "ghost_in_facilities",
      severity: "needs_action",
    });
  });

  it("flags ghost in finance", () => {
    const r = reconcile([], [], [finance({ tag: "C0009999" })], now);
    expect(r.issues[0]).toMatchObject({
      asset_tag: "C0009999",
      category: "ghost_in_finance",
    });
  });

  it("flags stale facilities observation as watch", () => {
    const r = reconcile(
      [asset()],
      [facility({ last_observed: "2026-01-01T00:00:00Z" })],
      [finance()],
      now,
    );
    expect(
      r.issues.find((i) => i.category === "stale_facilities_observation"),
    ).toMatchObject({ severity: "watch" });
  });

  it("flags pending_receipt after receive as watch", () => {
    const r = reconcile(
      [asset({ state: "received" })],
      [],
      [finance({ status: "pending_receipt" })],
      now,
    );
    expect(
      r.issues.find((i) => i.category === "finance_pending_after_receive"),
    ).toMatchObject({ severity: "watch" });
  });

  it("flags site mismatch with finance", () => {
    const r = reconcile(
      [asset()],
      [facility()],
      [finance({ site: "Lab-Building-B" })],
      now,
    );
    expect(r.issues.find((i) => i.category === "site_mismatch")).toBeDefined();
  });

  it("orders needs_action issues before watch", () => {
    const r = reconcile(
      [asset({ state: "received" })],
      [facility({ rack_location: "anywhere/else" })],
      [finance({ status: "pending_receipt" })],
      now,
    );
    expect(r.issues[0]?.severity).toBe("needs_action");
    expect(r.issues[r.issues.length - 1]?.severity).toBe("watch");
  });
});
