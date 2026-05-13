# API reference

Base URL (local): `http://localhost:8080/v1`

No auth — the API runs locally and is wide open. All non-2xx responses follow this shape:

```json
{
  "error": {
    "code": "string-code",
    "message": "human readable",
    "details": { "...": "optional" }
  }
}
```

## Endpoints

### `GET /health`

`{ "ok": true, "version": "1.0.0" }`.

### `GET /v1/assets`

Query params (all optional, AND filter): `state`, `site`, `custodian`.

Returns `Asset[]`.

### `GET /v1/assets/:asset_tag`

Returns `Asset`. 404 `unknown_asset` if not found.

### `GET /v1/assets/:asset_tag/events`

Returns `Event[]`, newest first.

### `POST /v1/scans/receive`

Body:

```ts
{
  asset_tag: string;          // must match /^C\d{7}$/
  serial: string;
  model: string;
  manufacturer: string;
  asset_class: "instrument" | "compute" | "network" | "power" | "consumable_durable";
  location: Location;
  user_id: string;
  scan_payload: string;
}
```

Behavior:

- New `asset_tag` → creates the asset in `received` state, returns it with `201`.
- Existing tag, matching serial → idempotent. Writes a `duplicate_receive` event. Returns `200`.
- Existing tag, **different** serial → returns `409 and_match_failed`.

Other errors: `400 invalid_tag_format`, `422 invalid_location`.

### `POST /v1/scans/store`

Body:

```ts
{ asset_tag, location, user_id, scan_payload }
```

Transitions the asset to `stored`. Allowed from `received` or `in_service` (removing it from a rack back into storage).
Errors: `404 unknown_asset`, `422 invalid_transition`.

### `POST /v1/scans/deploy`

Body:

```ts
{ asset_tag, location, user_id, scan_payload }
```

Location **must** include `site`, `room`, `rack`, and `ru`. Transitions the asset to `in_service`. Allowed from `received` or `stored`.

Errors: `404 unknown_asset`, `422 invalid_transition`, `422 incomplete_deploy_location`.

### `POST /v1/scans/transfer`

Body:

```ts
{
  asset_tag: string;
  to_custodian: string;   // badge / user_id of the receiving party
  user_id: string;        // logged-in user — the FROM custodian
  scan_payload: string;
}
```

Changes the custodian only. State is unchanged. Allowed in `received`, `stored`, `in_service`. Rejected when `to_custodian` equals the current custodian.

Errors: `404 unknown_asset`, `422 invalid_transition` (disposed/unreceived), `422 same_custodian`.

### `GET /v1/mock/facilities/spaces`

Static mock. Returns the facilities-system view of where instruments are physically racked. Different schema from `Asset`:

```ts
{
  space_id: string;          // facilities-system internal id
  tagged_id: string;         // matches Asset.asset_tag
  rack_location: string;     // flat string: "Site/Room/Row/Rack/RU"
  last_observed: string;     // ISO 8601
}
```

Facilities only tracks items currently racked. Items in receiving, storage, or RMA staging won't appear here.

### `POST /v1/mock/facilities/spaces`

Upserts (or removes) a rack location for one asset.

```ts
{
  tagged_id: string;
  rack_location: string | null;   // null removes the row (de-rack)
}
```

`last_observed` is set to the current time. Cleared by `/v1/reset`.

### `GET /v1/mock/finance/equipment`

Static mock. Returns finance's view. Different schema again:

```ts
{
  finance_id: string;        // e.g., "EQ-44211"
  tag: string;               // matches Asset.asset_tag
  site: string;              // building level only
  book_value_usd: number;
  status: "capitalized" | "pending_receipt" | "retired" | "impaired";
  capitalized_on: string | null;
}
```

### `POST /v1/mock/finance/equipment`

Upserts a finance record for one asset.

```ts
{
  tag: string;
  site?: string;
  status: "capitalized" | "pending_receipt" | "retired" | "impaired";
  book_value_usd?: number;
  capitalized_on?: string | null;
}
```

Cleared by `/v1/reset`.

### `POST /v1/reset`

Wipes the database and re-seeds ~1,000 starter assets. Returns:

```json
{ "ok": true, "reseeded_at": "2026-05-12T17:33:00.000Z" }
```

## Schemas

### `Location`

```ts
{
  site: string;
  room: string | null;
  row: string | null;
  rack: string | null;
  ru: string | null;   // vertical position inside a rack
}
```

### `Asset`

```ts
{
  asset_tag: string;          // /^C\d{7}$/
  serial: string;
  model: string;
  manufacturer: string;
  asset_class: "instrument" | "compute" | "network" | "power" | "consumable_durable";
  state: "unreceived" | "received" | "stored" | "in_service" | "rma_pending" | "disposed";
  location: Location;
  custodian: string;
  parent_asset_tag: string | null;
  procurement_note: string | null;  // free-text from procurement
  created_at: string;         // ISO 8601
  updated_at: string;         // ISO 8601
}
```

### `Event`

```ts
{
  id: string;                 // ulid
  asset_tag: string;
  event_type: "receive" | "store" | "deploy" | "rma_open" | "rma_receive_back" | "dispose" | "duplicate_receive" | "transfer_custody";
  from_state: string | null;
  to_state: string;
  from_location: Location | null;
  to_location: Location;
  user_id: string;
  scan_payload: string;
  timestamp: string;
}
```

## Error codes

| Code | HTTP | When |
|---|---|---|
| `unknown_asset` | 404 | No such asset_tag |
| `and_match_failed` | 409 | Receive scan: tag exists, serial doesn't match |
| `invalid_transition` | 422 | State machine rejects |
| `invalid_location` | 422 | Location doesn't conform to schema |
| `invalid_payload` | 422 | Mock write body fails validation |
| `incomplete_deploy_location` | 422 | Deploy is missing site/room/rack/ru |
| `invalid_tag_format` | 400 | asset_tag doesn't match `/^C\d{7}$/` |
| `same_custodian` | 422 | Transfer `to_custodian` matches the current custodian |
| `internal_error` | 500 | Unexpected |

## State machine

```
unreceived → received → stored ⇄ in_service → rma_pending → received (back from RMA)
                            ↓                       ↓
                        disposed                disposed
```

| From | To | Via event |
|---|---|---|
| `unreceived` | `received` | receive |
| `received` | `stored` | store |
| `received` | `in_service` | deploy |
| `stored` | `in_service` | deploy |
| `stored` | `disposed` | dispose |
| `in_service` | `stored` | store |
| `in_service` | `rma_pending` | rma_open |
| `in_service` | `disposed` | dispose |
| `rma_pending` | `received` | rma_receive_back |
| `rma_pending` | `disposed` | dispose |

Only `receive`, `store`, `deploy`, and `transfer_custody` (state-preserving) are exposed as scan endpoints in v1.
