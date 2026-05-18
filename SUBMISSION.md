# Submission guide

Everything you need to submit before Sunday. Open this file in your editor, follow it top to bottom.

---

## 0. Current state — DEPLOYED ✓

- **GitHub repo:** <https://github.com/05102005rajat/cerebras-asset-tracking>
- **Frontend (Vercel):** <https://cerebras-asset-tracking-starter.vercel.app>
- **API (Render):** <https://cerebras-asset-tracking-1.onrender.com>
- **Tests:** 57 / 57 passing
- **Type-check:** clean
- **Production build:** clean, all 17 routes generated
- **Deployed verification:** all major routes return HTTP 200, real seeded data flows end-to-end

What's left: record the Loom (§4), submit the form (§5), email Daniel (§6).

### If you need to restart local dev

```bash
cd /Users/rajat/Desktop/trying1/ai-builder-challenge
cd api && npx tsx watch src/index.ts &     # in one terminal
cd starter && npx next dev -p 3000 &       # in another
```

---

## 1. Push to GitHub — DONE ✓

Repo is live and public at <https://github.com/05102005rajat/cerebras-asset-tracking>.

Daniel's upstream is preserved as the `upstream` git remote in case you ever need to pull updates.

---

## 2. Deploy — DONE ✓

Confirmed there is **no hosted API** in the candidate email or the public repo. The brief's "hosted API" language meant "this API, when running" — every candidate deploys both the API and frontend themselves.

### API (Render, Docker auto-detected from `api/Dockerfile`)

- **URL:** <https://cerebras-asset-tracking-1.onrender.com>
- **Env:** `API_TOKEN=local-dev-token-1234567890`
- **Note:** free tier spins down after 15 min idle → first request takes ~30-50s while it cold-starts. Mention in the Loom if it bites during demo. Acknowledge it as a free-tier artifact, not a code issue, and move on.

Two upstream-Dockerfile issues had to be fixed before this would build:
- pnpm@11.1.1 via corepack on Render's Node 20 Alpine throws `ERR_UNKNOWN_BUILTIN_MODULE`. Rewrote `api/Dockerfile` to use `npm` instead.
- (See commit `1115841`.)

### Frontend (Vercel, Next.js auto-detected from `starter/`)

- **URL:** <https://cerebras-asset-tracking-starter.vercel.app>
- **Root Directory:** `starter`
- **Install Command:** overridden to `npm install` (avoid the same corepack/pnpm trap)
- **Env vars:**
  - `API_BASE_URL=https://cerebras-asset-tracking-1.onrender.com/v1`
  - `API_TOKEN=local-dev-token-1234567890`

Two issues fixed during deploy:
- `@zxing/library@^0.23.0` conflicted with `@zxing/browser@0.2.0`'s peer requirement `^0.22.0`. Pinned to `^0.22.0` since we only import from `@zxing/browser`. (Commit `5290531`.)
- Vercel auto-blocks deploys of `next@15.0.4` due to CVE-2025-66478. Bumped to `15.5.18` (latest stable 15.x patch), matching `eslint-config-next`. (Commit `d53466f`.)

---

## 3. Run the happy path on the deployed URL (5 min)

Before recording the Loom, walk this path on the **deployed** URL to make sure nothing's off:

1. Home page → click "Reset demo data" (header confirms re-seed).
2. `/tech/receive` → scan tag `C0009001`, fill serial/model/manufacturer, submit. Success banner.
3. `/tech/store` → scan `C0009001`, accept default storage location, submit. Success banner.
4. `/tech/deploy` → scan `C0009001`, scan rack location `LOC|Lab-Building-A|Bay-12|Aisle-3|B-04|P-99`, submit. Success banner with both facilities + finance side effects.
5. `/manager` → search `C0009001`, click through to detail. Verify state = in_service, event log shows the three scans.
6. `/manager/reconcile` → verify your deployed asset shows NO drift, but the 6 seeded `needs_action` rows do. Click "Export CSV" — file downloads.

If any step fails on the deployed URL, fix it before recording.

---

## 4. Record the Loom (3-5 min)

**Setup:**
- Reset the demo data (the button on the home page).
- Have these tabs open: `/`, `/tech/receive?tag=C0000199`, `/manager`, `/manager/reconcile`.
- Use a phone or DevTools mobile view for one moment (see Beat 3).

**Script — total ~3:45**

### Beat 1 (0:00–0:30) — Set the stage

> "I'm Rajat. This is the asset-tracking submission. A research lab tracks equipment across three systems — operations, facilities, and finance — that disagree by default. The whole app is the work of keeping them in sync. There are two sides: a phone-first tech side for scan workflows, and a desktop manager side for the dashboard, asset details, and the reconcile report."

Show: home page.

