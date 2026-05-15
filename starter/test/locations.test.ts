import { describe, expect, it } from "vitest";
import {
  encodeLocationPayload,
  parseLocationPayload,
  encodeBadgePayload,
  parseBadgePayload,
  isAssetTag,
  isCompleteDeployLocation,
  formatLocation,
  locationToFacilitiesString,
} from "@/lib/locations";

describe("location payloads", () => {
  it("round-trips a fully-populated rack location", () => {
    const loc = {
      site: "Lab-Building-A",
      room: "Bay-12",
      row: "Aisle-3",
      rack: "B-04",
      ru: "P-02",
    };
    const payload = encodeLocationPayload(loc);
    expect(payload).toBe("LOC|Lab-Building-A|Bay-12|Aisle-3|B-04|P-02");
    expect(parseLocationPayload(payload)).toEqual(loc);
  });

  it("round-trips a sparse storage location", () => {
    const loc = {
      site: "Lab-Building-B",
      room: "Storage-12",
      row: null,
      rack: null,
      ru: null,
    };
    const payload = encodeLocationPayload(loc);
    expect(parseLocationPayload(payload)).toEqual(loc);
  });

  it("rejects payloads without a LOC| prefix", () => {
    expect(parseLocationPayload("Lab-Building-A|Bay-12|||")).toBeNull();
    expect(parseLocationPayload("C0000101")).toBeNull();
  });

  it("rejects payloads without a site", () => {
    expect(parseLocationPayload("LOC||Bay-12|||")).toBeNull();
  });
});

describe("badge payloads", () => {
  it("round-trips", () => {
    expect(parseBadgePayload(encodeBadgePayload("tech-mike"))).toBe("tech-mike");
  });

  it("returns null for non-badge strings", () => {
    expect(parseBadgePayload("tech-mike")).toBeNull();
    expect(parseBadgePayload("BADGE|")).toBeNull();
  });
});

describe("asset tag validation", () => {
  it("matches the spec format", () => {
    expect(isAssetTag("C0000101")).toBe(true);
    expect(isAssetTag("C0009999")).toBe(true);
  });

  it("rejects malformed tags", () => {
    expect(isAssetTag("C123")).toBe(false);
    expect(isAssetTag("c0000101")).toBe(false);
    expect(isAssetTag("C00001019")).toBe(false);
    expect(isAssetTag("X0000101")).toBe(false);
  });
});

describe("isCompleteDeployLocation", () => {
  it("requires site, room, rack, and RU", () => {
    expect(
      isCompleteDeployLocation({
        site: "A",
        room: "B",
        row: null,
        rack: "C",
        ru: "D",
      }),
    ).toBe(true);
  });

  it("rejects missing RU", () => {
    expect(
      isCompleteDeployLocation({
        site: "A",
        room: "B",
        row: null,
        rack: "C",
        ru: null,
      }),
    ).toBe(false);
  });

  it("rejects missing room", () => {
    expect(
      isCompleteDeployLocation({
        site: "A",
        room: null,
        row: null,
        rack: "C",
        ru: "D",
      }),
    ).toBe(false);
  });
});

describe("display formatters", () => {
  it("collapses null fields when formatting", () => {
    expect(
      formatLocation({
        site: "A",
        room: null,
        row: null,
        rack: null,
        ru: null,
      }),
    ).toBe("A");
  });

  it("matches the facilities slash format including null gaps", () => {
    // Facilities uses "site/room/row/rack/ru". When row is null we still need
    // the slot, otherwise the comparison against facilities would never align.
    expect(
      locationToFacilitiesString({
        site: "Lab-Building-A",
        room: "Bay-12",
        row: null,
        rack: "B-04",
        ru: "P-02",
      }),
    ).toBe("Lab-Building-A/Bay-12//B-04/P-02");
  });
});
