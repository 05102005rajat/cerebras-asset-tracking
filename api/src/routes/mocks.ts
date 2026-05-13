import type { FastifyInstance } from "fastify";
import { FACILITIES_RECORDS } from "../seed/facilities.js";
import { FINANCE_RECORDS } from "../seed/finance.js";
import {
  PROCEDURAL_FACILITIES,
  PROCEDURAL_FINANCE,
} from "../seed/procedural.js";
import {
  FacilitiesUpdateSchema,
  FinanceUpdateSchema,
} from "../domain/types.js";
import type { FacilitiesRecord, FinanceRecord } from "../domain/types.js";
import { sendError } from "../errors.js";

// Hand-crafted + procedural records form the static baseline.
const BASE_FACILITIES: FacilitiesRecord[] = [
  ...FACILITIES_RECORDS,
  ...PROCEDURAL_FACILITIES,
];
const BASE_FINANCE: FinanceRecord[] = [
  ...FINANCE_RECORDS,
  ...PROCEDURAL_FINANCE,
];

// Writes from candidates' apps overlay the baseline. Each map is
// tag -> patch. A null patch removes the row (e.g., de-rack).
// Cleared on /v1/reset.
const facilitiesOverlay = new Map<string, Partial<FacilitiesRecord> | null>();
const financeOverlay = new Map<string, Partial<FinanceRecord>>();

export function clearMockOverlays(): void {
  facilitiesOverlay.clear();
  financeOverlay.clear();
}

function mergedFacilities(): FacilitiesRecord[] {
  const out: FacilitiesRecord[] = [];
  const seen = new Set<string>();
  for (const r of BASE_FACILITIES) {
    const patch = facilitiesOverlay.get(r.tagged_id);
    if (patch === null) {
      seen.add(r.tagged_id);
      continue; // explicit removal
    }
    if (patch === undefined) {
      out.push(r);
    } else {
      out.push({ ...r, ...patch, tagged_id: r.tagged_id });
    }
    seen.add(r.tagged_id);
  }
  // New tags only present in the overlay.
  for (const [tag, patch] of facilitiesOverlay.entries()) {
    if (seen.has(tag) || patch === null) continue;
    out.push({
      space_id: patch.space_id ?? `overlay-${tag}`,
      tagged_id: tag,
      rack_location: patch.rack_location ?? "",
      last_observed: patch.last_observed ?? new Date().toISOString(),
    });
  }
  return out;
}

function mergedFinance(): FinanceRecord[] {
  const out: FinanceRecord[] = [];
  const seen = new Set<string>();
  for (const r of BASE_FINANCE) {
    const patch = financeOverlay.get(r.tag);
    if (patch === undefined) {
      out.push(r);
    } else {
      out.push({ ...r, ...patch, tag: r.tag });
    }
    seen.add(r.tag);
  }
  for (const [tag, patch] of financeOverlay.entries()) {
    if (seen.has(tag)) continue;
    out.push({
      finance_id: patch.finance_id ?? `overlay-${tag}`,
      tag,
      site: patch.site ?? "",
      book_value_usd: patch.book_value_usd ?? 0,
      status: patch.status ?? "pending_receipt",
      capitalized_on: patch.capitalized_on ?? null,
    });
  }
  return out;
}

export async function mocksRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/mock/facilities/spaces", async (_req, reply) => {
    return reply.send(mergedFacilities());
  });

  app.post("/v1/mock/facilities/spaces", async (req, reply) => {
    const parse = FacilitiesUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_payload", "Invalid facilities update", {
        issues: parse.error.issues,
      });
    }
    const { tagged_id, rack_location } = parse.data;
    if (rack_location === null) {
      facilitiesOverlay.set(tagged_id, null); // remove
    } else {
      facilitiesOverlay.set(tagged_id, {
        rack_location,
        last_observed: new Date().toISOString(),
      });
    }
    return reply.code(200).send({ ok: true });
  });

  app.get("/v1/mock/finance/equipment", async (_req, reply) => {
    return reply.send(mergedFinance());
  });

  app.post("/v1/mock/finance/equipment", async (req, reply) => {
    const parse = FinanceUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_payload", "Invalid finance update", {
        issues: parse.error.issues,
      });
    }
    const { tag, ...patch } = parse.data;
    financeOverlay.set(tag, patch);
    return reply.code(200).send({ ok: true });
  });
}
