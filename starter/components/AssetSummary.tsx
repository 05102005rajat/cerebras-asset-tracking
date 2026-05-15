import type { Asset } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { formatLocation } from "@/lib/locations";

// Compact card a tech sees right after they scan a tag, BEFORE committing the
// next step. Shows what the system thinks today so the tech can catch
// "this isn't where it's supposed to be" before the scan goes through.
export function AssetSummary({ asset }: { asset: Asset }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm text-gray-500">
            {asset.asset_tag}
          </div>
          <div className="font-semibold text-gray-900 mt-0.5 truncate">
            {asset.model}
          </div>
          <div className="text-xs text-gray-500">
            {asset.manufacturer} · {asset.serial}
          </div>
        </div>
        <StateBadge state={asset.state} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-gray-500">Custodian</dt>
        <dd className="text-gray-900 font-mono text-xs">{asset.custodian}</dd>
        <dt className="text-gray-500">Last location</dt>
        <dd className="text-gray-900 text-xs">{formatLocation(asset.location)}</dd>
      </dl>
    </div>
  );
}
