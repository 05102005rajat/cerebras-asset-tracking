import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { StateBadge } from "@/components/StateBadge";
import { EventTimeline } from "@/components/EventTimeline";
import { EmptyState } from "@/components/EmptyState";
import { formatLocation } from "@/lib/locations";
import { reconcile } from "@/lib/reconcile";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/reconcile";
import { shortIso, relativeTime } from "@/lib/format";
import type { Asset, Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagerAssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tag } = await params;
  const sp = await searchParams;
  const fromRaw = sp.from;
  const from = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const backHref = from ? `/manager?${from}` : "/manager";

  let asset: Asset | null = null;
  let events: Event[] = [];
  let lookupError: string | null = null;

  try {
    [asset, events] = await Promise.all([
      api.assets.get(tag),
      api.assets.history(tag),
    ]);
  } catch (e) {
    lookupError =
      e instanceof ApiError && e.code === "unknown_asset"
        ? "No asset on file with that tag."
        : e instanceof Error
          ? e.message
          : "Lookup failed.";
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <BackLink href={backHref} />
        <EmptyState
          title={lookupError ?? "Asset not found"}
          body={
            <>
              The tag <span className="font-mono">{tag}</span> isn&rsquo;t in
              the operational system. Check the URL or run /tech/receive.
            </>
          }
        />
      </div>
    );
  }

  // Pull mocks too so we can show this asset's drift inline. Cheaper than a
  // round-trip to /api/reconcile and lets the manager act from one screen.
  const [facilities, finance] = await Promise.all([
    api.mock.facilities(),
    api.mock.finance(),
  ]);
  const fac = facilities.find((f) => f.tagged_id === tag) ?? null;
  const fin = finance.find((f) => f.tag === tag) ?? null;

  const report = reconcile([asset], facilities, finance);
  const myIssues = report.issues.filter((i) => i.asset_tag === tag);

  return (
    <div className="space-y-6">
      <BackLink href={backHref} />

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-sm text-gray-500">
              {asset.asset_tag}
            </div>
            <h1 className="text-xl font-semibold mt-0.5">{asset.model}</h1>
            <div className="text-sm text-gray-600">
              {asset.manufacturer} · serial {asset.serial} ·{" "}
              {asset.asset_class}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StateBadge state={asset.state} />
            <div
              className="text-xs text-gray-500"
              title={shortIso(asset.updated_at)}
            >
              updated {relativeTime(asset.updated_at)}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <Field label="Custodian">
            <span className="font-mono">{asset.custodian}</span>
          </Field>
          <Field label="Location (ops)">{formatLocation(asset.location)}</Field>
          <Field label="Created">
            <span title={shortIso(asset.created_at)}>
              {relativeTime(asset.created_at)}
            </span>
          </Field>
          {asset.parent_asset_tag ? (
            <Field label="Parent">
              <Link
                className="font-mono text-blue-700 hover:underline"
                href={`/manager/assets/${asset.parent_asset_tag}`}
              >
                {asset.parent_asset_tag}
              </Link>
            </Field>
          ) : null}
          {asset.procurement_note ? (
            <Field label="Procurement note">{asset.procurement_note}</Field>
          ) : null}
        </dl>
      </div>

      {myIssues.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Drift on this asset
          </h2>
          <ul className="space-y-2">
            {myIssues.map((i, idx) => (
              <li
                key={idx}
                className={`border rounded-lg p-3 ${
                  i.severity === "needs_action"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold">
                  <span
                    className={
                      i.severity === "needs_action"
                        ? "text-red-700"
                        : "text-amber-700"
                    }
                  >
                    {SEVERITY_LABEL[i.severity]}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">
                    {CATEGORY_LABEL[i.category]}
                  </span>
                </div>
                <div className="font-semibold text-gray-900 mt-1">
                  {i.headline}
                </div>
                <div className="text-sm text-gray-700 mt-1">{i.detail}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Facilities view
          </div>
          {fac ? (
            <dl className="text-sm mt-2 space-y-1">
              <Row k="Rack">{fac.rack_location}</Row>
              <Row k="Last observed" title={shortIso(fac.last_observed)}>
                {relativeTime(fac.last_observed)}
              </Row>
              <Row k="Space ID">
                <span className="font-mono text-xs">{fac.space_id}</span>
              </Row>
            </dl>
          ) : (
            <div className="text-sm text-gray-500 mt-2">
              Not racked. Facilities only tracks <code>in_service</code> assets.
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Finance view
          </div>
          {fin ? (
            <dl className="text-sm mt-2 space-y-1">
              <Row k="Status">{fin.status}</Row>
              <Row k="Site">{fin.site}</Row>
              <Row k="Book value">${fin.book_value_usd.toLocaleString()}</Row>
              <Row k="Capitalized on">{fin.capitalized_on ?? "—"}</Row>
              <Row k="Finance ID">
                <span className="font-mono text-xs">{fin.finance_id}</span>
              </Row>
            </dl>
          ) : (
            <div className="text-sm text-gray-500 mt-2">
              No finance record. Either un-procured or never received.
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Event history
        </h2>
        <EventTimeline events={events} />
      </section>
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  const usingFilters = href !== "/manager";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
    >
      ← {usingFilters ? "Back to filtered results" : "Back to assets"}
    </Link>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 mt-1">{children}</dd>
    </div>
  );
}

function Row({
  k,
  children,
  title,
}: {
  k: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex justify-between gap-3" title={title}>
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-900 text-right truncate min-w-0">{children}</dd>
    </div>
  );
}
