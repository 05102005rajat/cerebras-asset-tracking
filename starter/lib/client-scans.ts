"use client";

import type { ScanResult } from "./scan-server";
import type {
  Asset,
  DeployScanInput,
  ReceiveScanInput,
  StoreScanInput,
  TransferScanInput,
} from "./types";
import { ApiError } from "./api-client";

// Browser-side wrappers that hit the orchestrating server routes (NOT the
// raw upstream proxy). The server route attaches the user_id from the cookie
// and runs the facilities/finance writes after a successful scan.
async function postScan<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const errBody = (json ?? {}) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    throw new ApiError(
      res.status,
      errBody.error?.code ?? "unknown_error",
      errBody.error?.message ?? `HTTP ${res.status}`,
      errBody.error?.details,
    );
  }
  return json as T;
}

export type ClientReceiveInput = Omit<
  ReceiveScanInput,
  "user_id" | "scan_payload"
> & { scan_payload?: string };

export type ClientStoreInput = Omit<
  StoreScanInput,
  "user_id" | "scan_payload"
> & { scan_payload?: string };

export type ClientDeployInput = Omit<
  DeployScanInput,
  "user_id" | "scan_payload"
> & { scan_payload?: string };

export type ClientTransferInput = Omit<
  TransferScanInput,
  "user_id" | "scan_payload"
> & { scan_payload?: string };

export const clientScans = {
  receive: (input: ClientReceiveInput) =>
    postScan<ScanResult>("/api/scans/receive", input),
  store: (input: ClientStoreInput) =>
    postScan<ScanResult>("/api/scans/store", input),
  deploy: (input: ClientDeployInput) =>
    postScan<ScanResult>("/api/scans/deploy", input),
  transfer: (input: ClientTransferInput) =>
    postScan<ScanResult>("/api/scans/transfer", input),
};

export async function fetchAsset(tag: string): Promise<Asset> {
  const res = await fetch(`/api/upstream/assets/${tag}`, { cache: "no-store" });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const errBody = (json ?? {}) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    throw new ApiError(
      res.status,
      errBody.error?.code ?? "unknown_error",
      errBody.error?.message ?? `HTTP ${res.status}`,
      errBody.error?.details,
    );
  }
  return json as Asset;
}

export async function resetNamespace(): Promise<void> {
  await fetch("/api/upstream/reset", { method: "POST" });
}
