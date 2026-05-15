import type { Asset } from "./types";

export type SortKey =
  | "asset_tag"
  | "model"
  | "state"
  | "custodian"
  | "site"
  | "updated_at";

export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: `${SortKey}:${SortDir}` = "updated_at:desc";

const VALID_KEYS: SortKey[] = [
  "asset_tag",
  "model",
  "state",
  "custodian",
  "site",
  "updated_at",
];

// State sort follows the lifecycle, not lexical order — managers expect
// `received → stored → in_service → rma_pending → disposed`, not alphabetical.
const STATE_ORDER: Record<string, number> = {
  unreceived: 0,
  received: 1,
  stored: 2,
  in_service: 3,
  rma_pending: 4,
  disposed: 5,
};

export function parseSort(raw: string | undefined): {
  key: SortKey;
  dir: SortDir;
} {
  const v = raw ?? DEFAULT_SORT;
  const [k, d] = v.split(":") as [string, string];
  const key = VALID_KEYS.includes(k as SortKey) ? (k as SortKey) : "updated_at";
  const dir: SortDir = d === "asc" ? "asc" : "desc";
  return { key, dir };
}

export function sortAssets(
  assets: Asset[],
  key: SortKey,
  dir: SortDir,
): Asset[] {
  const out = [...assets];
  out.sort((a, b) => {
    const av = readKey(a, key);
    const bv = readKey(b, key);
    const cmp = compare(av, bv);
    return dir === "asc" ? cmp : -cmp;
  });
  return out;
}

function readKey(a: Asset, key: SortKey): string | number {
  switch (key) {
    case "asset_tag":
      return a.asset_tag;
    case "model":
      return a.model;
    case "state":
      return STATE_ORDER[a.state] ?? 99;
    case "custodian":
      return a.custodian;
    case "site":
      return a.location.site ?? "";
    case "updated_at":
      return a.updated_at;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
