"use client";

import { StateBadge } from "./StateBadge";
import type { AssetState } from "@/lib/types";

export type ScanLogEntry = {
  at: number;
  outcome: "ok" | "warn" | "error";
  asset_tag?: string;
  message: string;
  state?: AssetState;
};

// Persistent session log so the tech can look back over the last few scans
// without losing focus on the input. Shown below the active form.
export function ScanLog({ entries }: { entries: ScanLogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
        Recent scans
      </h3>
      <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
        {entries.slice(0, 8).map((e) => (
          <li
            key={e.at}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                e.outcome === "ok"
                  ? "bg-emerald-500"
                  : e.outcome === "warn"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              aria-hidden
            />
            {e.asset_tag ? (
              <span className="font-mono text-xs text-gray-700 w-20 flex-shrink-0">
                {e.asset_tag}
              </span>
            ) : null}
            <span className="flex-1 text-gray-700 truncate">{e.message}</span>
            {e.state ? <StateBadge state={e.state} /> : null}
            <span className="text-xs text-gray-400 flex-shrink-0">
              {timeAgo(e.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.round(min / 60)}h`;
}
