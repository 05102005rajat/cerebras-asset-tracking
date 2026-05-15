import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api-client";
import { reconcile } from "@/lib/reconcile";

// Joins ops/facilities/finance and returns a categorized report. The page at
// /manager/reconcile fetches this and renders it; the page itself does no
// joining, so we can test the classifier (lib/reconcile.ts) in isolation.
//
// Lives server-side because (a) the upstream bearer token never reaches the
// browser, and (b) holding the join in one place makes "what changed in the
// report?" answerable by re-running this route in tests.
export async function GET(): Promise<NextResponse> {
  try {
    const [assets, facilities, finance] = await Promise.all([
      api.assets.list({}),
      api.mock.facilities(),
      api.mock.finance(),
    ]);
    const report = reconcile(assets, facilities, finance);
    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, details: e.details } },
        { status: e.status },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message:
            e instanceof Error
              ? e.message
              : "Failed to assemble reconciliation report",
        },
      },
      { status: 500 },
    );
  }
}
