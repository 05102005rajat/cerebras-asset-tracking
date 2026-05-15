import { locationToFacilitiesString, normalizeRackPath } from "./locations";
import type {
  Asset,
  FacilitiesRecord,
  FinanceRecord,
} from "./types";

export type Severity = "needs_action" | "watch" | "info";

export type Issue = {
  asset_tag: string | null;
  severity: Severity;
  category: IssueCategory;
  headline: string;
  detail: string;
  // Pre-formatted side-by-side comparison the manager can scan at a glance.
  comparison?: { label: string; ops?: string; facilities?: string; finance?: string };
};

export type IssueCategory =
  // needs_action
  | "rack_mismatch"
  | "missing_in_facilities"
  | "missing_in_finance"
  | "site_mismatch"
  | "ghost_in_facilities"
  | "ghost_in_finance"
  | "disposed_but_capitalized"
  // watch
  | "stale_facilities_observation"
  | "finance_pending_after_receive"
  | "early_lifecycle_no_finance"
  // info / explained-by-state (we don't usually surface these but include for transparency)
  | "stored_not_in_facilities"
  | "rma_not_in_facilities"
  | "disposed_not_in_facilities";

export type ReconcileReport = {
  generated_at: string;
  totals: {
    assets: number;
    facilities_records: number;
    finance_records: number;
    issues_needs_action: number;
    issues_watch: number;
    issues_info: number;
  };
  issues: Issue[];
};

const STALE_DAYS = 30;

