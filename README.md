# Asset tracking — Cerebras AI Builder Challenge submission

Submission for the Cerebras AI Builder Challenge (asset tracking).

A multi-site research lab tracks instruments across three systems that disagree by default — operations, facilities, finance. This app is the place techs and managers come to keep them aligned.

- **Tech surface (`/tech`)**: receive, store, deploy, transfer. Built for one hand on a phone in a cold dock bay. Keyboard-wedge scanners and phone cameras both work.
- **Manager surface (`/manager`)**: paginated, filterable asset list with a drift topline that tells the manager whether anything actually needs them.
- **Reconciliation (`/manager/reconcile`)**: server-side join of all three sources, classified into *needs action / watch / info* and grouped by category — not a raw diff.
- **Test sheet (`/dev/barcodes`)**: print-ready Code 128 barcodes for assets, locations, and badges, picked to cover the interesting edge cases (drifted, ghost, disposed).

## Quick start

```bash
pnpm install         # or npm i, see "If pnpm rebels" below
pnpm dev             # API on :8080, starter on :3000

# in another shell, when you want to wipe state and re-seed
curl -X POST http://localhost:3000/api/upstream/reset
```

Open <http://localhost:3000>. The header role switcher toggles between `tech-jane` and `manager-paul`; the active role attaches to every scan server-side from the cookie.

If pnpm rebels (it might on Node 25 — see *Notes from building this*), the starter and API will both run with `npx` directly:

```bash
# Terminal 1
cd api && npx tsx watch src/index.ts
# Terminal 2
cd starter && npx next dev -p 3000
```

## Three calls I nearly made the other way

### 1. Where the facilities/finance write-back lives

The brief says it's the candidate's call: client, proxy, or a server route handler. I wired it into a thin server orchestrator at `app/api/scans/[type]/route.ts`. Each handler calls the upstream scan, then (for `deploy` and `store-from-in_service`) calls the facilities/finance mocks, and returns `{ asset, side_effects: [...] }` so the UI can show the tech *exactly* what wrote where.

I almost put the writes inline on the client. The seductive case: simpler — fire the scan, then on success fire two more `fetch`es. But the orchestration buys three things:

- **One progress indicator, one error surface.** Three independent client calls means three independent loading states the tech has to interpret. A server route lets the success banner say "deploy + facilities + finance, all done" with one spinner.
- **Server-resolved `user_id`.** The client never gets to forge a custodian; the cookie role is read in the route handler. That's a posture choice — the brief explicitly omits auth, but I'd rather build *as if* it were real.
- **Side-effect transparency.** Because the route returns the per-system result, when the facilities mock 500s the tech sees "✓ scan, ✓ finance, ✗ facilities — flag this" rather than a green check that hides a half-finished operation.

The downside I accepted: the tech makes one extra hop. At ~1k assets and a local API it's invisible; if the API moved across a region this would become latency I'd want to optimize.

### 2. Reconciliation as a *list of categories*, not a *list of diffs*

The naive read of "build a reconciliation report" is: walk all three sources, emit a row for every disagreement, sort by tag. I built and threw away that version — it produced a 700-row table that a manager can't act on.

The version I shipped classifies into three severities and seven categories, with the category names tuned to the action the manager would take:

| Category | What it actually means |
|---|---|
| Rack mismatch | Someone moved the unit without scanning. Walk the row, find it, scan it. |
| Missing in facilities | Deploy never wrote OR facilities lost the row. Re-deploy. |
| Disposed but capitalized | Finance still has it on the books. Send finance the retire-out. |
| Site mismatch | Finance bills the wrong building. Email finance, link the asset. |
| Ghost in facilities/finance | Tag known to one downstream system but not ops. Either un-received or bad data. |
| Stale facilities observation | More than 30 days since last walk. Audit during the next sweep. |
| Finance pending after receive | Billing-cycle lag. Becomes "Needs action" if it persists past two weeks. |

The other call I made here: I do *not* surface "explained-by-state" diffs by default. An asset in storage *should* be absent from facilities — that's not drift, that's the schema. Surfacing it as an issue would teach the manager to ignore the report. The manager sees the count under "Info" so they know the system thought about it; the rows themselves stay collapsed.

The other version I considered: showing just the seven needs-action items as a flat priority list with no grouping. It's tidier but it scales worse — when a single botched migration produces 80 rack mismatches, a flat list reads as a fire when the action is one bulk fix.

### 3. The `LocationFields` component lets the tech edit the location, not just scan one

The minimal deploy flow is: scan asset, scan location barcode (which I encode as `LOC|site|room|row|rack|ru`), POST. Done. I implemented that and it works.

But it's brittle. The dock bay won't always have a printed location label for every rack RU; sometimes the tech is correcting a bad scan; sometimes they need to fix the row but not the rack. I added an editable form *underneath* the scan input that pre-fills from the asset's last-known site (so an in-building move doesn't require typing the site again) and highlights required fields in amber. The scan is the fast path; the form is the recovery path.

The cost: more screen real-estate, more visual complexity. The benefit: the tech never gets stranded staring at an error they can't resolve from the current screen. Given the "11pm in a cold dock bay" framing, I'd rather be slightly busier than slightly stuck.

## What I deliberately didn't build

