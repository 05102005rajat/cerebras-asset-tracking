import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api-client";
import { reconcile } from "@/lib/reconcile";
import { reportToCsv } from "@/lib/csv";

// Sibling to /api/reconcile but returns text/csv with a Content-Disposition
// header so the browser downloads the file. Manager runs the report on
// Monday morning, clicks "Export", emails the .csv to procurement.
export async function GET(): Promise<Response> {
  try {
    const [assets, facilities, finance] = await Promise.all([
      api.assets.list({}),
      api.mock.facilities(),
      api.mock.finance(),
    ]);
    const report = reconcile(assets, facilities, finance);
    const csv = reportToCsv(report);

    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reconcile-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: e.status },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: e instanceof Error ? e.message : "CSV export failed",
        },
      },
      { status: 500 },
    );
  }
}