### Beat 2 (0:30–1:55) — The manager side, where the work starts

> "The manager opens this at 8:55am before standup.
>
> The first thing the page tells them is whether anything needs attention — in this case, six items need investigation, and two more are worth watching."

[pause, hover over summary]

> "There are filter chips, sortable columns, and a status indicator on every row with an open issue."

[click Open report → reconcile page]

> "The report is grouped, not just a flat list of differences. First by severity — Needs action and Watch — then by category."

[slow scroll into Needs action]

> "And the categories are named in the language of what the manager would actually do.
>
> Walk the row.
>
> Send finance the retire-out.
>
> Awaiting finance."

[pause on a ghost issue, hover "Resolve via Receive →"]

> "For ghost assets — where facilities or finance has a tag operations doesn't recognize — the link goes straight into the receive workflow with the tag already filled in. The fix isn't reconciliation — it's receiving it for the first time."

[brief pause]

> "The categories aren't labels. They're routing instructions for human action."

[click Export CSV]

> "And there's a CSV export so finance or procurement can take this offline right after standup."

### Beat 3 (1:55–3:00) — The scan side

Phone view, or 375px wide DevTools.

> "Now the tech side. Phone, gloves, cold dock bay, scanner in one hand or just the phone camera.
>
> I built it for continuous scanning: the success message stays visible while the input clears and re-focuses for the next scan.
>
> No auto-dismiss timer. No waiting."

[Show /tech/receive, scan C0009101 with a fresh serial → success → input ready again]

> "When the tag is already on file — which is common at the dock — the form fills in from the existing record.
>
> The tech checks the unit and confirms.
>
> If they edit any field, it turns amber with an 'edited' badge, so they can see they're about to flag a mismatch."

[Scan C0000101 — known asset. Banner shows "Tag already on file" with state badge.]

> "Errors are specific to the cause.
>
> If the tech scans a location label where the tag should go — easy to do at 11pm — the app sees the LOC prefix and tells them which scan to do first, instead of just saying 'invalid format'."

[Try scanning a LOC| payload into the tag input → specific error message]

### Beat 4 (3:00–3:50) — One call I almost made the other way, and one piece of writing I'm proud of

**4a — the design call.** Stay on `/tech/receive` (phone view, carrying over from Beat 3).

> "One design call: I almost left the success banner on a four-second auto-dismiss timer.
>
> It looked great in a demo. But it was wrong for the actual job.
>
> A tech in the middle of a scan rhythm is already reaching for the next box. Four seconds is long enough to feel slow, and short enough to feel anxious.
>
> What I shipped instead: the banner stays until the next scan replaces it. The input clears and re-focuses right away.
>
> On phones, the device gives a short double-buzz on success so the tech can tell what happened without looking."

**4b — the microcopy.** Still on `/tech/receive`. Scan tag `C0000101` so the "Tag already on file" prefill banner appears on screen.

> "And one piece of writing I'd point at — right here, the banner that appears when a tag is already on file:
>
> 'Fields prefilled from the existing record. If the unit in your hand matches, just hit submit and we'll log a duplicate. If the serial is different, edit it and we'll surface the conflict.'
>
> Three sentences, three jobs: explain why the form looks prefilled, tell the tech what the happy path is, and tell them what the divergent path looks like.
>
> The microcopy is the documentation for the duplicate-receive flow. I never had to teach a tech how this works."

### Beat 5 (3:15–3:45) — Wrap

> "The architecture in one sentence: the part that decides what's wrong and the part that writes back to all three systems are pure functions, tested on their own. Everything else is a server component that just renders what it needs. The full write-up of the three design calls I made, and what I chose not to build, is in the README. Thanks for the review."

---

## 5. Submit the form

Go to <https://forms.gle/6gxhe8Js98KGqSDx8>.

Paste exactly these into the form fields:

**Public URL:**
```
https://cerebras-asset-tracking-starter.vercel.app
```

**GitHub link:**
```
https://github.com/05102005rajat/cerebras-asset-tracking
```

**Loom link:**
The URL Loom gives you after you stop recording.

---

## 6. After submitting

- Email Daniel (`Daniel.Kim@cerebras.net`) a short note: "Submitted via the form. Available for the follow-up call any weekday after 2pm PT this week. Thanks for the opportunity."
- That email reinforces availability and timing — they've said they want someone starting first week of June, so signal flexibility.

---

## Things to NOT do

- Don't claim production-readiness in the README/Loom. The work is a take-home; *taste* is what's evaluated.
- Don't apologize in the Loom. State decisions plainly.
- Don't run over 5 minutes on the Loom. Aim for 3:45.
- Don't link or screenshot any private repo URLs (e.g. the Cerebras email's API URL) in a public README/Loom.

Good luck.
