import Link from "next/link";
import type { Asset } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { formatLocation } from "@/lib/locations";
import { relativeTime, shortIso } from "@/lib/format";

// Manager's primary view. Columns chosen for the 8:55am pre-standup glance:
// tag, identity, state, custodian, where it sits, and how recently it moved.
// We intentionally hide procurement_note and parent_asset_tag — they're rarely
// what the manager came to see, and they make the table noisy.
export function AssetTable({ assets }: { assets: Asset[] }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <Th>Tag</Th>
            <Th>Model</Th>
            <Th>State</Th>
            <Th>Custodian</Th>
            <Th>Location</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map((a) => (
            <tr
              key={a.asset_tag}
              className="hover:bg-blue-50/40 cursor-pointer"
            >
              <Td>
                <Link
                  href={`/manager/assets/${a.asset_tag}`}
                  className="font-mono text-blue-700 hover:underline"
                >
                  {a.asset_tag}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/manager/assets/${a.asset_tag}`}
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
              <Td>
                <span
                  className="text-xs text-gray-500"
                  title={shortIso(a.updated_at)}
                >
                  {relativeTime(a.updated_at)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-left text-xs font-semibold uppercase tracking-wide px-3 py-2"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
