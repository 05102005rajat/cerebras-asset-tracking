import type { Issue, ReconcileReport } from "./reconcile";

// Minimal RFC-4180 CSV encoder. Quotes any field that contains a comma,
// quote, or newline; doubles inner quotes. No dependency, no surprises.
//
// Also guards against CSV/formula injection: fields are built from free-text
// upstream data (asset model, finance site, facilities rack location, etc.)
// that this app doesn't control. Excel/Sheets treats a leading =, +, -, or @
// as the start of a formula, so a value like `=HYPERLINK("http://evil","Open")`
// would execute on open. Prefixing those fields with a single quote keeps
// them literal text without changing what a human sees in the sheet.
const FORMULA_LEADING_CHAR = /^[=+\-@\t\r]/;

function quote(s: string): string {
  const safe = FORMULA_LEADING_CHAR.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
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
