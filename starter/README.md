# Asset tracking — challenge starter

Welcome. **Read [`../docs/CHALLENGE.md`](../docs/CHALLENGE.md) first** — it explains what you're building. If you want more narrative on *why* this kind of system exists, [`../docs/CONTEXT.md`](../docs/CONTEXT.md) is optional background.

This README is operational: how to install, run, and deploy.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FREPLACE_WITH_YOUR_REPO%2Fasset-tracking-challenge%2Ftree%2Fmain%2Fstarter&env=API_BASE_URL,API_TOKEN&envDescription=Provided%20with%20your%20challenge%20brief)

(If you're forking and submitting, update the URL above to point at your fork.)

## Quick start

```bash
# From the monorepo root
pnpm install
pnpm dev
# API on :8080, starter on :3000
```

Or from this directory:

```bash
pnpm install      # if you haven't from the root
cp .env.example .env
# Edit .env with the API URL and token from your challenge email
pnpm dev
```

Open http://localhost:3000.

The starter expects the upstream API at `API_BASE_URL` (default `http://localhost:8080/v1`). Browser requests go through a same-origin proxy at `/api/upstream/*` — the proxy attaches the bearer token server-side, so `API_TOKEN` never reaches the client.

## What's prebuilt

| File | What |
|---|---|
| `lib/api-client.ts` | Typed wrapper around every `/v1/*` endpoint. In the browser it talks to `/api/upstream`; on the server it goes directly to `API_BASE_URL`. Throws `ApiError` with the structured error payload. |
| `lib/types.ts` | TypeScript mirror of the API schemas. |
| `lib/auth.ts` | Cookie-based role switcher between `tech-jane` and `manager-paul`. |
| `components/ScanInput.tsx` | Auto-focus, Enter-to-submit, glove-sized input. Use it or replace it. |
| `components/RoleSwitcher.tsx` | Header button to swap roles. |
| `app/api/upstream/[...path]/route.ts` | Same-origin proxy that adds the bearer token. Don't modify unless you have a reason. |
| `app/page.tsx` | Landing page. |
| `docs/api-reference.md` | API contract. |
| `docs/tips.md` | Notes you'll want to read before coding. |
| `docs/happy-path.md` | 10-step smoke test. Run before submitting. |

## What you'll build

These files are stubs you'll replace. Read [`../docs/CHALLENGE.md`](../docs/CHALLENGE.md) for the requirements behind each.

**Tech (mobile-first scan workflows):**

| File | Build |
|---|---|
| `app/tech/receive/page.tsx` | The dock-side receive scan. New tag → create. Duplicate tag + matching serial → idempotent. Duplicate tag + different serial → loud error. |
| `app/tech/store/page.tsx` | Asset scan → storage location scan → commit. |
| `app/tech/deploy/page.tsx` | Asset scan → deploy location scan (must include rack + ru) → commit. Should also write back to facilities + finance. |
| `app/tech/transfer/page.tsx` | Asset scan → receiving party's badge scan → custodian changes; state doesn't. |
| `app/tech/page.tsx` | Optional tech landing page. |

**Manager (desktop):**

| File | Build |
|---|---|
| `app/manager/page.tsx` | Asset list. Filter by state / site / custodian. Links to detail. |
| `app/manager/assets/[tag]/page.tsx` | Asset detail. Current state + event history. |
| `app/manager/reconcile/page.tsx` | Renders the reconciliation report from the route handler below. |
| `app/api/reconcile/route.ts` | **Server-side join.** Pulls ops, facilities, and finance. Classifies. Returns a structured report. Currently returns 501. |

**Barcode tooling (your call where it lives):**

A way to produce scannable barcodes for a handful of asset tags (pick interesting ones) + a handful of locations. Could be `app/dev/barcodes/page.tsx`, a printable PDF, a script under `scripts/`, whatever fits.

**Your README:**

A `README.md` at the root of your fork. Include:

- A **"Three calls I nearly made the other way"** section.
- Anything in the brief or starter you'd push back on — bugs, typos, confusing claims. Pushback is a positive signal.
- How to run your app locally and what env vars it needs.

## Scripts

```bash
pnpm dev          # Next dev server
pnpm build        # Production build
pnpm start        # Run the production build
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm lint         # next lint
```

## Environment variables

| Variable | Notes |
|---|---|
| `API_BASE_URL` | Upstream API including `/v1`, e.g. `http://localhost:8080/v1` |
| `API_TOKEN` | Server-only. Do **not** prefix with `NEXT_PUBLIC_`. Browser code hits `/api/upstream/*` instead. |

## Submitting

Fill out **https://forms.gle/6gxhe8Js98KGqSDx8** with your deployed URL, repo link, and 3–5 minute Loom. Full details in [`../docs/CHALLENGE.md`](../docs/CHALLENGE.md).
