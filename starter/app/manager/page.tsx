import { api } from "@/lib/api-client";
import { reconcile } from "@/lib/reconcile";
import { AssetTable } from "@/components/AssetTable";
import { AssetFilters } from "@/components/AssetFilters";
import { Pagination } from "@/components/Pagination";
import { DriftTopline } from "@/components/DriftTopline";
import { EmptyState } from "@/components/EmptyState";
import type { AssetState } from "@/lib/types";

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

  // We always pull the full list and reconcile once per page render.
  // At 1k assets this is comfortably sub-second; at 100k we'd push the
  // server-side filter and the reconcile to background jobs.
  const [assets, facilities, finance] = await Promise.all([
    api.assets.list({
      state: state && VALID_STATES.includes(state as AssetState) ? state : undefined,
      site: site || undefined,
      custodian: custodian || undefined,
    }),
    api.mock.facilities(),
    api.mock.finance(),
  ]);

  const filtered = q
    ? assets.filter((a) =>
        [a.asset_tag, a.model, a.manufacturer, a.serial]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : assets;

  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const report = reconcile(assets, facilities, finance);

  // Used to populate filter dropdowns. We pull from the unfiltered set so
  // that selecting "Site B" doesn't make the Site dropdown show only B.
  // (Tradeoff: if a site has zero assets right now, it still appears.)
  const allAssets = await api.assets.list({});
  const knownSites = Array.from(
    new Set(allAssets.map((a) => a.location.site).filter(Boolean)),
  ).sort();
  const knownCustodians = Array.from(
    new Set(allAssets.map((a) => a.custodian).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-gray-600 mt-1">
            {assets.length.toLocaleString()} assets across{" "}
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

      {slice.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          body="Loosen the filters or clear them to see the full list."
        />
      ) : (
        <>
          <AssetTable assets={slice} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}

function readOne(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
