import type { Issue, ReconcileReport } from "./reconcile";

// Minimal RFC-4180 CSV encoder. Quotes any field that contains a comma,
// quote, or newline; doubles inner quotes. No dependency, no surprises.
function quote(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: (string | number | undefined | null)[]): string {
  return cells.map((c) => quote(c == null ? "" : String(c))).join(",");
}

const HEADERS = [
  "severity",
  "category",
  "asset_tag",
  "headline",
  "detail",
  "ops_value",
  "facilities_value",
  "finance_value",
] as const;

// One row per issue. Manager pipes this into a spreadsheet, sorts by tag,
// hands the printed sheet to procurement.
export function reportToCsv(report: ReconcileReport): string {
  const lines = [row([...HEADERS])];
  for (const issue of report.issues) {
    lines.push(rowForIssue(issue));
  }
  return lines.join("\r\n") + "\r\n";
}

function rowForIssue(issue: Issue): string {
  return row([
    issue.severity,
    issue.category,
    issue.asset_tag,
    issue.headline,
    issue.detail,
    issue.comparison?.ops,
    issue.comparison?.facilities,
    issue.comparison?.finance,
  ]);
}
