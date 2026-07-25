import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy to the upstream API. The bearer token is read from
// API_TOKEN on the server and attached here, so it never reaches the browser.
//
// Anything the browser hits at /api/upstream/<...> goes to API_BASE_URL/<...>
// with Authorization set. Headers, query strings, request bodies, and the
// upstream status code are passed through unchanged.

const UPSTREAM = (process.env.API_BASE_URL ?? "http://localhost:8080/v1").replace(/\/$/, "");
// /health is a sibling of /v1 at the upstream root (see api/src/routes/utility.ts),
// not nested under it. Every other path is joined under UPSTREAM as-is.
const UPSTREAM_ROOT = UPSTREAM.replace(/\/v1$/, "");

function missingToken(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "missing_token",
        message:
          "API_TOKEN is not set on the server. Edit starter/.env (see .env.example) and restart.",
      },
    },
    { status: 500 },
  );
}

async function forward(req: NextRequest, segments: string[]): Promise<Response> {
  const token = process.env.API_TOKEN;
  if (!token) return missingToken();

  const path = segments.join("/");
  const search = req.nextUrl.search ?? "";
  const base = path === "health" ? UPSTREAM_ROOT : UPSTREAM;
  const url = `${base}/${path}${search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(url, init);
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return forward(req, path);
}
