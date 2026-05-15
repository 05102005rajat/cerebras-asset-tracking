"use client";

export default function ReconcileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-6 space-y-3">
      <div className="text-lg font-semibold text-red-900">
        Couldn&rsquo;t build the reconciliation report.
      </div>
      <p className="text-sm text-red-800">
        We pull from ops, facilities, and finance to assemble this page. One
        of them didn&rsquo;t answer. The seam in our code that does the join
        is at <code>app/api/reconcile/route.ts</code> — check the API process
        is up and try again.
      </p>
      <details className="text-xs text-red-700">
        <summary className="cursor-pointer">Error detail</summary>
        <code className="font-mono break-all">{error.message}</code>
      </details>
      <button
        type="button"
        onClick={reset}
        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md"
      >
        Retry
      </button>
    </div>
  );
}
