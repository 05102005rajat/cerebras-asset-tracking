import type { AssetState, EventType } from "./types";

export const STATE_LABEL: Record<AssetState, string> = {
  unreceived: "Unreceived",
  received: "Received",
  stored: "Stored",
  in_service: "In service",
  rma_pending: "RMA pending",
  disposed: "Disposed",
};

// Tailwind class strings, kept verbose so the JIT picks them up at build time.
export const STATE_BADGE: Record<AssetState, string> = {
  unreceived: "bg-gray-100 text-gray-700 ring-gray-200",
  received: "bg-blue-50 text-blue-800 ring-blue-200",
  stored: "bg-amber-50 text-amber-800 ring-amber-200",
  in_service: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rma_pending: "bg-orange-50 text-orange-800 ring-orange-200",
  disposed: "bg-zinc-200 text-zinc-700 ring-zinc-300",
};

export const EVENT_LABEL: Record<EventType, string> = {
  receive: "Received",
  store: "Stored",
  deploy: "Deployed",
  rma_open: "Sent to RMA",
  rma_receive_back: "Returned from RMA",
  dispose: "Disposed",
  duplicate_receive: "Duplicate receive",
  transfer_custody: "Custody transferred",
};

export const EVENT_DOT: Record<EventType, string> = {
  receive: "bg-blue-500",
  store: "bg-amber-500",
  deploy: "bg-emerald-500",
  rma_open: "bg-orange-500",
  rma_receive_back: "bg-blue-400",
  dispose: "bg-zinc-500",
  duplicate_receive: "bg-gray-300",
  transfer_custody: "bg-violet-500",
};

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.round((t - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RTF.format(diffSec, "second");
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365)
    return RTF.format(Math.round(diffSec / (86400 * 30)), "month");
  return RTF.format(Math.round(diffSec / (86400 * 365)), "year");
}

export function shortIso(iso: string): string {
  // 2026-05-08T03:00:00Z → 2026-05-08 03:00 UTC
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

// Human-readable error guidance per API error code. Generic fallback for the
// long tail. Phrased as the next physical action the tech should take.
export function guidanceForCode(
  code: string,
  details?: Record<string, unknown>,
): string {
  switch (code) {
    case "and_match_failed": {
      const existing = details?.["existing_serial"];
      return existing
        ? `Tag is already on file with serial ${String(
            existing,
          )}. Compare against the unit in your hand — if they're different units, get a new tag.`
        : "Tag is already on file with a different serial. Get a new tag.";
    }
    case "invalid_transition":
      return "This asset isn't in a state that allows this scan. Check the current state below and pick the right workflow.";
    case "incomplete_deploy_location":
      return "Deploy needs site, room, rack, and RU. Fill in the missing field(s) and re-scan.";
    case "invalid_location":
      return "The scanned location is malformed. Try scanning the location label again.";
    case "invalid_tag_format":
      return "Tag must look like C followed by 7 digits (e.g. C0009001). Re-scan or check the label.";
    case "unknown_asset":
      return "No asset on file with that tag. Check the label, or run /tech/receive first.";
    case "same_custodian":
      return "This asset is already in your custody. Hand it off to someone else, or skip the transfer.";
    case "rate_limited":
      return "Slow down — the API is rate-limiting. Try again in a few seconds.";
    case "wrong_scan_type_location":
      return "You scanned a location label where the asset tag goes. Scan the asset's tag (Cxxxxxxx), then the location below.";
    case "wrong_scan_type_badge":
      return "You scanned a badge where the asset tag goes. Badges go in the second step of /tech/transfer.";
    default:
      return "Something went wrong. Try the scan again. If it keeps failing, flag it to your manager.";
  }
}
