"use client";

import { ApiError } from "@/lib/api-client";
import { guidanceForCode } from "@/lib/format";

export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: unknown;
  onDismiss?: () => void;
}) {
  if (!error) return null;

  let code = "unknown_error";
  let message = "Something unexpected happened.";
  let details: Record<string, unknown> | undefined;

  if (error instanceof ApiError) {
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
  }

  const guidance = guidanceForCode(code, details);

  return (
    <div
      role="alert"
      className="border border-red-200 bg-red-50 rounded-lg p-4 flex gap-3"
    >
      <div className="text-red-600 mt-0.5" aria-hidden>
        ⚠
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-red-900">{guidance}</div>
        <div className="text-xs text-red-700 mt-1 font-mono">
          {code} · {message}
        </div>
        {details ? (
          <div className="text-xs text-red-700 mt-2 space-y-0.5">
            {Object.entries(details).map(([k, v]) => (
              <div key={k}>
                <span className="text-red-500">{k}:</span>{" "}
                <span className="font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          onClick={onDismiss}
          className="text-red-700 text-sm self-start"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
