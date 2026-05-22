# Asset tracking — Cerebras AI Builder Challenge submission

Submission for the Cerebras AI Builder Challenge (asset tracking).

A multi-site research lab tracks instruments across three systems that disagree by default — operations, facilities, finance. This app is the place techs and managers come to keep them aligned.

- **Tech surface (`/tech`)**: receive, store, deploy, transfer. Built for one hand on a phone in a cold dock bay. Keyboard-wedge scanners and phone cameras both work. Continuous-scan mode: the success banner stays visible while the input immediately re-arms for the next scan — no auto-dismiss timer, no waiting.
- **Manager surface (`/manager`)**: paginated, filterable asset list with a drift topline, sortable column headers, sticky table header on scroll, drift dots on rows that need attention, removable filter chips, and filter state preserved through to the asset detail page.
- **Reconciliation (`/manager/reconcile`)**: server-side join of all three sources, classified into *needs action / watch / info* and grouped by category — not a raw diff. Ghost issues link directly to `/tech/receive?tag=…` because the action is to receive the asset for the first time. **Export CSV** so the manager can pipe the list into whatever tool their procurement team actually uses.
- **Test sheet (`/dev/barcodes`)**: print-ready Code 128 barcodes for assets, locations, and badges, picked to cover the interesting edge cases (drifted, ghost, disposed). Print stylesheet collapses the page chrome and forces one card per row.

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

### 1. Continuous-scan mode instead of timed auto-reset

The first version of the success banner used a 4-second auto-dismiss timer: scan, see the green check, watch it fade, then start the next scan. It demoed beautifully and was wrong for the actual job.

A tech who's just received an asset isn't sitting and watching the screen. They're already moving the next box onto the dock. By the time their attention comes back, the banner has either disappeared (so they can't tell whether the last scan landed) or it disappears mid-glance (so they squint and lose their place). The 4-second window is long enough to feel slow and short enough to feel anxious.

What shipped: the success banner stays put until either the next successful scan replaces it or the tech dismisses it explicitly. The scan input clears and re-focuses *immediately*, so the next scan can begin before the eye has even tracked back to the screen. `Esc` clears the in-progress form. On phones, `navigator.vibrate` gives a short double-pulse on success and a longer single buzz on error so the tech can tell what happened without looking. `aria-live="polite"` on the banner means screen readers announce the result without interrupting what the user is reading.

I almost left the timer in because the timed version "feels modern." It's the visible-design vs. used-design tradeoff — what helps the demo isn't what helps the rhythm of a hundred-scan shift.

### 2. Receive prefills from existing asset records

The naive receive flow asks the tech to type serial, model, manufacturer, and class for *every* scan, fresh, even when the same tag has been received twenty times before. The API supports duplicate-receive idempotently — but only if the tech retypes the serial correctly. So duplicate-receive in practice becomes "tech mistypes the serial → API rejects with `and_match_failed` → tech curses → tech recovers."

What shipped: when the scanned tag is already known, the form prefills serial / model / manufacturer / class from the existing record. The tech reads the form, glances at the unit in their hand, and either confirms (`and_match_failed` becomes impossible because we sent back what was on file) or *edits* a field — at which point the field turns amber with a small "edited" badge so the tech sees they're about to tell the system "this unit doesn't match what we had on file."

The tradeoff: the receive form is now context-aware in a way the brief doesn't ask for, and the prefill costs an extra `GET /assets/:tag` round-trip on every scan. The round-trip is one local network hop and the prefill is the difference between a 30-second flow and a 5-second confirm — well worth it.

### 3. Reconciliation as a *list of categories*, not a *list of diffs*

The naive read of "build a reconciliation report" is: walk all three sources, emit a row for every disagreement, sort by tag. I built and threw away that version — it produced a 700-row table that a manager can't act on.

The version I shipped classifies issues into two severities (`needs_action` and `watch`) and the following categories, with names tuned to the action the manager would take:

| Category | What it actually means |
|---|---|
| Rack mismatch | Someone moved the unit without scanning. Walk the row, find it, scan it. |
| Missing in facilities | Deploy never wrote OR facilities lost the row. Re-deploy. |
| Missing in finance (in_service / disposed) | We're operating or disposed something finance never billed. Chase procurement. |
| Disposed but capitalized | Finance still has it on the books. Send finance the retire-out. |
| Site mismatch | Finance bills the wrong building. Email finance, link the asset. |
| Ghost in facilities/finance | Tag known to one downstream system but not ops. Either un-received or bad data. |
| Stale facilities observation | More than 30 days since last walk. Audit during the next sweep. |
| Finance pending after receive | Billing-cycle lag. Becomes "Needs action" if it persists past two weeks. |
| Awaiting finance (received / stored / rma_pending) | Likely a PO not yet on the books. Check after next billing cycle. |

