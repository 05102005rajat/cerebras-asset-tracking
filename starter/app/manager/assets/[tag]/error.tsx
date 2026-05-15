"use client";

import Link from "next/link";

export default function AssetDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Link
        href="/manager"
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        ← Back to assets
      </Link>
      <div className="border border-red-200 bg-red-50 rounded-lg p-6 space-y-3">
        <div className="text-lg font-semibold text-red-900">
          Couldn&rsquo;t load this asset.
        </div>
        <p className="text-sm text-red-800">
          Lookup or event-log fetch failed. Try again, or open the asset list
          and click through fresh.
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
    </div>
  );
}
