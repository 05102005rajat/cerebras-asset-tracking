import { describe, expect, it } from "vitest";
import { validateAssetTagScan } from "@/lib/tag-validate";
import { ApiError } from "@/lib/api-client";

describe("validateAssetTagScan", () => {
  it("returns null for a valid tag", () => {
    expect(validateAssetTagScan("C0000101")).toBeNull();
  });

  it("returns a location-specific error when a LOC payload is scanned", () => {
    const err = validateAssetTagScan("LOC|Lab-Building-A|Bay-12|||");
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("wrong_scan_type_location");
    expect(err?.message).toContain("location label");
  });

  it("returns a badge-specific error when a BADGE payload is scanned", () => {
    const err = validateAssetTagScan("BADGE|tech-mike");
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("wrong_scan_type_badge");
    expect(err?.message).toContain("badge");
  });

  it("returns a generic format error for everything else", () => {
    const err = validateAssetTagScan("garbage");
    expect(err?.code).toBe("invalid_tag_format");
  });

  it("returns a generic format error for lowercase tags", () => {
    const err = validateAssetTagScan("c0000101");
    expect(err?.code).toBe("invalid_tag_format");
  });
});