- **Bulk receive / CSV import.** Out of scope per brief.
- **Optimistic UI.** A lab tech wants the system's word that the scan landed before they walk away from the rack — not a green check that gets revoked five seconds later. Every workflow waits for the round trip and shows the side-effect log on success.
- **Search-as-you-type on the manager list.** Submitted-on-Enter / on-blur. At 1k rows debounced search would be fine; at 100k it would melt the API. The conservative choice is consistent at both scales.
- **Pretty timestamps everywhere.** Manager surfaces use `relativeTime` for the scanning eye, with the full ISO timestamp on `title=` hover. Tech log uses raw seconds/minutes — the tech's frame of reference is "what just happened," not "what day was it."
- **Dark mode.** Tailwind defaults are fine for this scope.
- **A loading skeleton for the manager dashboard.** Server components render synchronously; the user sees a complete page or an empty state, not a flicker. If the upstream were slower I'd add one.

## Architecture notes

```
starter/
  app/
    api/
      upstream/[...path]/route.ts    # token-attaching proxy (provided)
      reconcile/route.ts             # server-side three-way join
      scans/{receive,store,deploy,transfer}/route.ts   # orchestrators
    tech/{receive,store,deploy,transfer}/page.tsx      # scan workflows
    manager/
      page.tsx                       # asset list + filters + drift topline
      assets/[tag]/page.tsx          # detail + facilities/finance views + log
      reconcile/page.tsx             # categorized report
    dev/barcodes/page.tsx            # printable test sheet
  components/                        # AssetTable, EventTimeline, ScanField, ...
  lib/
    reconcile.ts                     # pure classifier — TESTED
    locations.ts                     # payload encoders/parsers — TESTED
    scan-server.ts                   # write-back orchestration
    client-scans.ts                  # browser → /api/scans/* wrappers
    format.ts                        # state/event labels, error guidance
test/
  reconcile.test.ts                  # 12 tests
  locations.test.ts                  # 13 tests
  ScanInput.test.tsx                 # 3 tests (provided)
```

The classifier and the location parser are pure functions with no Next/React dependencies. They get unit tests; the React components do not (the cost is high, the value is low at this code volume — taste, not theology).

## Pushback on the brief

A few small things flagged in good faith:

1. **`tips.md` says "doing it in the browser ships the token; doing it in your scan API route doesn't."** That's not quite right as written — the provided proxy at `/api/upstream/*` already attaches the token server-side, so a browser `fetch('/api/upstream/...')` doesn't ship the token either. The real argument for moving the orchestration server-side is atomicity / single error surface / server-resolved identity, not token leakage. I went server-side anyway, but for those reasons.
2. **`api-reference.md` lists the receive error code as `and_match_failed`.** I've kept the spelling because that's what the API actually returns (`{"error":{"code":"and_match_failed",...}}`), but my best guess is this was intended to be `serial_match_failed`. The string `and_match_failed` doesn't carry meaning. Worth renaming or aliasing on the API side.
3. **The brief says "no auth"** but the seeded data uses `tech-jane` / `tech-mike` / `manager-paul` etc. as `user_id` and the role switcher mints them from a cookie. That's fine for a take-home, but flagged as a posture decision: I treated `user_id` as something the *server* sets (from the cookie) rather than something the client passes, so the design wouldn't need to change shape if you bolted real SSO on.

## A piece of microcopy I'm proud of

The empty state on `/manager/reconcile` when nothing is broken:

> **Nothing to reconcile.** All three systems agree on every asset. Most weeks you'll have something here — enjoy the quiet one.

I wrote a long version that explained what the report does ("This page shows...") and a terse version that said "All systems agree." The version I shipped does three things at once: it confirms the report ran (vs. failed silently), it sets the manager's expectation that this is unusual (so they don't think they broke it), and it gives them permission to close the tab. Most empty states pretend the absence of data is normal; this one names it as the rare case it actually is.

Walking through the deploy success banner in the Loom is on my list too — the side-effect strip ("✓ facilities · ✓ finance") is what makes the write-back visible without making the tech parse a JSON response.

## Tech stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind 3
- `@zxing/browser` for the camera scanner (lazy-imported so non-camera flows skip the bundle)
- `bwip-js` for server-rendered Code 128 PNGs on the barcode page
- Vitest for unit tests

## Notes from building this

- **pnpm workflow on Node 25.** The `dev`/`install` chain in `pnpm@11.1.1` against Node 25 had a sharp edge: the `verify-deps-before-run` check tries an implicit `pnpm install` which then trips on the unsigned native build scripts (`better-sqlite3`, `sharp`, `unrs-resolver`). I added an `.npmrc` (`verify-deps-before-run=false`) and rebuilt `better-sqlite3` from source, which got everything green. The README's quick-start has a `npx`-only fallback for anyone who hits the same.
- **Reset endpoint.** `POST /api/upstream/reset` re-seeds the namespace. Run it before recording the Loom so the demo runs against known state.
- **Why `/api/scans/*` and not just `/api/upstream/scans/*`?** See call #1 above. The upstream proxy is still there and is still what the browser hits for read endpoints (assets list, asset get, history) — only writes go through the orchestrator.

## Submitting

Per the challenge brief, the submission has three pieces:

- **Public URL** — once deployed (Vercel one-click works)
- **Repo link** — this fork
- **3–5 minute Loom** — features built, one alternative design call, one piece of microcopy

The deployed URL and Loom go in the form at <https://forms.gle/6gxhe8Js98KGqSDx8>.

---

*Original challenge starter README at [`./starter/README.md`](./starter/README.md). MIT licensed — see [`./LICENSE`](./LICENSE).*
