import type { FastifyInstance } from "fastify";
import { ulid } from "ulid";
import {
  DeployScanInputSchema,
  ReceiveScanInputSchema,
  StoreScanInputSchema,
  TransferScanInputSchema,
} from "../domain/types.js";
import type { Asset, Event } from "../domain/types.js";
import {
  getAsset,
  getDb,
  insertAsset,
  insertEvent,
  updateAsset,
} from "../db.js";
import { sendError } from "../errors.js";
import { findTransition } from "../domain/state-machine.js";
import { isDeployLocationComplete, isValidTag } from "../domain/validation.js";

export async function scansRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/scans/receive
  app.post("/v1/scans/receive", async (req, reply) => {
    const parse = ReceiveScanInputSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_location", "Invalid receive payload", {
        issues: parse.error.issues,
      });
    }
    const input = parse.data;

    if (!isValidTag(input.asset_tag)) {
      return sendError(
        reply,
        400,
        "invalid_tag_format",
        "asset_tag must match /^C\\d{7}$/",
        { asset_tag: input.asset_tag },
      );
    }

    const db = getDb();
    const existing = getAsset(db, input.asset_tag);
    const now = new Date().toISOString();

    if (existing) {
      if (existing.serial !== input.serial) {
        return sendError(
          reply,
          409,
          "and_match_failed",
          "asset_tag already exists with a different serial",
          {
            expected_serial: existing.serial,
            provided_serial: input.serial,
          },
        );
      }
      const event: Event = {
        id: ulid(),
        asset_tag: existing.asset_tag,
        event_type: "duplicate_receive",
        from_state: existing.state,
        to_state: existing.state,
        from_location: existing.location,
        to_location: existing.location,
        user_id: input.user_id,
        scan_payload: input.scan_payload,
        timestamp: now,
      };
      insertEvent(db, event);
      return reply.code(200).send(existing);
    }

    const asset: Asset = {
      asset_tag: input.asset_tag,
      serial: input.serial,
      model: input.model,
      manufacturer: input.manufacturer,
      asset_class: input.asset_class,
      state: "received",
      location: input.location,
      custodian: input.user_id,
      parent_asset_tag: null,
      procurement_note: null,
      created_at: now,
      updated_at: now,
    };
    insertAsset(db, asset);

    const event: Event = {
      id: ulid(),
      asset_tag: asset.asset_tag,
      event_type: "receive",
      from_state: null,
      to_state: "received",
      from_location: null,
      to_location: input.location,
      user_id: input.user_id,
      scan_payload: input.scan_payload,
      timestamp: now,
    };
    insertEvent(db, event);
    return reply.code(201).send(asset);
  });

  // POST /v1/scans/store
  app.post("/v1/scans/store", async (req, reply) => {
    const parse = StoreScanInputSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_location", "Invalid store payload", {
        issues: parse.error.issues,
      });
    }
    const input = parse.data;
    const db = getDb();
    const asset = getAsset(db, input.asset_tag);
    if (!asset) {
      return sendError(reply, 404, "unknown_asset", `Asset ${input.asset_tag} not found`);
    }
    const next = findTransition(asset.state, "store");
    if (next !== "stored") {
      return sendError(
        reply,
        422,
        "invalid_transition",
        `Cannot store an asset in state '${asset.state}'`,
        { from_state: asset.state, attempted_event: "store" },
      );
    }
    const now = new Date().toISOString();
    updateAsset(db, asset.asset_tag, {
      state: "stored",
      location: input.location,
      custodian: input.user_id,
      updated_at: now,
    });
    const event: Event = {
      id: ulid(),
      asset_tag: asset.asset_tag,
      event_type: "store",
      from_state: asset.state,
      to_state: "stored",
      from_location: asset.location,
      to_location: input.location,
      user_id: input.user_id,
      scan_payload: input.scan_payload,
      timestamp: now,
    };
    insertEvent(db, event);
    return reply.send(getAsset(db, asset.asset_tag));
  });

  // POST /v1/scans/deploy
  app.post("/v1/scans/deploy", async (req, reply) => {
    const parse = DeployScanInputSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_location", "Invalid deploy payload", {
        issues: parse.error.issues,
      });
    }
    const input = parse.data;
    if (!isDeployLocationComplete(input.location)) {
      return sendError(
        reply,
        422,
        "incomplete_deploy_location",
        "Deploy requires site, room, rack, and ru",
        { location: input.location },
      );
    }
    const db = getDb();
    const asset = getAsset(db, input.asset_tag);
    if (!asset) {
      return sendError(reply, 404, "unknown_asset", `Asset ${input.asset_tag} not found`);
    }
    const next = findTransition(asset.state, "deploy");
    if (next !== "in_service") {
      return sendError(
        reply,
        422,
        "invalid_transition",
        `Cannot deploy an asset in state '${asset.state}'`,
        { from_state: asset.state, attempted_event: "deploy" },
      );
    }
    const now = new Date().toISOString();
    updateAsset(db, asset.asset_tag, {
      state: "in_service",
      location: input.location,
      custodian: input.user_id,
      updated_at: now,
    });
    const event: Event = {
      id: ulid(),
      asset_tag: asset.asset_tag,
      event_type: "deploy",
      from_state: asset.state,
      to_state: "in_service",
      from_location: asset.location,
      to_location: input.location,
      user_id: input.user_id,
      scan_payload: input.scan_payload,
      timestamp: now,
    };
    insertEvent(db, event);
    return reply.send(getAsset(db, asset.asset_tag));
  });

  // POST /v1/scans/transfer
  // Two-sided custody: the logged-in user (user_id) is the FROM custodian;
  // to_custodian is the badge of the receiving party. State doesn't change.
  app.post("/v1/scans/transfer", async (req, reply) => {
    const parse = TransferScanInputSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(reply, 422, "invalid_location", "Invalid transfer payload", {
        issues: parse.error.issues,
      });
    }
    const input = parse.data;
    const db = getDb();
    const asset = getAsset(db, input.asset_tag);
    if (!asset) {
      return sendError(reply, 404, "unknown_asset", `Asset ${input.asset_tag} not found`);
    }
    if (asset.state === "disposed" || asset.state === "unreceived") {
      return sendError(
        reply,
        422,
        "invalid_transition",
        `Cannot transfer custody of an asset in state '${asset.state}'`,
        { from_state: asset.state, attempted_event: "transfer_custody" },
      );
    }
    if (input.to_custodian === asset.custodian) {
      return sendError(
        reply,
        422,
        "same_custodian",
        "to_custodian is already the current custodian",
        { custodian: asset.custodian },
      );
    }
    const now = new Date().toISOString();
    updateAsset(db, asset.asset_tag, {
      state: asset.state,
      location: asset.location,
      custodian: input.to_custodian,
      updated_at: now,
    });
    const event: Event = {
      id: ulid(),
      asset_tag: asset.asset_tag,
      event_type: "transfer_custody",
      from_state: asset.state,
      to_state: asset.state,
      from_location: asset.location,
      to_location: asset.location,
      user_id: input.user_id,
      scan_payload: input.scan_payload,
      timestamp: now,
    };
    insertEvent(db, event);
    return reply.send(getAsset(db, asset.asset_tag));
  });
}
