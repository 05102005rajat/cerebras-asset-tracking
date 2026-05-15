import type { Asset } from "@/lib/types";
import type { SideEffect } from "@/lib/scan-server";
import { StateBadge } from "./StateBadge";

// Big confirmation block. Shown for ~4s after a successful scan, then auto-
// fades. We keep the asset summary and side-effect log visible so the tech
// can verify the write went where they expected.
export function SuccessBanner({
  asset,
  message,
  sideEffects,
}: {
  asset: Asset;
  message: string;
  sideEffects: SideEffect[];
}) {
  const anyFailed = sideEffects.some((s) => !s.ok);

  return (
    <div
      className={`border rounded-lg p-4 ${
        anyFailed
          ? "border-amber-300 bg-amber-50"
          : "border-emerald-300 bg-emerald-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`text-2xl ${anyFailed ? "text-amber-700" : "text-emerald-700"}`}
          aria-hidden
        >
          {anyFailed ? "⚠" : "✓"}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{message}</div>
          <div className="text-sm text-gray-600 mt-0.5">
            <span className="font-mono">{asset.asset_tag}</span> · {asset.model}
          </div>
        </div>
        <StateBadge state={asset.state} />
      </div>
      {sideEffects.length > 0 ? (
        <ul className="mt-3 text-xs space-y-1">
          {sideEffects.map((s, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 ${s.ok ? "text-emerald-800" : "text-red-800"}`}
            >
              <span aria-hidden>{s.ok ? "✓" : "✗"}</span>
              <span className="font-medium">{s.system}:</span>
              <span>{s.action}</span>
              {s.error ? (
                <span className="font-mono text-red-700">— {s.error}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
