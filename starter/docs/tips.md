# Tips

Short notes before you start coding.

## The scan input

`<ScanInput onScan={fn} />` is a thin wrapper around an `<input>`. It auto-focuses on mount, fires `onScan(trimmed)` on Enter, clears, and re-focuses. Replace it if you need a different shape.

Two things worth keeping if you build your own:

- Focus shouldn't leave the input when an error appears. The tech's next action is the next scan; don't make them tap the input again.
- Enter on an empty value should be a no-op.

## Errors

The API returns structured errors:

```json
{ "error": { "code": "and_match_failed", "message": "...", "details": { ... } } }
```

`ApiError` in `lib/api-client.ts` exposes `status`, `code`, and `details`. Branch on `code`, not on the message string. The codes you'll see most:

- `and_match_failed` — receive scan with a mismatched serial. Surface the existing serial in your UI so the tech can compare.
- `invalid_transition` — wrong state for this scan. Show the asset's current state.
- `incomplete_deploy_location` — deploy without rack or ru.
- `unknown_asset` — scanned tag isn't in the database.

Generic catch-all messages ("Something went wrong") are worse than no error. Read the code and tell the user what to do.

## Token wiring

The bearer token stays server-side.

- **Browser code** (scan pages, manager list, asset detail): use `api` from `lib/api-client.ts` as normal. It hits `/api/upstream/*`, a proxy that attaches the token.
- **Server route handlers** (your reconciliation route): same `api` import. On the server it talks to `API_BASE_URL` directly with `API_TOKEN`.

Don't reach for `NEXT_PUBLIC_API_TOKEN`. Use the proxy.

## Why reconciliation lives server-side

Keep the join in `app/api/reconcile/route.ts`, not in the page. The join is testable in one place; the page just fetches a JSON document and renders it.

## Reset

`POST /v1/reset` wipes the database back to the seeded ~1,000 assets. Run it before recording your Loom so the demo runs against known state. `api.reset()` does it from the client.

A reset button in dev UI is fine; don't leave one on a production surface.

## Writing back to facilities and finance

The mocks accept POSTs. The expected pattern:

- A successful `deploy` → POST to `/v1/mock/facilities/spaces` (set rack location) and `/v1/mock/finance/equipment` (status: `capitalized`).
- A successful `store` *from* `in_service` → POST to `/v1/mock/facilities/spaces` with `rack_location: null` to remove the row.
- Receive, store-from-received, and transfer don't trigger writes.

Where you fire the write matters: doing it in the browser ships the token; doing it in your scan API route doesn't. The same security argument as the reconcile route applies.

If you skip these, your reconcile report will show drift on every freshly-deployed asset. Use that as a unit test.

## Common misses

- The match logic on receive: a duplicate tag with a matching serial is idempotent; a duplicate tag with a *different* serial is an error. Both cases real at the dock.
- Showing the asset's current state on the store / deploy screens *after* scanning the tag, before committing. Lets a tech catch "this isn't where it's supposed to be."
- Empty states. The asset list, the event log, the reconciliation report — what does each look like with zero rows?
- The event log comes back newest-first. Render it that way.
