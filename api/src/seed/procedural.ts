import type {
  Asset,
  AssetClass,
  AssetState,
  FacilitiesRecord,
  FinanceRecord,
  Location,
} from "../domain/types.js";

// Procedural baseline of ~1000 clean assets. These do **not** carry planted
// mismatches — all three systems agree on every procedural row. Their job is
// to make the dashboard feel real: pagination, filtering, density. The 12
// hand-crafted assets in seed/assets.ts hold all the deliberately-engineered
// drift.
//
// Deterministic: every call within a process lifetime produces the same
// data. No randomness. The one exception is PROCEDURAL_FACILITIES.last_observed,
// which is anchored to module-load time -- see the comment above that export.

type SeedAsset = Omit<Asset, "created_at" | "updated_at">;

const SITES = ["Lab-Building-A", "Lab-Building-B", "Lab-Building-C"];
const TECHS = [
  "tech-jane",
  "tech-mike",
  "tech-carlos",
  "tech-priya",
  "tech-aaron",
  "tech-dana",
  "tech-sara",
];

type ModelDef = {
  manufacturer: string;
  model: string;
  asset_class: AssetClass;
  base_value: number;
};

const MODELS: ModelDef[] = [
  { manufacturer: "BioSystems Inc", model: "Genomics Sequencer 2000", asset_class: "instrument", base_value: 1_250_000 },
  { manufacturer: "BioSystems Inc", model: "Genomics Sequencer 4000", asset_class: "instrument", base_value: 1_750_000 },
  { manufacturer: "ChemAnalytics", model: "Mass Spectrometer 800", asset_class: "instrument", base_value: 875_000 },
  { manufacturer: "ChemAnalytics", model: "Mass Spectrometer 1200", asset_class: "instrument", base_value: 1_100_000 },
  { manufacturer: "OptiLab", model: "Confocal Microscope CX-9", asset_class: "instrument", base_value: 620_000 },
  { manufacturer: "NetCorp", model: "Lab Network Switch 48p", asset_class: "network", base_value: 45_000 },
  { manufacturer: "NetCorp", model: "Lab Network Switch 96p", asset_class: "network", base_value: 95_000 },
  { manufacturer: "ServerCo", model: "Compute Server R760", asset_class: "compute", base_value: 32_000 },
  { manufacturer: "ServerCo", model: "Compute Server R860", asset_class: "compute", base_value: 48_000 },
  { manufacturer: "PowerLine", model: "Lab PDU 50A", asset_class: "power", base_value: 8_000 },
];

const COUNT = 1000;
const START = 1000; // tag range C0001000 .. C0001999

function tagFor(i: number): string {
  return `C${String(START + i).padStart(7, "0")}`;
}
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function stateForIndex(i: number): AssetState {
  // 70% in_service, 12% stored, 8% received, 5% rma_pending, 5% disposed
  const mod = i % 100;
  if (mod < 70) return "in_service";
  if (mod < 82) return "stored";
  if (mod < 90) return "received";
  if (mod < 95) return "rma_pending";
  return "disposed";
}

function locationFor(state: AssetState, i: number): Location {
  const site = pick(SITES, i);
  switch (state) {
    case "in_service": {
      const room = `Bay-${(i % 20) + 1}`;
      const row = `Aisle-${(i % 5) + 1}`;
      const rack = `R-${String((i % 30) + 1).padStart(2, "0")}`;
      const ru = `U${String(((i * 3) % 40) + 1).padStart(2, "0")}`;
      return { site, room, row, rack, ru };
    }
    case "stored":
      return { site, room: `Storage-${(i % 3) + 1}`, row: null, rack: `SHELF-${(i % 12) + 1}`, ru: null };
    case "received":
      return { site, room: "Receiving", row: null, rack: `DOCK-${(i % 4) + 1}`, ru: null };
    case "rma_pending":
      return { site, room: "Staging-RMA", row: null, rack: `BIN-RMA-${(i % 3) + 1}`, ru: null };
    case "disposed":
      return { site, room: "Disposal", row: null, rack: `PALLET-${(i % 5) + 1}`, ru: null };
    default:
      return { site, room: null, row: null, rack: null, ru: null };
  }
}

function custodianFor(state: AssetState, i: number): string {
  if (state === "stored") return `container-storage-${(i % 3) + 1}`;
  if (state === "rma_pending") return `container-rma-bin-${(i % 3) + 1}`;
  if (state === "disposed") return "vendor-erecycle";
  return pick(TECHS, i);
}

type EnrichedAsset = SeedAsset & { _modelBaseValue: number };

const ASSETS_INTERNAL: EnrichedAsset[] = Array.from({ length: COUNT }, (_, i) => {
  const state = stateForIndex(i);
  const model = MODELS[i % MODELS.length]!;
  return {
    asset_tag: tagFor(i),
    serial: `SN-PROC-${String(i).padStart(5, "0")}`,
    model: model.model,
    manufacturer: model.manufacturer,
    asset_class: model.asset_class,
    state,
    location: locationFor(state, i),
    custodian: custodianFor(state, i),
    parent_asset_tag: null,
    procurement_note: null,
    _modelBaseValue: model.base_value,
  };
});

export const PROCEDURAL_ASSETS: SeedAsset[] = ASSETS_INTERNAL.map(({ _modelBaseValue, ...rest }) => rest);

// Facilities only tracks racked equipment. So in_service only.
//
// last_observed is anchored to module-load time (evaluated once below, not
// per-request) rather than a fixed calendar literal. reconcile.ts's
// stale_facilities_observation check compares this against live wall-clock
// `now` with a 30-day window, so a hardcoded past date would silently flag
// every one of these ~700 "clean" rows as stale the moment more than 30 days
// elapsed since that literal was written -- exactly the drift this
// procedural baseline is supposed to be free of.
const proceduralFacilitiesSeedTime = new Date().toISOString();
let facilitySeq = 2000;
export const PROCEDURAL_FACILITIES: FacilitiesRecord[] = ASSETS_INTERNAL
  .filter((a) => a.state === "in_service")
  .map((a) => ({
    space_id: `fac-p${String(facilitySeq++).padStart(4, "0")}`,
    tagged_id: a.asset_tag,
    rack_location: [a.location.site, a.location.room, a.location.row, a.location.rack, a.location.ru]
      .filter(Boolean)
      .join("/"),
    last_observed: proceduralFacilitiesSeedTime,
  }));

// Finance tracks every asset. Disposed assets are "retired" on finance's side;
// everything else is "capitalized." No drift — the planted ambiguous case
// (disposed-in-ops but still-capitalized-in-finance) lives only in the
// hand-crafted seed.
let financeSeq = 50_000;
export const PROCEDURAL_FINANCE: FinanceRecord[] = ASSETS_INTERNAL.map((a) => ({
  finance_id: `EQ-${String(financeSeq++).padStart(5, "0")}`,
  tag: a.asset_tag,
  site: a.location.site,
  book_value_usd: a._modelBaseValue,
  status: a.state === "disposed" ? "retired" : "capitalized",
  capitalized_on: a.state === "disposed" ? "2024-03-01" : "2025-06-15",
}));