// Pure, dependency-free classifier. Takes the three datasets, returns one
// structured report. Tests live in test/reconcile.test.ts.
export function reconcile(
  assets: Asset[],
  facilities: FacilitiesRecord[],
  finance: FinanceRecord[],
  now: Date = new Date(),
): ReconcileReport {
  const facById = new Map<string, FacilitiesRecord>();
  for (const f of facilities) facById.set(f.tagged_id, f);

  const finById = new Map<string, FinanceRecord>();
  for (const f of finance) finById.set(f.tag, f);

  const opsById = new Map<string, Asset>();
  for (const a of assets) opsById.set(a.asset_tag, a);

  const issues: Issue[] = [];

  for (const asset of assets) {
    const fac = facById.get(asset.asset_tag);
    const fin = finById.get(asset.asset_tag);

    // === Facilities checks ===
    if (asset.state === "in_service") {
      if (!fac) {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "needs_action",
          category: "missing_in_facilities",
          headline: "In service but missing from facilities",
          detail: `Ops shows ${asset.asset_tag} (${asset.model}) deployed, but facilities has no record. Either the deploy never wrote, or facilities lost it.`,
          comparison: {
            label: "rack location",
            ops: locationToFacilitiesString(asset.location),
            facilities: "—",
          },
        });
      } else {
        const opsRack = locationToFacilitiesString(asset.location);
        // Compare structurally: split on '/', drop empty segments. This way
        // `A/Bay-9//R-9/P-01` (legacy empty-slot writes) and `A/Bay-9/R-9/P-01`
        // (current filter-null writes) compare equal.
        if (normalizeRackPath(opsRack) !== normalizeRackPath(fac.rack_location)) {
          issues.push({
            asset_tag: asset.asset_tag,
            severity: "needs_action",
            category: "rack_mismatch",
            headline: "Rack location disagrees",
            detail: `Ops and facilities point at different racks for ${asset.asset_tag}. Someone moved it without updating one of the two systems.`,
            comparison: {
              label: "rack location",
              ops: opsRack,
              facilities: fac.rack_location,
            },
          });
        } else if (
          daysBetween(now, new Date(fac.last_observed)) > STALE_DAYS
        ) {
          issues.push({
            asset_tag: asset.asset_tag,
            severity: "watch",
            category: "stale_facilities_observation",
            headline: "Facilities observation is stale",
            detail: `Facilities last observed ${asset.asset_tag} ${Math.round(daysBetween(now, new Date(fac.last_observed)))} days ago. Walk the row at the next audit.`,
            comparison: {
              label: "last observed",
              facilities: fac.last_observed,
            },
          });
        }
      }
    } else if (
      asset.state === "stored" ||
      asset.state === "received" ||
      asset.state === "rma_pending" ||
      asset.state === "disposed"
    ) {
      // Facilities should NOT have it. If it does, that's a stale row.
      if (fac) {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "needs_action",
          category: "rack_mismatch",
          headline: "Still racked in facilities, but ops moved it",
          detail: `Ops says ${asset.asset_tag} is ${asset.state.replace("_", " ")}, but facilities still shows it racked at ${fac.rack_location}. Facilities needs a de-rack write.`,
          comparison: {
            label: "rack location",
            ops: "—",
            facilities: fac.rack_location,
          },
        });
      }
    }

    // === Finance checks ===
    if (!fin) {
      // Asset exists in ops but finance has no row at all. Severity depends on
      // state: a received-but-not-yet-billed asset is normal billing-cycle lag
      // (watch); an in_service or disposed asset finance doesn't know about is
      // a real problem (you operated or disposed something off the books).
      if (asset.state === "in_service" || asset.state === "disposed") {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "needs_action",
          category: "missing_in_finance",
          headline:
            asset.state === "disposed"
              ? "Disposed but never on the books"
              : "In service but never on the books",
          detail: `Ops has ${asset.asset_tag} (${asset.model}) as ${asset.state.replace("_", " ")}, but finance carries no record. Procurement may have skipped a step, or the receive scan happened without a matching PO.`,
          comparison: {
            label: "finance status",
            ops: asset.state,
            finance: "—",
          },
        });
      } else if (
        asset.state === "received" ||
        asset.state === "stored" ||
        asset.state === "rma_pending"
      ) {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "watch",
          category: "early_lifecycle_no_finance",
          headline: "No finance record yet",
          detail: `${asset.asset_tag} is ${asset.state.replace("_", " ")} in ops but finance hasn't written a row. Likely a PO that hasn't reached the books yet — chase it after the next billing cycle.`,
          comparison: {
            label: "finance status",
            ops: asset.state,
            finance: "—",
          },
        });
      }
    } else {
      // disposed in ops should not be `capitalized` in finance
      if (asset.state === "disposed" && fin.status === "capitalized") {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "needs_action",
          category: "disposed_but_capitalized",
          headline: "Disposed in ops, still capitalized in finance",
          detail: `${asset.asset_tag} (${asset.model}, $${fin.book_value_usd.toLocaleString()}) was disposed in ops but finance still has it on the books. Finance retire-out is missing.`,
          comparison: {
            label: "status",
            ops: "disposed",
            finance: fin.status,
          },
        });
      }

      // site mismatch
      if (fin.site && fin.site !== asset.location.site) {
        // Acceptable if ops has the asset somewhere else mid-transfer.
        // Still worth surfacing — finance bills against the wrong building.
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "watch",
          category: "site_mismatch",
          headline: "Building disagreement with finance",
          detail: `Ops has ${asset.asset_tag} at ${asset.location.site}; finance still bills it to ${fin.site}.`,
          comparison: {
            label: "site",
            ops: asset.location.site,
            finance: fin.site,
          },
        });
      }

      // received in ops, finance still says pending_receipt — usually fine, watch
      if (
        asset.state !== "unreceived" &&
        fin.status === "pending_receipt"
      ) {
        issues.push({
          asset_tag: asset.asset_tag,
          severity: "watch",
          category: "finance_pending_after_receive",
          headline: "Finance still showing pending_receipt",
          detail: `${asset.asset_tag} was received in ops but finance hasn't capitalized it yet. Usually a billing-cycle lag — flag if it's been more than two weeks.`,
          comparison: {
            label: "finance status",
            finance: fin.status,
          },
        });
      }
    }
  }

  // === Ghosts: tags in facilities or finance that ops doesn't know about ===
  for (const f of facilities) {
    if (!opsById.has(f.tagged_id)) {
      issues.push({
        asset_tag: f.tagged_id,
        severity: "needs_action",
        category: "ghost_in_facilities",
        headline: "Facilities racked an unknown asset",
        detail: `Facilities thinks ${f.tagged_id} is at ${f.rack_location}, but ops has never seen this tag. Either someone tagged a unit and skipped /tech/receive, or the facilities row is bad data.`,
        comparison: {
          label: "rack location",
          facilities: f.rack_location,
        },
      });
    }
  }
  for (const f of finance) {
    if (!opsById.has(f.tag)) {
      issues.push({
        asset_tag: f.tag,
        severity: "needs_action",
        category: "ghost_in_finance",
        headline: "Finance has an asset ops doesn't",
        detail: `Finance carries ${f.tag} at $${f.book_value_usd.toLocaleString()} (${f.status}), but ops has no record. Either it never reached the lab, or the receive scan was never done.`,
        comparison: { label: "status", finance: f.status },
      });
    }
  }

  // Sort: needs_action by category, then watch, then info
  const SEV_ORDER: Record<Severity, number> = {
    needs_action: 0,
    watch: 1,
    info: 2,
  };
  issues.sort((a, b) => {
    const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (s !== 0) return s;
    return a.category.localeCompare(b.category);
  });

  return {
    generated_at: now.toISOString(),
    totals: {
      assets: assets.length,
      facilities_records: facilities.length,
      finance_records: finance.length,
      issues_needs_action: issues.filter((i) => i.severity === "needs_action").length,
      issues_watch: issues.filter((i) => i.severity === "watch").length,
      issues_info: issues.filter((i) => i.severity === "info").length,
    },
    issues,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  rack_mismatch: "Rack mismatch",
  missing_in_facilities: "Missing from facilities",
  missing_in_finance: "Missing from finance",
  site_mismatch: "Site mismatch",
  ghost_in_facilities: "Ghost in facilities",
  ghost_in_finance: "Ghost in finance",
  disposed_but_capitalized: "Disposed but capitalized",
  stale_facilities_observation: "Stale observation",
  finance_pending_after_receive: "Finance lagging",
  early_lifecycle_no_finance: "Awaiting finance",
  stored_not_in_facilities: "Stored — facilities-blind",
  rma_not_in_facilities: "RMA — facilities-blind",
  disposed_not_in_facilities: "Disposed — facilities-blind",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  needs_action: "Needs action",
  watch: "Watch",
  info: "Info",
};
