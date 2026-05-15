import { api } from "@/lib/api-client";
import { reconcile, type Severity } from "@/lib/reconcile";
import { AssetTable } from "@/components/AssetTable";
import { AssetFilters } from "@/components/AssetFilters";
import { FilterChips } from "@/components/FilterChips";
import { Pagination } from "@/components/Pagination";
import { DriftTopline } from "@/components/DriftTopline";
import { EmptyState } from "@/components/EmptyState";
import type { Asset, AssetState } from "@/lib/types";

const PAGE_SIZE = 25;

const VALID_STATES: AssetState[] = [
  "unreceived",
  "received",
  "stored",
  "in_service",
  "rma_pending",
  "disposed",
];

export const dynamic = "force-dynamic";

export default async function ManagerLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = readOne(sp.state);
  const site = readOne(sp.site);
  const custodian = readOne(sp.custodian);
  const q = (readOne(sp.q) ?? "").toLowerCase();
  const page = Math.max(1, parseInt(readOne(sp.page) ?? "1", 10) || 1);

  // The reconciliation walks every asset, so we need the unfiltered set; the
  // table walks only the filtered slice. One round-trip for each — we used
  // to fire the unfiltered list twice (once for reconcile, once to populate
  // filter dropdowns), folded into one.
  const [allAssets, facilities, finance] = await Promise.all([
    api.assets.list({}),
    api.mock.facilities(),
    api.mock.finance(),
  ]);

  const filtered = applyFilters(allAssets, { state, site, custodian, q });
  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const report = reconcile(allAssets, facilities, finance);

  // Map of asset_tag → most-severe issue, so the table can dot the row.
  const driftMap = new Map<string, Severity>();
  for (const issue of report.issues) {
    if (!issue.asset_tag) continue;
    const existing = driftMap.get(issue.asset_tag);
    if (
      !existing ||
      severityRank(issue.severity) > severityRank(existing)
    ) {
      driftMap.set(issue.asset_tag, issue.severity);
    }
  }

  // Pull dropdown options from the unfiltered set so that selecting "Site B"
  // doesn't make the Site dropdown show only B.
  const knownSites = Array.from(
    new Set(allAssets.map((a) => a.location.site).filter(Boolean)),
  ).sort();
  const knownCustodians = Array.from(
    new Set(allAssets.map((a) => a.custodian).filter(Boolean)),
  ).sort();

  // Pass the active query string to the table so each link can preserve it
  // — clicking back from the detail page returns to this exact filter set.
  const preserveSearch = await searchParamsToString(sp);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-gray-600 mt-1">
            {allAssets.length.toLocaleString()} assets across{" "}
            {knownSites.length} site{knownSites.length === 1 ? "" : "s"}.
          </p>
        </div>
      </header>

      <DriftTopline
        needsAction={report.totals.issues_needs_action}
        watch={report.totals.issues_watch}
        generatedAt={report.generated_at}
      />

      <AssetFilters
        knownSites={knownSites}
        knownCustodians={knownCustodians}
      />

      <FilterChips />

      {slice.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          body="Loosen the filters or clear them to see the full list."
        />
      ) : (
        <>
          <AssetTable
            assets={slice}
            driftMap={driftMap}
            preserveSearch={preserveSearch}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}

function applyFilters(
  assets: Asset[],
  f: { state?: string; site?: string; custodian?: string; q: string },
): Asset[] {
  return assets.filter((a) => {
    if (f.state && VALID_STATES.includes(f.state as AssetState) && a.state !== f.state)
      return false;
    if (f.site && a.location.site !== f.site) return false;
    if (f.custodian && a.custodian !== f.custodian) return false;
    if (
      f.q &&
      ![a.asset_tag, a.model, a.manufacturer, a.serial]
        .join(" ")
        .toLowerCase()
        .includes(f.q)
    )
      return false;
    return true;
  });
}

function severityRank(s: Severity): number {
  return s === "needs_action" ? 2 : s === "watch" ? 1 : 0;
}

function readOne(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

async function searchParamsToString(
  sp: Record<string, string | string[] | undefined>,
): Promise<string> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, item);
    } else {
      qs.set(k, v);
    }
  }
  return qs.toString();
}
