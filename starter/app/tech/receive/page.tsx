"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScanField, type ScanFieldHandle } from "@/components/ScanField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { ScanLog, type ScanLogEntry } from "@/components/ScanLog";
import { LocationFields } from "@/components/LocationFields";
import { StateBadge } from "@/components/StateBadge";
import { clientScans, fetchAsset } from "@/lib/client-scans";
import { ApiError } from "@/lib/api-client";
import { emptyLocation } from "@/lib/locations";
import { validateAssetTagScan } from "@/lib/tag-validate";
import { tactileError, tactileSuccess } from "@/lib/scan-feedback";
import type { AssetClass, Asset, Location } from "@/lib/types";
import type { SideEffect } from "@/lib/scan-server";

const CLASSES: AssetClass[] = [
  "instrument",
  "compute",
  "network",
  "power",
  "consumable_durable",
];

type Phase = "scan_tag" | "loading_asset" | "fill_intake" | "submitting";

// Suspense wrapper is required by Next 15's static prerender — useSearchParams
// triggers a CSR bailout that needs a boundary. The inner page is where the
// real logic lives.
export default function TechReceivePage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
      <ReceiveInner />
    </Suspense>
  );
}

// Receive flow:
//   1. Scan the asset tag.
//   2. Look it up. If it's known, prefill serial/model/manufacturer/class
//      from the existing record so the tech only confirms — re-typing every
//      field on a duplicate scan is friction the tech will skip around.
//   3. Tech confirms or edits, submits. The API decides whether to log a
//      duplicate_receive (matching serial), reject (mismatching serial),
//      or create (new tag).
function ReceiveInner() {
  const [phase, setPhase] = useState<Phase>("scan_tag");
  const [tag, setTag] = useState<string>("");
  const [knownAsset, setKnownAsset] = useState<Asset | null>(null);
  const [serial, setSerial] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [manufacturer, setManufacturer] = useState<string>("");
  const [assetClass, setAssetClass] = useState<AssetClass>("instrument");
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

  // Deep-link entry: /tech/receive?tag=C0000199 lands the tech right on the
  // intake form (after a one-time lookup) — the reconcile page sends ghosts
  // here so the manager's "resolve" click skips the scan step.
  const searchParams = useSearchParams();
  useEffect(() => {
    const fromUrl = searchParams.get("tag");
    if (fromUrl && phase === "scan_tag") {
      handleTagScan(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset(): void {
    setPhase("scan_tag");
    setTag("");
    setKnownAsset(null);
    setSerial("");
    setModel("");
    setManufacturer("");
    setAssetClass("instrument");
    setLocation(emptyLocation(location.site || "Lab-Building-A"));
    setError(null);
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
        outcome: "ok",
        asset_tag: entry.asset.asset_tag,
        message: entry.message,
        state: entry.asset.state,
      },
      ...l,
    ]);
    tactileSuccess();
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
        message: err instanceof Error ? err.message : "Receive failed",
      },
      ...l,
    ]);
  }

  async function handleTagScan(value: string): Promise<void> {
    const validationError = validateAssetTagScan(value);
    if (validationError) {
      recordError(validationError, value);
      return;
    }
    setError(null);
    setTag(value);
    setPhase("loading_asset");

    // Probe the upstream. If the tag is known, prefill from it; if it's
    // unknown (404), the form starts empty and we go straight to intake.
    try {
      const existing = await fetchAsset(value);
      setKnownAsset(existing);
      setSerial(existing.serial);
      setModel(existing.model);
      setManufacturer(existing.manufacturer);
      setAssetClass(existing.asset_class);
      if (existing.location.site) {
        setLocation((prev) => ({ ...prev, site: existing.location.site }));
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "unknown_asset") {
        // Brand-new tag — that's the common path. Nothing to prefill.
        setKnownAsset(null);
      } else {
        setPhase("scan_tag");
        recordError(e, value);
        return;
      }
    }
    setPhase("fill_intake");
  }

  async function handleSubmit(): Promise<void> {
    if (!tag) return;
    if (!serial || !model || !manufacturer) {
      setError(
        new ApiError(
          400,
          "missing_fields",
          "Serial, model, and manufacturer are required.",
        ),
      );
      return;
    }
    if (!location.site) {
      setError(new ApiError(400, "invalid_location", "Site is required."));
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      const result = await clientScans.receive({
        asset_tag: tag,
        serial,
        model,
        manufacturer,
        asset_class: assetClass,
        location,
      });
      const message = knownAsset
        ? "Duplicate receive logged"
        : "Receive recorded";
      recordSuccess({
        asset: result.asset,
        message,
        sideEffects: result.side_effects,
      });
    } catch (e) {
      setPhase("fill_intake");
      recordError(e, tag);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Receive</h1>
        <p className="text-sm text-gray-600 mt-1">
          New tag → enter serial &amp; model. Same tag &amp; serial →
          we&rsquo;ll log a duplicate. Same tag, different serial → that&rsquo;s
          a problem and you&rsquo;ll see it.
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
          label="Scan the asset tag"
          placeholder="C0009001"
          hint="Code 128 or QR. Esc clears. Continuous-scan: each commit re-arms the input."
          disabled={phase === "loading_asset"}
          onScan={handleTagScan}
          onEscape={reset}
        />
      ) : (
        <div className="space-y-4">
          {knownAsset ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-blue-900 font-semibold uppercase tracking-wide">
                  Tag already on file
                </div>
                <div className="text-sm text-blue-900 mt-1">
                  Fields prefilled from the existing record. If the unit in
                  your hand matches, just hit submit and we&rsquo;ll log a
                  duplicate. If the serial is different, edit it and we&rsquo;ll
                  surface the conflict.
                </div>
              </div>
              <StateBadge state={knownAsset.state} />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-3 text-xs text-gray-600">
              Brand-new tag. Fill in the intake details.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 bg-gray-100 rounded-lg p-3">
            <div>
              <div className="text-xs text-gray-500">Receiving</div>
              <div className="font-mono text-sm font-semibold">{tag}</div>
            </div>
            <button
              onClick={reset}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Different tag (Esc)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Serial"
              required
              value={serial}
              onChange={setSerial}
              placeholder="SN-…"
              changedFromKnown={knownAsset ? serial !== knownAsset.serial : false}
            />
            <Field
              label="Model"
              required
              value={model}
              onChange={setModel}
              placeholder="Genomics Sequencer 2000"
              changedFromKnown={knownAsset ? model !== knownAsset.model : false}
            />
            <Field
              label="Manufacturer"
              required
              value={manufacturer}
              onChange={setManufacturer}
              placeholder="BioSystems Inc"
              changedFromKnown={
                knownAsset ? manufacturer !== knownAsset.manufacturer : false
              }
            />
            <label className="block">
              <span className="block text-xs font-medium text-gray-700 mb-1">
                Class <span className="text-red-600">*</span>
              </span>
              <select
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full px-3 py-2 min-h-[44px] rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Intake location
            </h2>
            <LocationFields
              value={location}
              onChange={setLocation}
              requiredFields={["site"]}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={phase === "submitting"}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg min-h-[44px]"
          >
            {phase === "submitting"
              ? "Receiving…"
              : knownAsset
                ? "Confirm duplicate"
                : "Record receive"}
          </button>
        </div>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <ScanLog entries={log} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  changedFromKnown,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  required?: boolean;
  // Visual cue when the tech edits a prefilled value — they likely just told
  // the system "the unit in my hand differs from what we had on file."
  changedFromKnown?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required ? <span className="text-red-600">*</span> : null}
        {changedFromKnown ? (
          <span className="ml-2 text-amber-700 font-normal">edited</span>
        ) : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 min-h-[44px] rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          changedFromKnown
            ? "border-amber-400 bg-amber-50"
            : "border-gray-300"
        }`}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}
