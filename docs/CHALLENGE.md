# Asset tracking — take-home challenge

**Time:** ~10–12 hours of focused work, spread however you like.
**AI tools:** Encouraged. They speed up typing; they don't replace judgment.
**Stack:** Next.js (App Router) + TypeScript + Tailwind. Swap libraries inside the stack, not the stack itself.
**Deliverable:** A deployed URL, a repo link, and a 3–5 minute Loom.

## What we value

We're hiring for **judgment and taste**, not feature count. Two candidates can build the same set of pages and one of them gets the offer because of which fields they showed, which words they chose, and which things they decided not to build. Show your work:

- In your README, write a short section called **"Three calls I nearly made the other way."** Three places where you considered a different design and explain why you picked the one you picked.
- In your Loom, walk us through **one piece of microcopy** you wrote — an empty state, an error message, a column header — and explain why it's worded the way it is.
- If you find a bug, an inconsistency, or a confusing claim in this brief or the starter, **flag it in your README**. Pushback is a positive signal.

We will read every README. We will watch every Loom. Both count as much as the code.

## How this works

A hosted API holds ~1,000 seeded assets, an event log per asset, three scan endpoints (receive, store, deploy), and two static mocks for facilities and finance. You build the UX on top. `POST /v1/reset` wipes your namespace clean.

At ~1,000 rows your manager list needs real pagination and filtering, and edge cases on loading and empty states actually surface. A dozen of the seeded assets disagree across systems on purpose; the rest are clean.

Read [`docs/api-reference.md`](../starter/docs/api-reference.md) — it's the contract.

## Context

A multi-site research lab tracks thousands of instruments — sequencers, mass specs, switches, compute. Three systems each hold a partial view:

- **Operations** (the API): where it is, who has it, what state it's in.
- **Facilities management**: rooms, benches, racked instruments. Doesn't track non-racked items or retired equipment.
- **Finance/ERP**: purchase orders, book values, capitalization status. Doesn't see below the building level.

They drift apart constantly. Your job is to make all three usable enough that techs don't skip scans and managers can act.

Background on why this kind of system exists: [`docs/CONTEXT.md`](./CONTEXT.md). Optional.

## What to build

### 1. Scan workflows under `/tech`

Four screens — `/tech/receive`, `/tech/store`, `/tech/deploy`, `/tech/transfer`. Picture the user: a lab tech at 11pm in a cold dock bay, gloves on, scanner in one hand, a 40lb instrument in the other. Build for that person.

The tech's device can be either: (a) a desktop or tablet with a USB/Bluetooth handheld scanner that types into the focused input and presses Enter, or (b) **a phone using its camera as the scanner**. Both flows should feel native. For the camera path, pick a library — `@zxing/browser` and `html5-qrcode` are both fine; we expect you'll lean on AI to wire it up.

`/tech/transfer` is a two-sided custody handoff. Scan the asset, then scan the receiving party's badge. The logged-in user is the *from* side automatically — only the receiving side gets an explicit scan. State doesn't change; custodian does. The badge value is just the receiving user's ID (`tech-mike`, `manager-paul`, etc.).

The API enforces the rules (state machine, idempotency on duplicate receive, location completeness for deploy — see [`api-reference.md`](../starter/docs/api-reference.md)). The interesting decisions sit above the API: what does a successful scan feel like? What does a confusing scan feel like? What's the recovery path when the tech messes up?

Use the included `<ScanInput>` as a starting point or replace it.

**Deliverable: barcodes we can actually scan.** Ship some way — a `/dev/barcodes` page, a printable PDF, a one-shot script, your call — to generate scannable Code 128 (or QR) barcodes for a handful of assets (covering the interesting cases — drifted, ghost/orphan, disposed) and a handful of locations.

### 2. Manager dashboard under `/manager`

Two screens — `/manager` (asset list) and `/manager/assets/[tag]` (asset detail). An asset manager opens these at 8:55am before standup. They have about 60 seconds. What do they need to see first, what can wait, what should they never see at all?

The event log is the manager's main forensic tool — surface it well.

### 3. Writing back to facilities and finance

The facilities and finance mocks also accept POSTs — they're not read-only. On a successful scan, your app should keep them in sync:

