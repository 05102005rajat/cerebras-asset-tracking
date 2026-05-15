import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api-client";
import { performReceive } from "@/lib/scan-server";
import { getServerUserId } from "@/lib/server-auth";
import type { ReceiveScanInput } from "@/lib/types";

// Server-side scan handlers exist for two reasons:
//   1. They give a single place to orchestrate the upstream scan + the
//      facilities/finance write-backs as one logical step the UI can render
//      with one progress indicator and one error surface.
//   2. The user_id stays server-resolved from the cookie. Browser code never
//      gets to forge a custodian.
//
// The wire shape is kept thin — same body the API expects minus user_id and
// scan_payload, both of which we fill in here.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Omit<
      ReceiveScanInput,
      "user_id" | "scan_payload"
    > & { scan_payload?: string };
    const user_id = await getServerUserId();
    const result = await performReceive({
      ...body,
      user_id,
      scan_payload: body.scan_payload ?? body.asset_tag,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      {
        error: { code: e.code, message: e.message, details: e.details },
      },
      { status: e.status },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    },
    { status: 500 },
  );
}
