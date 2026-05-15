"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Page-based pagination. The API returns the full filtered list (small
// enough at ~1k rows), so we slice client-side. Real systems would push
// pagination to the API; this is a deliberate simplification.
export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function go(to: number): void {
    const next = Math.max(1, Math.min(totalPages, to));
    const params = new URLSearchParams(searchParams.toString());
    if (next === 1) params.delete("page");
    else params.set("page", String(next));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center justify-between text-sm text-gray-600 px-1">
      <div>
        {total === 0
          ? "No assets match these filters."
          : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => go(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="px-3 text-xs">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => go(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
