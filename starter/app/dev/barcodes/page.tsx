import { api, ApiError } from "@/lib/api-client";
import { encodeLocationPayload, encodeBadgePayload } from "@/lib/locations";
import { Barcode } from "@/components/Barcode";
import type { Asset, FacilitiesRecord, FinanceRecord } from "@/lib/types";
import { reconcile } from "@/lib/reconcile";
import { StateBadge } from "@/components/StateBadge";

export const dynamic = "force-dynamic";

// Test barcode sheet: scan-ready Code 128 strips for the asset tags and
// locations the reviewer needs to exercise the workflows. Print to letter or
// view on a second screen.
//
// We hand-pick assets to cover:
//   - one in_service asset that's correctly racked
//   - one in storage (for a deploy demo)
//   - one drifted asset (rack mismatch / ghost)
//   - one disposed asset (so the reviewer can see the state-machine reject)
//
// Fallback: if the seeded data doesn't have all four, we fill from whatever
// is available so the page still renders.
export default async function DevBarcodesPage() {
  let assets: Asset[] = [];
  let facilities: FacilitiesRecord[] = [];
  let finance: FinanceRecord[] = [];
  try {
    [assets, facilities, finance] = await Promise.all([
      api.assets.list({}),
      api.mock.facilities(),
      api.mock.finance(),
    ]);
  } catch (e) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Test barcodes</h1>
        <p className="text-sm text-red-700">
          Couldn&rsquo;t load assets:{" "}
          {e instanceof ApiError ? e.message : String(e)}
        </p>
      </div>
    );
  }

  const report = reconcile(assets, facilities, finance);
  const driftedTags = new Set(
    report.issues
      .filter((i) => i.severity === "needs_action" && i.asset_tag)
      .map((i) => i.asset_tag!),
  );

  function pick(predicate: (a: Asset) => boolean): Asset | null {
    return assets.find(predicate) ?? null;
  }

  const inService = pick((a) => a.state === "in_service" && !driftedTags.has(a.asset_tag));
  const stored = pick((a) => a.state === "stored");
  const received = pick((a) => a.state === "received");
  const drifted = pick((a) => driftedTags.has(a.asset_tag));
  const disposed = pick((a) => a.state === "disposed");

  const featured: Array<{ label: string; reason: string; asset: Asset | null }> = [
    {
      label: "Healthy in_service asset",
      reason: "Use this on /tech/store to test de-rack.",
      asset: inService,
    },
    {
      label: "Asset in storage",
      reason: "Use this on /tech/deploy to test the rack-out flow.",
      asset: stored,
    },
    {
      label: "Asset just received",
      reason: "Use this on /tech/store or /tech/deploy.",
      asset: received,
    },
    {
      label: "Drifted asset",
      reason: "One the reconciliation report flags. Inspect on /manager/assets/[tag].",
      asset: drifted,
    },
    {
      label: "Disposed asset",
      reason: "Scan it on /tech/store to see the invalid_transition error.",
      asset: disposed,
    },
  ];

  // A few useful location codes. The string format matches what the
  // LocationFields scanner expects.
  const locationCodes = [
    {
      label: "Storage row, Building A",
      payload: encodeLocationPayload({
        site: "Lab-Building-A",
        room: "Storage-12",
        row: null,
        rack: null,
        ru: null,
      }),
    },
    {
      label: "Rack B-04 / RU P-02, Building A",
      payload: encodeLocationPayload({
        site: "Lab-Building-A",
        room: "Bay-12",
        row: "Aisle-3",
        rack: "B-04",
        ru: "P-02",
      }),
    },
    {
      label: "Rack B-07 / RU P-09, Building B",
      payload: encodeLocationPayload({
        site: "Lab-Building-B",
        room: "Bay-3",
        row: "Aisle-1",
        rack: "B-07",
        ru: "P-09",
      }),
    },
    {
      label: "Incomplete rack (no RU) — should fail deploy",
      payload: encodeLocationPayload({
        site: "Lab-Building-C",
        room: "Bay-4",
        row: null,
        rack: "B-01",
        ru: null,
      }),
    },
  ];

  const badges = ["tech-jane", "tech-mike", "manager-paul"].map((u) => ({
    label: `Badge: ${u}`,
    payload: encodeBadgePayload(u),
  }));

  return (
    <div className="space-y-8 print:space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Test barcodes</h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Print this page or pull it up on a second monitor and scan with a
          phone camera or a USB wedge. Generated as Code 128 — same format the
          scanners on the floor use.
        </p>
      </header>

      <section>
        <h2 className="font-semibold text-sm text-gray-900 mb-3">
          Asset tags
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {featured.map((f) =>
            f.asset ? (
              <Card
                key={f.label}
                title={f.label}
                subtitle={f.reason}
                payload={f.asset.asset_tag}
              >
                <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                  <span>
                    {f.asset.model} · {f.asset.manufacturer}
                  </span>
                  <StateBadge state={f.asset.state} />
                </div>
              </Card>
            ) : null,
          )}
        </div>
      </section>

      <section className="break-before-page">
        <h2 className="font-semibold text-sm text-gray-900 mb-3">
          Locations
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {locationCodes.map((l) => (
            <Card
              key={l.label}
              title={l.label}
              subtitle="Use on Store / Deploy"
              payload={l.payload}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-sm text-gray-900 mb-3">
          Badges
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {badges.map((b) => (
            <Card
              key={b.label}
              title={b.label}
              subtitle="Use on Transfer"
              payload={b.payload}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  subtitle,
  payload,
  children,
}: {
  title: string;
  subtitle: string;
  payload: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs font-semibold text-gray-900">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
      <div className="mt-3 flex items-center justify-center bg-white">
        <Barcode text={payload} />
      </div>
      <div className="font-mono text-[11px] text-gray-500 text-center mt-1 break-all">
        {payload}
      </div>
      {children}
    </div>
  );
}
