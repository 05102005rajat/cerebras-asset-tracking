"use client";

import { useEffect, useRef, useState } from "react";
import { ScanField } from "@/components/ScanField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { ScanLog, type ScanLogEntry } from "@/components/ScanLog";
import { AssetSummary } from "@/components/AssetSummary";
import { clientScans, fetchAsset } from "@/lib/client-scans";
import { ApiError } from "@/lib/api-client";
import {
  isAssetTag,
  isBadgePayload,
  parseBadgePayload,
} from "@/lib/locations";
import { getCurrentUserId } from "@/lib/auth";
import type { Asset } from "@/lib/types";
import type { SideEffect } from "@/lib/scan-server";

type Phase = "scan_asset" | "loading_asset" | "scan_badge" | "submitting";

export default function TechTransferPage() {
  const [phase, setPhase] = useState<Phase>("scan_asset");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<{
    asset: Asset;
    message: string;
    sideEffects: SideEffect[];
  } | null>(null);
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [me, setMe] = useState<string>("");
  const successTimer = useRef<number | null>(null);

  useEffect(() => {
    setMe(getCurrentUserId());
    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  function reset(): void {
    setPhase("scan_asset");
    setAsset(null);
    setError(null);
  }

  function flashSuccess(entry: {
    asset: Asset;
    message: string;
    sideEffects: SideEffect[];
  }) {
    setSuccess(entry);
    setLog((l) => [
      {
        at: Date.now(),
        outcome: "ok",
        asset_tag: entry.asset.asset_tag,
        message: entry.message,
        state: entry.asset.state,
      },
      ...l,
    ]);
    if (successTimer.current) window.clearTimeout(successTimer.current);
    successTimer.current = window.setTimeout(() => {
      setSuccess(null);
      reset();
    }, 4000);
  }

  async function handleAssetScan(value: string): Promise<void> {
    if (!isAssetTag(value)) {
      setError(
        new ApiError(400, "invalid_tag_format", `"${value}" isn't a tag.`),
      );
      return;
    }
    setError(null);
    setPhase("loading_asset");
    try {
      const a = await fetchAsset(value);
      setAsset(a);
      setPhase("scan_badge");
    } catch (e) {
      setError(e);
      setPhase("scan_asset");
    }
  }

  async function handleBadgeScan(value: string): Promise<void> {
    if (!asset) return;
    let badge = value;
    if (isBadgePayload(value)) {
      const parsed = parseBadgePayload(value);
      if (!parsed) {
        setError(
          new ApiError(
            400,
            "invalid_badge",
            "Badge code is malformed. Expected BADGE|user-id.",
          ),
        );
        return;
      }
      badge = parsed;
    }

    if (badge === me) {
      setError(
        new ApiError(
          422,
          "self_transfer",
          "You scanned your own badge. Scan the receiving tech's badge.",
        ),
      );
      return;
    }

    setPhase("submitting");
    setError(null);
    try {
      const result = await clientScans.transfer({
        asset_tag: asset.asset_tag,
        to_custodian: badge,
      });
      flashSuccess({
        asset: result.asset,
        message: `Custody → ${badge}`,
        sideEffects: result.side_effects,
      });
    } catch (e) {
      setError(e);
      setPhase("scan_badge");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Transfer custody</h1>
        <p className="text-sm text-gray-600 mt-1">
          You&rsquo;re the &ldquo;from&rdquo; side ({me || "…"}). Scan the
          asset, then scan the receiving tech&rsquo;s badge.
        </p>
      </header>

      {success ? (
        <SuccessBanner
          asset={success.asset}
          message={success.message}
          sideEffects={success.sideEffects}
        />
      ) : null}

      {phase === "scan_asset" || phase === "loading_asset" ? (
        <ScanField
          label="1. Scan the asset"
          placeholder="C0009001"
          disabled={phase === "loading_asset"}
          onScan={handleAssetScan}
        />
      ) : null}

      {asset && (phase === "scan_badge" || phase === "submitting") ? (
        <>
          <AssetSummary asset={asset} />
          <ScanField
            label="2. Scan the receiving tech's badge"
            placeholder="BADGE|tech-mike or just tech-mike"
            hint="Badge can be scanned or typed."
            disabled={phase === "submitting"}
            onScan={handleBadgeScan}
          />
          <button
            onClick={reset}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Different asset
          </button>
        </>
      ) : null}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <ScanLog entries={log} />
    </div>
  );
}
