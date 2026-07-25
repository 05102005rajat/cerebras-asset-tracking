import Database from "better-sqlite3";
import { mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "ulid";
import type {
  Asset,
  AssetState,
  Event,
  EventType,
  Location,
} from "./domain/types.js";
import { SEED_ASSETS } from "./seed/assets.js";
import { PROCEDURAL_ASSETS } from "./seed/procedural.js";
import { findTransition } from "./domain/state-machine.js";

const DATA_DIR = process.env.API_DATA_DIR ?? join(process.cwd(), "data");
const DB_FILE = process.env.API_DB_FILE ?? "asset-tracking.db";

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let handle: Database.Database | null = null;

function dbPath(): string {
  return join(DATA_DIR, DB_FILE);
}

function initSchema(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      asset_tag TEXT PRIMARY KEY,
      serial TEXT NOT NULL,
      model TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      state TEXT NOT NULL,
      location_json TEXT NOT NULL,
      custodian TEXT NOT NULL,
      parent_asset_tag TEXT,
      procurement_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assets_state ON assets(state);
    CREATE INDEX IF NOT EXISTS idx_assets_custodian ON assets(custodian);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      asset_tag TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      from_location_json TEXT,
      to_location_json TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scan_payload TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (asset_tag) REFERENCES assets(asset_tag)
    );

    CREATE INDEX IF NOT EXISTS idx_events_asset_tag ON events(asset_tag);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  `);
}

function seedDatabase(db: Database.Database): void {
  const insertAsset = db.prepare(`
    INSERT INTO assets (asset_tag, serial, model, manufacturer, asset_class, state, location_json, custodian, parent_asset_tag, procurement_note, created_at, updated_at)
    VALUES (@asset_tag, @serial, @model, @manufacturer, @asset_class, @state, @location_json, @custodian, @parent_asset_tag, @procurement_note, @created_at, @updated_at)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO events (id, asset_tag, event_type, from_state, to_state, from_location_json, to_location_json, user_id, scan_payload, timestamp)
    VALUES (@id, @asset_tag, @event_type, @from_state, @to_state, @from_location_json, @to_location_json, @user_id, @scan_payload, @timestamp)
  `);
  // Corrects each asset's updated_at to the timestamp of its own last event
  // once the full per-asset timeline below is known -- see the note at the
  // end of the loop body.
  const finalizeUpdatedAt = db.prepare(
    `UPDATE assets SET updated_at = @updated_at WHERE asset_tag = @asset_tag`,
  );

  const receivingLoc: Location = {
    site: "Lab-Building-A",
    room: "Receiving",
    row: null,
    rack: "DOCK-1",
    ru: null,
  };

  const tx = db.transaction(() => {
    for (const asset of [...SEED_ASSETS, ...PROCEDURAL_ASSETS]) {
      let baseTime = new Date("2025-08-01T12:00:00.000Z").getTime();
      const stepMs = 7 * 24 * 60 * 60 * 1000;

      const initialReceiveAt = new Date(baseTime).toISOString();
      const userId = asset.custodian.startsWith("tech-")
        ? asset.custodian
        : "tech-carlos";

      insertAsset.run({
        asset_tag: asset.asset_tag,
        serial: asset.serial,
        model: asset.model,
        manufacturer: asset.manufacturer,
        asset_class: asset.asset_class,
        state: asset.state,
        location_json: JSON.stringify(asset.location),
        custodian: asset.custodian,
        parent_asset_tag: asset.parent_asset_tag,
        procurement_note: asset.procurement_note,
        created_at: initialReceiveAt,
        // Placeholder -- corrected below to the timestamp of this asset's
        // own last event once the timeline has been generated.
        updated_at: initialReceiveAt,
      });

      insertEvent.run({
        id: ulid(),
        asset_tag: asset.asset_tag,
        event_type: "receive",
        from_state: null,
        to_state: "received",
        from_location_json: null,
        to_location_json: JSON.stringify(receivingLoc),
        user_id: userId,
        scan_payload: `RECEIVE|${asset.asset_tag}|${asset.serial}`,
        timestamp: initialReceiveAt,
      });
      let lastEventAt = initialReceiveAt;

      baseTime += stepMs;
      let currentState: AssetState = "received";
      let currentLoc: Location = receivingLoc;

      const path = pathToState(asset.state);
      for (const via of path) {
        const nextState = findTransition(currentState, via);
        if (!nextState) break;
        const eventLoc = via === "store" || via === "deploy" ? asset.location : currentLoc;
        const eventTimestamp = new Date(baseTime).toISOString();
        insertEvent.run({
          id: ulid(),
          asset_tag: asset.asset_tag,
          event_type: via,
          from_state: currentState,
          to_state: nextState,
          from_location_json: JSON.stringify(currentLoc),
          to_location_json: JSON.stringify(eventLoc),
          user_id: userId,
          scan_payload: `${via.toUpperCase()}|${asset.asset_tag}`,
          timestamp: eventTimestamp,
        });
        lastEventAt = eventTimestamp;
        currentState = nextState;
        currentLoc = eventLoc;
        baseTime += stepMs;
      }

      // Stamp updated_at with this asset's own last event time (not a
      // shared constant) so /manager's default updated_at:desc sort and the
      // relativeTime labels reflect each asset's real last-touched time.
      if (lastEventAt !== initialReceiveAt) {
        finalizeUpdatedAt.run({ asset_tag: asset.asset_tag, updated_at: lastEventAt });
      }
    }
  });
  tx();
}

function pathToState(target: AssetState): EventType[] {
  switch (target) {
    case "received":
      return [];
    case "stored":
      return ["store"];
    case "in_service":
      return ["store", "deploy"];
    case "rma_pending":
      return ["store", "deploy", "rma_open"];
    case "disposed":
      return ["store", "deploy", "dispose"];
    case "unreceived":
      return [];
  }
}

export function getDb(): Database.Database {
  if (handle) return handle;
  const path = dbPath();
  const isNew = !existsSync(path);
  const db = new Database(path);
  initSchema(db);
  if (isNew) {
    seedDatabase(db);
  }
  handle = db;
  return db;
}

export function resetDatabase(): void {
  if (handle) {
    handle.close();
    handle = null;
  }
  const path = dbPath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = path + suffix;
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        // best effort
      }
    }
  }
  getDb();
}

type AssetRow = {
  asset_tag: string;
  serial: string;
  model: string;
  manufacturer: string;
  asset_class: string;
  state: string;
  location_json: string;
  custodian: string;
  parent_asset_tag: string | null;
  procurement_note: string | null;
  created_at: string;
  updated_at: string;
};

function rowToAsset(row: AssetRow): Asset {
  return {
    asset_tag: row.asset_tag,
    serial: row.serial,
    model: row.model,
    manufacturer: row.manufacturer,
    asset_class: row.asset_class as Asset["asset_class"],
    state: row.state as Asset["state"],
    location: JSON.parse(row.location_json),
    custodian: row.custodian,
    parent_asset_tag: row.parent_asset_tag,
    procurement_note: row.procurement_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type EventRow = {
  id: string;
  asset_tag: string;
  event_type: string;
  from_state: string | null;
  to_state: string;
  from_location_json: string | null;
  to_location_json: string;
  user_id: string;
  scan_payload: string;
  timestamp: string;
};

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    asset_tag: row.asset_tag,
    event_type: row.event_type as Event["event_type"],
    from_state: row.from_state as Event["from_state"],
    to_state: row.to_state as Event["to_state"],
    from_location: row.from_location_json ? JSON.parse(row.from_location_json) : null,
    to_location: JSON.parse(row.to_location_json),
    user_id: row.user_id,
    scan_payload: row.scan_payload,
    timestamp: row.timestamp,
  };
}

export function listAssets(
  db: Database.Database,
  filters: { state?: string; site?: string; custodian?: string },
): Asset[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filters.state) {
    where.push("state = @state");
    params.state = filters.state;
  }
  if (filters.custodian) {
    where.push("custodian = @custodian");
    params.custodian = filters.custodian;
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM assets ${whereClause} ORDER BY asset_tag`)
    .all(params) as AssetRow[];
  let assets = rows.map(rowToAsset);
  if (filters.site) {
    assets = assets.filter((a) => a.location.site === filters.site);
  }
  return assets;
}

