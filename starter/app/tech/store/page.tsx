"use client";

import { useRef, useState } from "react";
import { ScanField, type ScanFieldHandle } from "@/components/ScanField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { ScanLog, type ScanLogEntry } from "@/components/ScanLog";
import { LocationFields } from "@/components/LocationFields";
import { AssetSummary } from "@/components/AssetSummary";
import { clientScans, fetchAsset } from "@/lib/client-scans";
import { ApiError } from "@/lib/api-client";
import { isAssetTag, emptyLocation } from "@/lib/locations";
import { tactileError, tactileSuccess } from "@/lib/scan-feedback";
import type { Asset, Location } from "@/lib/types";
import type { SideEffect } from "@/lib/scan-server";

type Phase = "scan_tag" | "loading_asset" | "scan_location" | "submitting";

export default function TechStorePage() {
  const [phase, setPhase] = useState<Phase>("scan_tag");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [location, setLocation] = useState<Location>(
    emptyLocation("Lab-Building-A"),
  );
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<{
    asset: Asset;
    message: string;
    sideEffects: SideEffect[];
  } | null>(null);
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const scanRef = useRef<ScanFieldHandle>(null);

  function reset(): void {
    setPhase("scan_tag");
    setAsset(null);
    setLocation(emptyLocation(location.site || "Lab-Building-A"));
    setError(null);
    // Refocus on next paint so the input is mounted before we grab focus.
    requestAnimationFrame(() => scanRef.current?.focus());
  }

  function recordSuccess(entry: {
    asset: Asset;
    message: string;
    sideEffects: SideEffect[];
  }): void {
    setSuccess(entry);
    setLog((l) => [
      {
        at: Date.now(),
        outcome: entry.sideEffects.some((s) => !s.ok) ? "warn" : "ok",
        asset_tag: entry.asset.asset_tag,
        message: entry.message,
        state: entry.asset.state,
      },
      ...l,
    ]);
    tactileSuccess();
    // Continuous-scan: success banner stays visible at the top, and the form
    // resets immediately so the next scan can begin without waiting.
    reset();
  }

  function recordError(err: unknown, asset_tag?: string): void {
    setError(err);
    tactileError();
    setLog((l) => [
      {
        at: Date.now(),
        outcome: "error",
        asset_tag,
        message: err instanceof Error ? err.message : "Scan failed",
      },
      ...l,
    ]);
  }

  async function handleTagScan(value: string): Promise<void> {
    if (!isAssetTag(value)) {
      recordError(
        new ApiError(
          400,
          "invalid_tag_format",
          `"${value}" isn't a valid tag.`,
        ),
        value,
      );
      return;
    }
    setError(null);
    setPhase("loading_asset");
    try {
      const a = await fetchAsset(value);
      setAsset(a);
      setPhase("scan_location");
      // Pre-fill site from the asset's last known location; saves time when
      // the tech is moving things within the same building.
      if (a.location.site) {
        setLocation((prev) => ({ ...prev, site: a.location.site }));
      }
    } catch (e) {
      setPhase("scan_tag");
      recordError(e, value);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!asset) return;
    if (!location.site) {
      setError(new ApiError(400, "invalid_location", "Site is required."));
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      const result = await clientScans.store({
        asset_tag: asset.asset_tag,
        location,
      });
      const wasInService = asset.state === "in_service";
      recordSuccess({
        asset: result.asset,
        message: wasInService ? "Stored — pulled from rack" : "Stored",
        sideEffects: result.side_effects,
      });
    } catch (e) {
      setPhase("scan_location");
      recordError(e, asset.asset_tag);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Store</h1>
        <p className="text-sm text-gray-600 mt-1">
          Move an asset into storage. From <code>in_service</code>, this also
          de-racks it in facilities.
        </p>
      </header>

      {success ? (
        <SuccessBanner
          asset={success.asset}
          message={success.message}
          sideEffects={success.sideEffects}
          onDismiss={() => setSuccess(null)}
        />
      ) : null}

      {phase === "scan_tag" || phase === "loading_asset" ? (
        <ScanField
          ref={scanRef}
          label="Scan the asset"
          placeholder="C0009001"
          hint="Esc clears. Continuous-scan: each successful store re-arms the input."
          disabled={phase === "loading_asset"}
          onScan={handleTagScan}
          onEscape={reset}
        />
      ) : null}

      {asset && phase !== "scan_tag" && phase !== "loading_asset" ? (
        <>
          <AssetSummary asset={asset} />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Storage location
            </h2>
            <LocationFields
              value={location}
              onChange={setLocation}
              requiredFields={["site"]}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={phase === "submitting"}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg min-h-[44px]"
            >
              {phase === "submitting" ? "Storing…" : "Record store"}
            </button>
            <button
              onClick={reset}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Different asset (Esc)
            </button>
          </div>
        </>
      ) : null}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <ScanLog entries={log} />
    </div>
  );
}
