"use client";

// Caught when the manager route or any of its server fetches throws — most
// commonly: upstream API down, rate limit, or a network blip. Renders a
// non-stack-trace message and a retry button rather than the default Next.
export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-6 space-y-3">
      <div className="text-lg font-semibold text-red-900">
        Couldn&rsquo;t load the assets list.
      </div>
      <p className="text-sm text-red-800">
        Most likely the upstream API isn&rsquo;t answering. Try again in a few
        seconds; if it keeps failing, check that the API process is running.
      </p>
      <details className="text-xs text-red-700">
        <summary className="cursor-pointer">Error detail</summary>
        <code className="font-mono break-all">{error.message}</code>
        {error.digest ? (
          <div className="mt-1">
            digest: <code>{error.digest}</code>
          </div>
        ) : null}
      </details>
      <button
        type="button"
        onClick={reset}
        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md"
      >
        Try again
      </button>
    </div>
  );
}
