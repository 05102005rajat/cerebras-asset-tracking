"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AssetState } from "@/lib/types";
import { STATE_LABEL } from "@/lib/format";

const STATES: AssetState[] = [
  "received",
  "stored",
  "in_service",
  "rma_pending",
  "disposed",
];

export function AssetFilters({
  knownSites,
  knownCustodians,
}: {
  knownSites: string[];
  knownCustodians: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const state = searchParams.get("state") ?? "";
  const site = searchParams.get("site") ?? "";
  const custodian = searchParams.get("custodian") ?? "";

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasFilter = state || site || custodian || search;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
      <Input
        placeholder="Search tag, model, manufacturer…"
        value={search}
        onChange={setSearch}
        onCommit={(v) => update({ q: v })}
      />
      <Select
        value={state}
        onChange={(v) => update({ state: v })}
        placeholder="All states"
        options={STATES.map((s) => ({ value: s, label: STATE_LABEL[s] }))}
      />
      <Select
        value={site}
        onChange={(v) => update({ site: v })}
        placeholder="All sites"
        options={knownSites.map((s) => ({ value: s, label: s }))}
      />
      <Select
        value={custodian}
        onChange={(v) => update({ custodian: v })}
        placeholder="All custodians"
        options={knownCustodians.map((c) => ({ value: c, label: c }))}
      />
      <button
        onClick={clearAll}
        disabled={!hasFilter}
        className="px-3 py-2 rounded border border-gray-300 disabled:opacity-40 text-sm hover:bg-gray-50"
      >
        Clear
      </button>
    </div>
  );
}

function Input({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value.trim());
        }
      }}
      placeholder={placeholder}
      className="px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:col-span-1"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
