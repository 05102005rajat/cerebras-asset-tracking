import type { AssetState } from "@/lib/types";
import { STATE_BADGE, STATE_LABEL } from "@/lib/format";

export function StateBadge({
  state,
  className = "",
}: {
  state: AssetState;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${STATE_BADGE[state]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATE_LABEL[state]}
    </span>
  );
}
