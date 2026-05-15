"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { STATE_LABEL } from "@/lib/format";
import type { AssetState } from "@/lib/types";

const KEYS_WITH_LABELS: Record<string, string> = {
  q: "search",
  state: "state",
  site: "site",
  custodian: "custodian",
};

// Active filters as removable chips above the table. Cuts the cost of
// "what filters do I have on?" — the chip *is* the answer and the X is the
// fix. Pure presentation: state lives in the URL, filter component reads
// the same searchParams.
export function FilterChips() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active: Array<{ key: string; label: string; value: string }> = [];
  for (const [key, label] of Object.entries(KEYS_WITH_LABELS)) {
    const v = searchParams.get(key);
    if (!v) continue;
    const display =
      key === "state" ? STATE_LABEL[v as AssetState] ?? v : v;
    active.push({ key, label, value: display });
  }

  if (active.length === 0) return null;

  function remove(key: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll(): void {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => remove(f.key)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-100 text-blue-900 rounded-full hover:bg-blue-200"
          aria-label={`Remove ${f.label} filter`}
        >
          <span className="text-blue-700">{f.label}:</span>
          <span className="font-medium">{f.value}</span>
          <span className="text-blue-700" aria-hidden>×</span>
        </button>
      ))}
      <button
        onClick={clearAll}
        className="text-xs text-gray-600 underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
