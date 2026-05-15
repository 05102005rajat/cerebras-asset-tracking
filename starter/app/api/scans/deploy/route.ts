import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api-client";
import { performDeploy } from "@/lib/scan-server";
import { getServerUserId } from "@/lib/server-auth";
import type { DeployScanInput } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Omit<
      DeployScanInput,
      "user_id" | "scan_payload"
    > & { scan_payload?: string };
    const user_id = await getServerUserId();
    const result = await performDeploy({
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
