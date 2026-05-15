import { describe, expect, it } from "vitest";
import { parseSort, sortAssets, DEFAULT_SORT } from "@/lib/sort-assets";
import type { Asset } from "@/lib/types";

function asset(overrides: Partial<Asset>): Asset {
  return {
    asset_tag: "C0000001",
    serial: "SN",
    model: "Model",
    manufacturer: "Vendor",
    asset_class: "instrument",
    state: "in_service",
    location: { site: "A", room: null, row: null, rack: null, ru: null },
    custodian: "tech-a",
    parent_asset_tag: null,
    procurement_note: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("parseSort", () => {
  it("returns the default when input is empty", () => {
    const { key, dir } = parseSort(undefined);
    const [k, d] = DEFAULT_SORT.split(":");
    expect(key).toBe(k);
    expect(dir).toBe(d);
  });

  it("falls back to updated_at:desc on garbage", () => {
    const { key, dir } = parseSort("garbage:tomorrow");
    expect(key).toBe("updated_at");
    expect(dir).toBe("desc");
  });

  it("accepts a valid pair", () => {
    expect(parseSort("asset_tag:asc")).toEqual({ key: "asset_tag", dir: "asc" });
  });
});

describe("sortAssets", () => {
  it("orders by asset_tag ascending", () => {
    const a = asset({ asset_tag: "C0000002" });
    const b = asset({ asset_tag: "C0000001" });
    const out = sortAssets([a, b], "asset_tag", "asc");
    expect(out.map((x) => x.asset_tag)).toEqual(["C0000001", "C0000002"]);
  });

  it("orders state by lifecycle, not lexical", () => {
    // Lexical: disposed (d) < in_service (i) < received (r) < stored (s)
    // Lifecycle (what a manager expects): received < stored < in_service < disposed
    const received = asset({ asset_tag: "R", state: "received" });
    const stored = asset({ asset_tag: "S", state: "stored" });
    const inService = asset({ asset_tag: "I", state: "in_service" });
    const disposed = asset({ asset_tag: "D", state: "disposed" });
    const out = sortAssets(
      [disposed, inService, stored, received],
      "state",
      "asc",
    );
    expect(out.map((x) => x.state)).toEqual([
      "received",
      "stored",
      "in_service",
      "disposed",
    ]);
  });

  it("sorts the entire input set, not just a slice", () => {
    // This is the regression we fixed: sorting was previously done inside
    // AssetTable on the already-paginated slice. Verify a fresh input.
    const inputs = Array.from({ length: 100 }, (_, i) =>
      asset({
        asset_tag: `C${String(i).padStart(7, "0")}`,
        updated_at: new Date(2026, 0, 1 + i).toISOString(),
      }),
    );
    const sorted = sortAssets(inputs, "updated_at", "desc");
    expect(sorted[0]?.asset_tag).toBe("C0000099");
    expect(sorted[99]?.asset_tag).toBe("C0000000");
  });

  it("is stable when keys tie (preserves input order)", () => {
    // Not a hard requirement, just verifying current behavior.
    const a = asset({ asset_tag: "A", state: "in_service" });
    const b = asset({ asset_tag: "B", state: "in_service" });
    const out = sortAssets([a, b], "state", "asc");
    expect(out.map((x) => x.asset_tag)).toEqual(["A", "B"]);
  });
});
