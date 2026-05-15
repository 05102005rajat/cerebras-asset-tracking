import Link from "next/link";

// Headline a manager sees on the list page: "you have N things to look at,
// here's where to start." Keeps the dashboard from being a wall of rows
// without a hint of where the actual work is.
export function DriftTopline({
  needsAction,
  watch,
  generatedAt,
}: {
  needsAction: number;
  watch: number;
  generatedAt: string;
}) {
  if (needsAction === 0 && watch === 0) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-sm text-emerald-900 flex items-center justify-between">
        <span>All three systems agree. Last checked just now.</span>
        <Link
          href="/manager/reconcile"
          className="text-emerald-800 underline text-xs"
        >
          Open report →
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start justify-between gap-4">
      <div>
        <div className="font-semibold text-amber-900">
          {needsAction.toLocaleString()} item{needsAction === 1 ? "" : "s"} need
          investigation
          {watch > 0
            ? `, ${watch.toLocaleString()} more to watch`
            : ""}
          .
        </div>
        <div className="text-xs text-amber-800 mt-0.5">
          Where ops, facilities, and finance disagree. Refreshed live each open.
        </div>
      </div>
      <Link
        href="/manager/reconcile"
        className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-md whitespace-nowrap"
      >
        Open report →
      </Link>
    </div>
  );
}
