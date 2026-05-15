"use client";

import { useEffect, useRef, useState } from "react";
import { ScanField } from "@/components/ScanField";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { ScanLog, type ScanLogEntry } from "@/components/ScanLog";
import { LocationFields } from "@/components/LocationFields";
import { clientScans } from "@/lib/client-scans";
import { ApiError } from "@/lib/api-client";
import { isAssetTag, emptyLocation } from "@/lib/locations";
import type { AssetClass, Asset, Location } from "@/lib/types";
import type { SideEffect } from "@/lib/scan-server";

const CLASSES: AssetClass[] = [
  "instrument",
  "compute",
  "network",
  "power",
  "consumable_durable",
];

type Phase = "scan_tag" | "fill_intake" | "submitting";

// Receive flow:
//  1. Scan the asset tag.
//  2. (For new tags) collect serial, model, manufacturer, class, intake
//     location. The API decides whether this is a fresh receive, an
//     idempotent duplicate, or a serial conflict — we just collect and POST.
//  3. Submit. Show outcome with which serial conflicts (if any).
export default function TechReceivePage() {
  const [phase, setPhase] = useState<Phase>("scan_tag");
  const [tag, setTag] = useState<string>("");
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
  const successTimer = useRef<number | null>(null);

  function reset(): void {
    setPhase("scan_tag");
    setTag("");
    setSerial("");
    setModel("");
    setManufacturer("");
    setAssetClass("instrument");
    setLocation(emptyLocation(location.site || "Lab-Building-A"));
    setError(null);
  }

  useEffect(() => {
    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  function flashSuccess(entry: { asset: Asset; message: string; sideEffects: SideEffect[] }) {
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

  function handleTagScan(value: string): void {
    if (!isAssetTag(value)) {
      setError(
        new ApiError(400, "invalid_tag_format", `"${value}" doesn't look like a tag.`),
      );
      setLog((l) => [
        { at: Date.now(), outcome: "error", message: `Bad tag scan: ${value}` },
        ...l,
      ]);
      return;
    }
    setError(null);
    setTag(value);
    setPhase("fill_intake");
  }

  async function handleSubmit(): Promise<void> {
    if (!tag) return;
    if (!serial || !model || !manufacturer) {
      setError(
        new ApiError(400, "missing_fields", "Serial, model, and manufacturer are required."),
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
      flashSuccess({
        asset: result.asset,
        message: "Receive recorded",
        sideEffects: result.side_effects,
      });
    } catch (e) {
      setError(e);
      setPhase("fill_intake");
      setLog((l) => [
        {
          at: Date.now(),
          outcome: "error",
          asset_tag: tag,
          message: e instanceof Error ? e.message : "Receive failed",
        },
        ...l,
      ]);
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
        />
      ) : null}

      {phase === "scan_tag" ? (
        <ScanField
          label="Scan the asset tag"
          placeholder="C0009001"
          hint="Code 128 or QR. Or type 7 digits and press Enter."
          onScan={handleTagScan}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-gray-100 rounded-lg p-3">
            <div>
              <div className="text-xs text-gray-500">Receiving</div>
              <div className="font-mono text-sm font-semibold">{tag}</div>
            </div>
            <button
              onClick={reset}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Different tag
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Serial"
              required
              value={serial}
              onChange={setSerial}
              placeholder="SN-…"
            />
            <Field
              label="Model"
              required
              value={model}
              onChange={setModel}
              placeholder="Genomics Sequencer 2000"
            />
            <Field
              label="Manufacturer"
              required
              value={manufacturer}
              onChange={setManufacturer}
              placeholder="BioSystems Inc"
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
            {phase === "submitting" ? "Receiving…" : "Record receive"}
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
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 min-h-[44px] rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}
