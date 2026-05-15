import type { Event } from "@/lib/types";
import { EVENT_DOT, EVENT_LABEL, relativeTime, shortIso } from "@/lib/format";
import { formatLocation } from "@/lib/locations";

// Event log is the manager's main forensic tool. Newest first per the API
// contract. We render full timestamps in a tooltip and the event-type label
// up front; the location and user_id are below in smaller type so the
// scanning eye can hop down the time column.
export function EventTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No events yet. Once a tech scans this asset, it will appear here.
      </div>
    );
  }

  return (
    <ol className="relative pl-4 space-y-4">
      <div
        className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200"
        aria-hidden
      />
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-[10px] top-1.5 w-3 h-3 rounded-full ring-2 ring-white ${EVENT_DOT[e.event_type]}`}
            aria-hidden
          />
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-semibold text-sm text-gray-900">
              {EVENT_LABEL[e.event_type]}
              {e.from_state && e.from_state !== e.to_state ? (
                <span className="text-gray-500 font-normal text-xs ml-2">
                  {e.from_state} → {e.to_state}
                </span>
              ) : null}
            </div>
            <time
              dateTime={e.timestamp}
              title={shortIso(e.timestamp)}
              className="text-xs text-gray-500 flex-shrink-0"
            >
              {relativeTime(e.timestamp)}
            </time>
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            <span className="font-mono">{e.user_id}</span>
            {e.to_location.site ? (
              <>
                {" · "}
                {formatLocation(e.to_location)}
              </>
            ) : null}
            {e.scan_payload &&
            e.scan_payload !== e.asset_tag &&
            e.event_type !== "transfer_custody" ? (
              <>
                {" · "}
                <span className="font-mono text-gray-400">
                  scan: {e.scan_payload}
                </span>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