- **deploy** (asset enters service) → POST to facilities (asset now at this rack) and finance (capitalize it).
- **store from `in_service`** (de-racking) → POST to facilities with `rack_location: null` to remove it.
- All other scans don't write — receive/store-from-received/transfer leave facilities and finance untouched.

GET-after-POST reflects your write. `/v1/reset` clears the writes. If you skip this, your reconciliation report will show drift after every deploy — useful for testing, but not the desired end state.

Decide where the writes live (client, proxy, server route handler). Same token-security argument as the reconcile route. Explain in your README.

### 4. Three-way reconciliation

The API exposes operations data plus two mocks at `GET /v1/mock/facilities/spaces` and `GET /v1/mock/finance/equipment`. The schemas differ from operations and from each other deliberately.

Build:

- A **server-side route handler** at `app/api/reconcile/route.ts` that pulls all three sources, joins them, and returns a structured report. The token can't leak to the browser, and the join is the testable part.
- A **page** at `/manager/reconcile` that renders the report.

Not every difference is a problem. Some are real. Some are explained by state. Some need a human. **Decide the categories yourself** and **explain them to a non-technical asset manager** who runs this every Monday. The labels you pick and how you rank them are the work.

### Auth

Out of scope. Use the cookie-based role switcher (`<RoleSwitcher>` in the header) to flip between `tech-jane` and `manager-paul`. The API bearer token lives server-side; the starter proxies browser requests through `app/api/upstream/*` so it never reaches the client.

## What's NOT required

Save time by not building:

- Hardware integration. A USB/Bluetooth scanner types into your input like a keyboard; a phone camera decodes via a JS library. No driver code, no pairing flow.
- Backend hardening (rate limit tuning, retries, queuing). The API is rate-limited at 60 req/min.
- The RMA workflow. The state machine supports it; you don't need a UI.
- Offline mode, syncing, conflict resolution.
- Brand styling. Tailwind defaults are fine — just make conscious choices.
- An accessibility audit. `aria-label` on icon buttons and reasonable contrast is enough.
- Authentication, SSO, password flows.
- Bulk import/export.

## What we're looking for

Six things. No weights, no rubric.

1. **Scan UX taste.** Did you understand the hot-path constraint? Would the tech in the dock bay actually use this?
2. **Reconciliation depth.** Did you categorize, or did you just diff? Reading your report, could a manager act?
3. **Manager view as information design.** What's at the top? What's missing? What did you choose to hide?
4. **Code judgment.** Where you factored out, where you kept it inline. What you tested, what you didn't.
5. **What you chose not to build.** Subtraction is a skill. Name the things you decided weren't worth it, and why.
6. **Communication.** Your README, your Loom, your commit messages. Tell us what you decided and why.

## How to submit

Fill out this form: **https://forms.gle/6gxhe8Js98KGqSDx8**

You'll be asked for:

- A **public URL** where the app runs. The Vercel one-click button in the starter's README works.
- A **GitHub link** to your repo.
- A **3–5 minute Loom** covering: what you built, one call you nearly made the other way, and one piece of microcopy you're proud of.

We'll review and follow up to schedule a follow up call.

## A note on what we test

When we review your submission, we'll exercise scenarios beyond the happy path documented here — edge cases, error states, what a tech does the wrong way twice in a row, what a manager sees on their first cold load of a page they've never seen. We deliberately don't enumerate the scenarios. Build for the cases you can imagine us trying, even when we haven't named them. Robustness is taste, too.

A short happy-path checklist lives at [`starter/docs/happy-path.md`](../starter/docs/happy-path.md) — run through it before you submit to make sure the foundation works. It is **not** the test we run.

## Honest notes

- **Polish matters more when code is cheap.** If AI is typing for you, spend the saved time on taste — the right empty state, the right error message, the right thing to show first.
- **Ambiguity is a feature.** The brief is intentionally underspecified in places. That's where we want to see your judgment. Document the calls you made.
- **The reset endpoint is your friend.** `POST /v1/reset` returns your namespace to a clean state. Use it before recording your Loom.

Sharp clarifying questions are welcome; they're a positive signal. Email us.
