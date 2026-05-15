"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Asset } from "@/lib/types";
import type { Severity } from "@/lib/reconcile";
import type { SortDir, SortKey } from "@/lib/sort-assets";
import { StateBadge } from "./StateBadge";
import { formatLocation } from "@/lib/locations";
import { relativeTime, shortIso } from "@/lib/format";

// Manager's primary view. Columns chosen for the 8:55am pre-standup glance:
// tag, identity, state, custodian, where it sits, and how recently it moved.
// We intentionally hide procurement_note and parent_asset_tag — they're rarely
// what the manager came to see, and they make the table noisy.
//
// Sort + filter live in the URL (server-rendered by the page). The table is
// a presentational component: it doesn't reorder rows, just renders the
// header buttons that re-emit a URL with `?sort=...`.
//
// Drift dots come from a precomputed map (the dashboard already runs the
// classifier once for the topline; we reuse the result here so the manager
// can see at a glance which row in their filtered list needs them).
export function AssetTable({
  assets,
  driftMap,
  preserveSearch,
  sortKey,
  sortDir,
}: {
  assets: Asset[];
  driftMap: Map<string, Severity>;
  preserveSearch: string;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setSort(nextKey: SortKey): void {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir: SortDir =
      nextKey === sortKey
        ? sortDir === "asc"
          ? "desc"
          : "asc"
        : nextKey === "updated_at"
          ? "desc"
          : "asc";
    params.set("sort", `${nextKey}:${nextDir}`);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 sticky top-[57px] z-10">
          <tr>
            <Th onClick={() => setSort("asset_tag")} active={sortKey === "asset_tag"} dir={sortDir}>
              Tag
            </Th>
            <Th onClick={() => setSort("model")} active={sortKey === "model"} dir={sortDir}>
              Model
            </Th>
            <Th onClick={() => setSort("state")} active={sortKey === "state"} dir={sortDir}>
              State
            </Th>
            <Th onClick={() => setSort("custodian")} active={sortKey === "custodian"} dir={sortDir}>
              Custodian
            </Th>
            <Th onClick={() => setSort("site")} active={sortKey === "site"} dir={sortDir}>
              Location
            </Th>
            <Th onClick={() => setSort("updated_at")} active={sortKey === "updated_at"} dir={sortDir} alignRight>
              Updated
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map((a) => {
            const drift = driftMap.get(a.asset_tag);
            return (
              <tr key={a.asset_tag} className="hover:bg-blue-50/40">
                <Td>
                  <Link
                    href={hrefWithReturn(`/manager/assets/${a.asset_tag}`, preserveSearch)}
                    className="font-mono text-blue-700 hover:underline inline-flex items-center gap-1.5"
                  >
                    {drift ? (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          drift === "needs_action"
                            ? "bg-red-500"
                            : drift === "watch"
                              ? "bg-amber-500"
                              : "bg-gray-300"
                        }`}
                        aria-label={`drift: ${drift.replace("_", " ")}`}
                        title={`drift: ${drift.replace("_", " ")}`}
                      />
                    ) : (
                      <span className="w-1.5 h-1.5" aria-hidden />
                    )}
                    {a.asset_tag}
                  </Link>
                </Td>
                <Td>
                  <Link
                    href={hrefWithReturn(`/manager/assets/${a.asset_tag}`, preserveSearch)}
                    className="block min-w-0"
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {a.model}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {a.manufacturer}
                    </div>
                  </Link>
                </Td>
                <Td>
                  <StateBadge state={a.state} />
                </Td>
                <Td>
                  <span className="font-mono text-xs text-gray-700">
                    {a.custodian}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-gray-700">
                    {formatLocation(a.location)}
                  </span>
                </Td>
                <Td alignRight>
                  <span
                    className="text-xs text-gray-500"
                    title={shortIso(a.updated_at)}
                  >
                    {relativeTime(a.updated_at)}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  alignRight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  alignRight?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`text-${alignRight ? "right" : "left"} text-xs font-semibold uppercase tracking-wide px-3 py-2`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? "text-gray-900" : ""}`}
      >
        {children}
        {active ? (
          <span className="text-[10px]" aria-hidden>
            {dir === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function Td({
  children,
  alignRight,
}: {
  children: React.ReactNode;
  alignRight?: boolean;
}) {
  return (
    <td className={`px-3 py-2 align-top ${alignRight ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function hrefWithReturn(href: string, search: string): string {
  if (!search) return href;
  const params = new URLSearchParams();
  params.set("from", search);
  return `${href}?${params.toString()}`;
}
