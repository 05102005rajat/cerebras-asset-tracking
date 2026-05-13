import type {
  ApiErrorBody,
  Asset,
  AssetListFilters,
  DeployScanInput,
  Event,
  FacilitiesRecord,
  FacilitiesUpdate,
  FinanceRecord,
  FinanceUpdate,
  ReceiveScanInput,
  StoreScanInput,
  TransferScanInput,
} from "./types.js";

// In the browser, the default client talks to the same-origin proxy at
// /api/upstream — the bearer token stays server-side.
//
// On the server (route handlers, RSCs), the default client talks directly to
// the upstream API using API_BASE_URL and API_TOKEN.
const BROWSER_BASE = "/api/upstream";
const SERVER_DEFAULT_BASE = "http://localhost:8080/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ClientConfig = {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

function isServer(): boolean {
  return typeof window === "undefined";
}

function getBaseUrl(cfg: ClientConfig): string {
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/$/, "");
  if (isServer()) {
    return (process.env.API_BASE_URL ?? SERVER_DEFAULT_BASE).replace(/\/$/, "");
  }
  return BROWSER_BASE;
}

function getToken(cfg: ClientConfig): string | null {
  if (cfg.token) return cfg.token;
  if (isServer()) return process.env.API_TOKEN ?? null;
  // Browser doesn't carry a token — the proxy attaches it.
  return null;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  cfg: ClientConfig,
  body?: unknown,
): Promise<T> {
  const url = `${getBaseUrl(cfg)}${path}`;
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const token = getToken(cfg);

  if (isServer() && !token) {
    throw new Error(
      "Missing API_TOKEN. Set it in starter/.env (server-only — do not use NEXT_PUBLIC_).",
    );
  }

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetchImpl(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errBody = json as ApiErrorBody | null;
    const code = errBody?.error?.code ?? "unknown_error";
    const message = errBody?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message, errBody?.error?.details);
  }

  return json as T;
}

async function rawGet<T>(absoluteUrl: string, cfg: ClientConfig): Promise<T> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const res = await fetchImpl(absoluteUrl, { cache: "no-store" });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, "http_error", `HTTP ${res.status}`);
  }
  return json as T;
}

export function createApiClient(cfg: ClientConfig = {}) {
  return {
    health: () => {
      // /health is sibling to /v1 at the upstream root. In the browser we
      // proxy through /api/upstream — so just hit /api/upstream/health.
      if (isServer()) {
        const base = getBaseUrl(cfg);
        const url = base.replace(/\/v1$/, "") + "/health";
        return rawGet<{ ok: true; version: string }>(url, cfg);
      }
      return request<{ ok: true; version: string }>("GET", "/health", cfg);
    },
    assets: {
      list: (filters: AssetListFilters = {}) => {
        const qs = new URLSearchParams();
        if (filters.state) qs.set("state", String(filters.state));
        if (filters.site) qs.set("site", filters.site);
        if (filters.custodian) qs.set("custodian", filters.custodian);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return request<Asset[]>("GET", `/assets${suffix}`, cfg);
      },
      get: (tag: string) => request<Asset>("GET", `/assets/${tag}`, cfg),
      history: (tag: string) =>
        request<Event[]>("GET", `/assets/${tag}/events`, cfg),
    },
    scans: {
      receive: (input: ReceiveScanInput) =>
        request<Asset>("POST", "/scans/receive", cfg, input),
      store: (input: StoreScanInput) =>
        request<Asset>("POST", "/scans/store", cfg, input),
      deploy: (input: DeployScanInput) =>
        request<Asset>("POST", "/scans/deploy", cfg, input),
      transfer: (input: TransferScanInput) =>
        request<Asset>("POST", "/scans/transfer", cfg, input),
    },
    mock: {
      facilities: () =>
        request<FacilitiesRecord[]>("GET", "/mock/facilities/spaces", cfg),
      finance: () =>
        request<FinanceRecord[]>("GET", "/mock/finance/equipment", cfg),
      updateFacilities: (input: FacilitiesUpdate) =>
        request<{ ok: true }>("POST", "/mock/facilities/spaces", cfg, input),
      updateFinance: (input: FinanceUpdate) =>
        request<{ ok: true }>("POST", "/mock/finance/equipment", cfg, input),
    },
    reset: () =>
      request<{ ok: true; reseeded_at: string }>("POST", "/reset", cfg),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient();
