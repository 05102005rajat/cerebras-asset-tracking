import { NextRequest, NextResponse } from "next/server";
import { ApiError, api } from "@/lib/api-client";
import { performStore } from "@/lib/scan-server";
import { getServerUserId } from "@/lib/server-auth";
import type { StoreScanInput } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Omit<
      StoreScanInput,
      "user_id" | "scan_payload"
    > & { scan_payload?: string };
    const user_id = await getServerUserId();

    // Need the prior state to know whether this is a de-rack (in_service →
    // stored) which triggers a facilities null write.
    let priorState: string | null = null;
    try {
      const prior = await api.assets.get(body.asset_tag);
      priorState = prior.state;
    } catch {
      // If the asset doesn't exist the upstream POST will reject with
      // unknown_asset and the UI shows that — no need to second-guess.
    }

    const result = await performStore(
      {
        ...body,
        user_id,
        scan_payload: body.scan_payload ?? body.asset_tag,
      },
      priorState,
    );
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): NextResponse {
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
        message: e instanceof Error ? e.message : "Unknown error",
      },
    },
    { status: 500 },
  );
}
