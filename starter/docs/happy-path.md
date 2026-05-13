# Happy path

A short manual checklist you can run before submitting, to make sure the foundation of your build works. Takes about 5 minutes.

This is **not** the test we run against your submission — the brief tells you to expect scenarios beyond what's documented. Think of this as a smoke test: if you can't get through these ten steps cleanly, something deeper is broken.

## Setup

```bash
pnpm dev                    # API on :8080, starter on :3000
curl -X POST http://localhost:3000/api/upstream/reset   # clean namespace
```

Open http://localhost:3000.

## The path

| # | Where | Do this | Expect |
|---|---|---|---|
| 1 | `/tech/receive` | Scan a fresh tag (e.g. `C0009001`) with a new serial (e.g. `SN-DEMO-1`) and a complete-enough location | Asset is created; receipt event recorded |
| 2 | `/tech/receive` | Scan the **same** tag and **same** serial again | Idempotent — same asset returned, no error, a `duplicate_receive` event is logged |
| 3 | `/tech/receive` | Scan the same tag with a **different** serial | Clear, on-screen error. The user should see *which* serial conflicts, not just "error" |
| 4 | `/tech/store` | Scan `C0009001`, then scan a storage location (no `ru` needed) | Asset transitions to `stored`; store event recorded |
| 5 | `/tech/deploy` | Scan `C0009001`, then scan a deploy location **missing `ru`** | Clear, on-screen error. The user should know what's missing |
| 6 | `/tech/deploy` | Same scan, but with a complete location including `ru` | Asset transitions to `in_service`; deploy event recorded |
| 7 | `/tech/transfer` | Scan `C0009001`, then scan a different tech's badge (e.g. `tech-mike`) | Custodian changes; state stays `in_service`; transfer event recorded |
| 8 | `/manager` | Open the asset list | Your new asset appears alongside the seeded ones. Filtering by state should work |
| 9 | `/manager/assets/C0009001` | Open the asset detail | Current state visible. Event history visible, newest first, with the transfer event in there |
| 10 | `/manager/reconcile` | Open the reconciliation page | Renders a categorized report. Empty/error/loading states all reasonable. Your deploy in step 6 should have written to facilities + finance — verify it doesn't show up as drift |
| 11 | Mobile (DevTools 375px or a real phone) | Open `/tech/receive` on a small viewport | Tap targets are reachable. The input is focused. The camera scanner works if you built one |

## Reset between runs

Hit `POST /api/upstream/reset` to wipe your namespace clean before recording your Loom or running the path again.

## What it doesn't cover

The brief warns you that we'll test scenarios beyond this list. Things you might consider that aren't here:

- What does the asset list look like when there are zero matches for a filter?
- What does the event log look like for an asset with one event vs. ten?
- What does the reconciliation page look like when nothing is flagged?
- What happens when the upstream API is unreachable?
- What happens on a 429 rate-limit response?

Pass the happy path. Then think about what could go wrong, and decide which of those is worth handling.
