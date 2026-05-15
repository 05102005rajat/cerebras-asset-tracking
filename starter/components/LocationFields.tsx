"use client";

import { useEffect, useState } from "react";
import type { Location } from "@/lib/types";
import { ScanField } from "./ScanField";
import { parseLocationPayload } from "@/lib/locations";

type Props = {
  value: Location;
  onChange: (next: Location) => void;
  // Which fields are required for the active workflow. UI dims optional fields.
  requiredFields: ReadonlyArray<keyof Location>;
};

const ALL_FIELDS: ReadonlyArray<keyof Location> = [
  "site",
  "room",
  "row",
  "rack",
  "ru",
];

const FIELD_LABEL: Record<keyof Location, string> = {
  site: "Site",
  room: "Room",
  row: "Row",
  rack: "Rack",
  ru: "RU",
};

export function LocationFields({ value, onChange, requiredFields }: Props) {
  const [scanError, setScanError] = useState<string | null>(null);
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  function setField(k: keyof Location, v: string): void {
    const next = { ...internal, [k]: v.trim() === "" ? null : v };
    if (k === "site") next.site = v;
    setInternal(next);
    onChange(next);
  }

  function handleLocationScan(payload: string): void {
    const parsed = parseLocationPayload(payload);
    if (!parsed) {
      setScanError(
        `Not a location label. Expected "LOC|site|room|row|rack|ru" — got "${payload.slice(0, 30)}".`,
      );
      return;
    }
    setScanError(null);
    setInternal(parsed);
    onChange(parsed);
  }

  return (
    <div className="space-y-3">
      <ScanField
        label="Scan a location label"
        placeholder="LOC|Lab-Building-A|Bay-12|Aisle-3|B-04|P-02"
        hint="Or fill the fields below by hand."
        onScan={handleLocationScan}
      />
      {scanError ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {scanError}
        </div>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ALL_FIELDS.map((k) => {
          const required = requiredFields.includes(k);
          const v = (internal[k] ?? "") as string;
          return (
            <label key={k} className="block">
              <span
                className={`block text-xs font-medium mb-1 ${required ? "text-gray-700" : "text-gray-400"}`}
              >
                {FIELD_LABEL[k]} {required ? <span className="text-red-600">*</span> : null}
              </span>
              <input
                type="text"
                value={v}
                onChange={(e) => setField(k, e.target.value)}
                className={`w-full px-3 py-2 min-h-[44px] rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  required && !v
                    ? "border-amber-300 bg-amber-50"
                    : "border-gray-300"
                }`}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
