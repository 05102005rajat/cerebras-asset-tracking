"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Dev-only convenience: wipes the namespace and re-seeds in one click.
// Lives on the home page so a reviewer can begin a clean walkthrough
// without leaving the browser. The button asks for confirmation because
// the reset is destructive against any in-progress demo state.
export function DevResetButton() {
  const [state, setState] = useState<"idle" | "confirming" | "running" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function doReset(): Promise<void> {
    setState("running");
    setError(null);
    try {
      const res = await fetch("/api/upstream/reset", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `Reset failed: HTTP ${res.status}`,
        );
      }
      setState("ok");
      router.refresh();
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <div className="text-xs text-emerald-700">
        ✓ Namespace re-seeded — ~1,000 assets back to baseline.
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-xs text-red-700 space-y-1">
        <div>Reset failed: {error}</div>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div className="text-xs flex items-center gap-2">
        <span className="text-amber-800">Wipe state and re-seed?</span>
        <button
          type="button"
          onClick={doReset}
          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
        >
          Yes, reset
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="underline text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirming")}
      disabled={state === "running"}
      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      title="Wipe namespace and re-seed ~1,000 assets"
    >
      {state === "running" ? "Resetting…" : "Reset demo data"}
    </button>
  );
}