export function getAsset(db: Database.Database, tag: string): Asset | null {
  const row = db.prepare("SELECT * FROM assets WHERE asset_tag = ?").get(tag) as
    | AssetRow
    | undefined;
  return row ? rowToAsset(row) : null;
}

export function listEvents(db: Database.Database, tag: string): Event[] {
  const rows = db
    .prepare("SELECT * FROM events WHERE asset_tag = ? ORDER BY timestamp DESC, id DESC")
    .all(tag) as EventRow[];
  return rows.map(rowToEvent);
}

export function insertAsset(
  db: Database.Database,
  asset: Asset,
): void {
  db.prepare(
    `INSERT INTO assets (asset_tag, serial, model, manufacturer, asset_class, state, location_json, custodian, parent_asset_tag, procurement_note, created_at, updated_at)
     VALUES (@asset_tag, @serial, @model, @manufacturer, @asset_class, @state, @location_json, @custodian, @parent_asset_tag, @procurement_note, @created_at, @updated_at)`,
  ).run({
    asset_tag: asset.asset_tag,
    serial: asset.serial,
    model: asset.model,
    manufacturer: asset.manufacturer,
    asset_class: asset.asset_class,
    state: asset.state,
    location_json: JSON.stringify(asset.location),
    custodian: asset.custodian,
    parent_asset_tag: asset.parent_asset_tag,
    procurement_note: asset.procurement_note,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  });
}

export function updateAsset(
  db: Database.Database,
  tag: string,
  updates: { state: AssetState; location: Location; custodian: string; updated_at: string },
): void {
  db.prepare(
    `UPDATE assets SET state = @state, location_json = @location_json, custodian = @custodian, updated_at = @updated_at
     WHERE asset_tag = @asset_tag`,
  ).run({
    asset_tag: tag,
    state: updates.state,
    location_json: JSON.stringify(updates.location),
    custodian: updates.custodian,
    updated_at: updates.updated_at,
  });
}

export function insertEvent(db: Database.Database, event: Event): void {
  db.prepare(
    `INSERT INTO events (id, asset_tag, event_type, from_state, to_state, from_location_json, to_location_json, user_id, scan_payload, timestamp)
     VALUES (@id, @asset_tag, @event_type, @from_state, @to_state, @from_location_json, @to_location_json, @user_id, @scan_payload, @timestamp)`,
  ).run({
    id: event.id,
    asset_tag: event.asset_tag,
    event_type: event.event_type,
    from_state: event.from_state,
    to_state: event.to_state,
    from_location_json: event.from_location ? JSON.stringify(event.from_location) : null,
    to_location_json: JSON.stringify(event.to_location),
    user_id: event.user_id,
    scan_payload: event.scan_payload,
    timestamp: event.timestamp,
  });
}