Verified against the seed: the report catches **all 8 deliberately-planted drift cases** in `api/src/seed/` — the three rack mismatches, the disposed-but-capitalized row, both ghosts, the stale observation, and the seeded `C0000107` (received in ops, never written to finance). I caught the C0000107 case late in development — initial implementation only checked finance fields when a finance row existed, which silently passed seeded drift. Reading the seed file directly is how I noticed.

The other call I made here: I do *not* surface "explained-by-state" diffs by default. An asset in storage *should* be absent from facilities — that's not drift, that's the schema. Surfacing it as an issue would teach the manager to ignore the report. The manager sees the count under "Info" so they know the system thought about it; the rows themselves stay collapsed.

The other version I considered: showing just the seven needs-action items as a flat priority list with no grouping. It's tidier but it scales worse — when a single botched migration produces 80 rack mismatches, a flat list reads as a fire when the action is one bulk fix.

### Honorable mentions

- **`LocationFields` lets the tech edit, not just scan.** The minimal deploy flow is scan-asset → scan-location → POST, and I shipped that as the fast path. But not every rack has a printed `LOC|…` label, and sometimes the tech is correcting a bad scan. The editable form underneath pre-fills from the asset's last-known site and highlights required fields in amber when empty. Cost: more pixels. Benefit: the tech never gets stranded.
- **Where the facilities/finance write-back lives.** Server orchestrator at `app/api/scans/[type]/route.ts` so the success banner can show one progress state and a per-system side-effect strip ("✓ facilities · ✓ finance" or "✗ facilities — upstream offline"), with `user_id` server-resolved from the cookie. Almost did it client-side — three uncoordinated `fetch`es means three loading states the tech has to interpret.

## What I deliberately didn't build

- **Bulk receive / CSV import.** Out of scope per brief.
- **Optimistic UI.** A lab tech wants the system's word that the scan landed before they walk away from the rack — not a green check that gets revoked five seconds later. Every workflow waits for the round trip and shows the side-effect log on success.
- **Search-as-you-type on the manager list.** Submitted-on-Enter / on-blur. At 1k rows debounced search would be fine; at 100k it would melt the API. The conservative choice is consistent at both scales.
- **Pretty timestamps everywhere.** Manager surfaces use `relativeTime` for the scanning eye, with the full ISO timestamp on `title=` hover. Tech log uses raw seconds/minutes — the tech's frame of reference is "what just happened," not "what day was it."
- **Dark mode.** Tailwind defaults are fine for this scope.
- **A bulk "mark all resolved" affordance on the reconcile report.** No resolution endpoint upstream, and faking it would teach the manager the wrong mental model. The report regenerates from current state every open — that *is* the resolution mechanism.
- **An offline scan queue.** Hard problem, low value at this prototype scope. Flagged at the bottom of `docs/CONTEXT.md` as something a real system would do; the design wouldn't need to change shape to layer it on (every scan goes through one client wrapper).

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
  reconcile.test.ts                  # 16 tests — classifier (incl. missing_in_finance, format normalization)
  scan-server.test.ts                # 7 tests — orchestration (writes for deploy, de-rack, no-write paths)
  locations.test.ts                  # 15 tests — payload encoder/parser + rack normalizer
  tag-validate.test.ts               # 5 tests — context-aware scan rejection (LOC|/BADGE|/garbage)
  csv.test.ts                        # 4 tests — RFC-4180 reconcile export
  ScanInput.test.tsx                 # 3 tests (provided)
  sort-assets.test.ts                # 7 tests — sort key parsing + lifecycle-ordered state
