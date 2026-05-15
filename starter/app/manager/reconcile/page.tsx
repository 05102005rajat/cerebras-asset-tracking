import Link from "next/link";
import { headers } from "next/headers";
import { EmptyState } from "@/components/EmptyState";
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  type Issue,
  type ReconcileReport,
} from "@/lib/reconcile";

export const dynamic = "force-dynamic";

export default async function ManagerReconcilePage() {
  // Server-side fetch to /api/reconcile so the page itself never touches the
  // join. If you tail the network tab in the browser you'll see this page
  // load as one HTML document — no client roundtrip.
  const reqHeaders = await headers();
  const proto = reqHeaders.get("x-forwarded-proto") ?? "http";
  const host = reqHeaders.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/api/reconcile`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Reconciliation report</h1>
        <EmptyState
          icon="!"
          title="Couldn't build the report"
          body={
            <span>
              {body?.error?.message ??
                "The upstream system didn't answer. Try again, then check the API logs."}
            </span>
          }
        />
      </div>
    );
  }
  const report = (await res.json()) as ReconcileReport;

  const needsAction = report.issues.filter((i) => i.severity === "needs_action");
  const watch = report.issues.filter((i) => i.severity === "watch");
  const info = report.issues.filter((i) => i.severity === "info");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation report</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Where ops, facilities, and finance disagree. Rebuilt each time you
            open this page from <code>/api/reconcile</code>.
          </p>
        </div>
        <div className="flex items-end gap-3 print:hidden">
          <a
            href="/api/reconcile/csv"
            className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md font-medium"
            download
          >
            Export CSV
          </a>
          <ReportMeta report={report} />
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          severity="needs_action"
          count={needsAction.length}
          label="Needs action"
          sub="Investigate this week"
        />
        <Tile
          severity="watch"
          count={watch.length}
          label="Watch"
          sub="Flag if it persists"
        />
        <Tile
          severity="info"
          count={info.length}
          label="Info"
          sub="Explained by state"
        />
      </div>

      {report.issues.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Nothing to reconcile"
          body="All three systems agree on every asset. Most weeks you'll have something here — enjoy the quiet one."
        />
      ) : (
        <>
          <IssueSection
            title="Needs action"
            tone="needs_action"
            issues={needsAction}
            emptyHint="No actionable drift today."
          />
          <IssueSection
            title="Watch"
            tone="watch"
            issues={watch}
            emptyHint="Nothing on the watch list."
          />
        </>
      )}

      <CategoryGlossary />
    </div>
  );
}

function ReportMeta({ report }: { report: ReconcileReport }) {
  return (
    <div className="text-xs text-gray-500 text-right">
      <div>{report.totals.assets.toLocaleString()} ops assets</div>
      <div>
        {report.totals.facilities_records.toLocaleString()} facilities ·{" "}
        {report.totals.finance_records.toLocaleString()} finance
      </div>
      <div className="mt-1">
        generated {new Date(report.generated_at).toLocaleTimeString()}
      </div>
    </div>
  );
}

function Tile({
  severity,
  count,
  label,
  sub,
}: {
  severity: "needs_action" | "watch" | "info";
  count: number;
  label: string;
  sub: string;
}) {
  const tone = {
    needs_action: "border-red-200 bg-red-50",
    watch: "border-amber-200 bg-amber-50",
    info: "border-gray-200 bg-gray-50",
  }[severity];
  const text = {
    needs_action: "text-red-900",
    watch: "text-amber-900",
    info: "text-gray-700",
  }[severity];
  return (
    <div className={`border rounded-lg p-4 ${tone}`}>
      <div className={`text-3xl font-semibold ${text}`}>
        {count.toLocaleString()}
      </div>
      <div className={`text-sm font-semibold mt-1 ${text}`}>{label}</div>
      <div className="text-xs text-gray-600">{sub}</div>
    </div>
  );
}

function IssueSection({
  title,
  tone,
  issues,
  emptyHint,
}: {
  title: string;
  tone: "needs_action" | "watch";
  issues: Issue[];
  emptyHint: string;
}) {
  if (issues.length === 0) return null;

  // Group by category so the manager can chunk the work.
  const byCategory = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!byCategory.has(issue.category))
      byCategory.set(issue.category, []);
    byCategory.get(issue.category)!.push(issue);
  }

  const accent =
    tone === "needs_action" ? "border-red-200" : "border-amber-200";

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        {title}
        <span className="text-gray-500 font-normal ml-2 text-sm">
          {issues.length}
        </span>
      </h2>
      <div className="space-y-4">
        {Array.from(byCategory.entries()).map(([cat, list]) => (
          <details
            key={cat}
            open={list.length <= 10}
            className={`border rounded-lg bg-white ${accent}`}
          >
            <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 select-none">
              <div className="font-semibold text-gray-900 text-sm">
                {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}
              </div>
              <div className="text-xs text-gray-500">
                {list.length.toLocaleString()}{" "}
                {list.length === 1 ? "asset" : "assets"}
              </div>
            </summary>
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {list.slice(0, 200).map((issue, idx) => (
                <li key={idx} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900">
                        {issue.headline}
                      </div>
                      <div className="text-sm text-gray-700 mt-0.5">
                        {issue.detail}
                      </div>
                      {issue.comparison ? (
                        <ComparisonRow comparison={issue.comparison} />
                      ) : null}
                    </div>
                    {issue.asset_tag ? (
                      <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                        {/* Ghost issues link to /tech/receive with the tag
                             prefilled — the action the manager wants is for
                             a tech to receive it for the first time. Other
                             issues link to the asset detail for triage. */}
                        {issue.category === "ghost_in_facilities" ||
                        issue.category === "ghost_in_finance" ? (
                          <Link
                            href={`/tech/receive?tag=${issue.asset_tag}`}
                            className="font-mono text-xs text-emerald-700 hover:underline"
                          >
                            Resolve via Receive →
                          </Link>
                        ) : (
                          <Link
                            href={`/manager/assets/${issue.asset_tag}`}
                            className="font-mono text-xs text-blue-700 hover:underline"
                          >
                            {issue.asset_tag} →
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
              {list.length > 200 ? (
                <li className="px-4 py-3 text-xs text-gray-500">
                  …and {list.length - 200} more. Filter or page through if you
                  need to see them all.
                </li>
              ) : null}
            </ul>
          </details>
        ))}
      </div>
      {issues.length === 0 ? (
        <div className="text-sm text-gray-500 italic">{emptyHint}</div>
      ) : null}
    </section>
  );
}

function ComparisonRow({
  comparison,
}: {
  comparison: NonNullable<Issue["comparison"]>;
}) {
  const cells: Array<["Ops" | "Facilities" | "Finance", string | undefined]> = [
    ["Ops", comparison.ops],
    ["Facilities", comparison.facilities],
    ["Finance", comparison.finance],
  ];
  const present = cells.filter(([, v]) => v !== undefined);
  if (present.length === 0) return null;
  return (
    <div className="mt-2 text-xs grid gap-1 sm:grid-cols-3 max-w-xl">
      {present.map(([label, v]) => (
        <div key={label} className="bg-gray-50 rounded px-2 py-1">
          <span className="text-gray-500">{label}</span>{" "}
          <span className="font-mono text-gray-900">{v}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryGlossary() {
  return (
    <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        What do these categories mean?
      </summary>
      <dl className="mt-3 text-sm space-y-2">
        {[
          [
            "Needs action",
            "Real disagreement between two systems with no innocent explanation. A human likely moved or disposed an asset without scanning. Fix the source of truth and re-scan.",
          ],
          [
            "Watch",
            "Could be a billing-cycle lag (finance) or a stale facilities observation. Become 'Needs action' if they persist past two weeks.",
          ],
          [
            "Info",
            "Explained by state — e.g. assets in storage won't appear in facilities because facilities only tracks racked items. Surfaced for transparency.",
          ],
          [
            "Ghost in facilities / finance",
            "An asset tag known to one downstream system but not to ops. Either a scan was skipped, or downstream data is bad. Either way, ops should own the tag before reconciliation can finish.",
          ],
        ].map(([term, body]) => (
          <div key={term} className="grid sm:grid-cols-[150px_1fr] gap-2">
            <dt className="font-semibold text-gray-900">{term}</dt>
            <dd className="text-gray-700">{body}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