```

57 tests, all green. The classifier, the orchestrator, and the location parser are the things whose behavior I want pinned — they're pure-ish (the orchestrator is mocked at the api-client boundary) and they encode the policy decisions. The React components don't get unit tests; component-test cost is high and the value is low at this code volume.

## Pushback on the brief

A few things flagged in good faith. Listed in order of how operationally important they are to the candidate experience.

1. **The brief says *"A hosted API holds ~1,000 seeded assets"* — implying Cerebras hosts the API for candidates.** No URL appeared in the candidate email or anywhere in the public repo. I diagnosed this when my Vercel frontend needed an upstream to point at — at which point I deployed the API to Render myself (`api/Dockerfile` was almost there; one corepack/pnpm incompatibility on Alpine had to be swapped to `npm`, see commit `1115841`). If the hosted endpoint was meant to ship, every candidate is silently hitting this. If "you'll host one yourself" was the intent, the wording *"A hosted API holds"* reads as past-tense fact rather than future-tense expectation. Worth either providing a `API_BASE_URL` in the candidate email or rewording to *"You'll deploy a small API alongside your frontend; the API in `api/` is what you'll be hosting."*
2. **`api-reference.md` lists the receive error code as `and_match_failed`.** I've kept the spelling because that's what the API actually returns (`{"error":{"code":"and_match_failed",...}}`), but my best guess is this was intended to be `serial_match_failed`. The string `and_match_failed` doesn't carry meaning. Worth renaming or aliasing on the API side.
3. **The seed has two different conventions for serializing rack locations.** `api/src/seed/procedural.ts` joins location parts with `.filter(Boolean)` (drops null slots), while a candidate following the `Location` type literally would write `Site/Room//Rack/RU` for a row-less rack. Either format works against the mock (it just stores the string), but mixed conventions in the same dataset mean a naive string-compare reconcile would flag false drift. My reconcile normalizes both sides via `normalizeRackPath` before comparing; my writer matches the seed convention. Worth either canonicalizing on the mock-write side or documenting the expected format in the brief.
4. **The brief says "no auth"** but the seeded data uses `tech-jane` / `tech-mike` / `manager-paul` etc. as `user_id` and the role switcher mints them from a cookie. That's fine for a take-home, but flagged as a posture decision: I treated `user_id` as something the *server* sets (from the cookie) rather than something the client passes, so the design wouldn't need to change shape if you bolted real SSO on.

(Also: the upstream `api/Dockerfile` pins both `node:20-alpine` and `pnpm@11.1.1` via corepack, but pnpm 11.1.1 requires Node 22.13+ — it uses the Node 22 built-in `node:sqlite` — so `pnpm install` crashes immediately with `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`. And the starter ships `next@15.0.4` which Vercel blocks at deploy time per CVE-2025-66478. Both were workable around with one-line fixes; mentioning so the next intake doesn't lose half an evening to them.)

## A piece of microcopy I'm proud of

The empty state on `/manager/reconcile` when nothing is broken:

> **Nothing to reconcile.** All three systems agree on every asset. Most weeks you'll have something here — enjoy the quiet one.

I wrote a long version that explained what the report does ("This page shows...") and a terse version that said "All systems agree." The version I shipped does three things at once: it confirms the report ran (vs. failed silently), it sets the manager's expectation that this is unusual (so they don't think they broke it), and it gives them permission to close the tab. Most empty states pretend the absence of data is normal; this one names it as the rare case it actually is.

The other piece I'd call out is the receive prefill banner. When the scanned tag is already on file, the form fills in and the tech sees:

> **Tag already on file.** Fields prefilled from the existing record. If the unit in your hand matches, just hit submit and we'll log a duplicate. If the serial is different, edit it and we'll surface the conflict.

Three sentences, three jobs: explain why the form looks pre-filled, tell them what the happy path does (one tap → log a duplicate → done), and tell them what the divergent path looks like (edit → see the conflict). The microcopy IS the documentation for the duplicate-receive flow; I never had to teach a tech how this works.

## Tech stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind 3
- `@zxing/browser` for the camera scanner (lazy-imported so non-camera flows skip the bundle)
- `bwip-js` for server-rendered Code 128 PNGs on the barcode page
- Vitest for unit tests

## Accessibility & polish

- Skip-to-main-content link in the header for keyboard users
- `aria-live="polite"` on the success banner so screen readers announce successful scans
- `prefers-reduced-motion` honored — animations and transitions are disabled
- All scan inputs respond to `Esc` (clear) and `Enter` (commit)
- Focus management: after every successful scan, focus moves back to the next-step input automatically; `requestAnimationFrame` ensures the input is mounted before grabbing focus
- 44×44 minimum tap targets on every interactive control
- `loading.tsx` skeletons on the slower routes (manager dashboard, reconcile, asset detail) so navigation feels snappy
- Print stylesheet on `/dev/barcodes` strips chrome and forces one barcode per page for clean output

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
