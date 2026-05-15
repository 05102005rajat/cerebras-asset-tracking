# Submission guide

Everything you need to submit before Sunday. Open this file in your editor, follow it top to bottom.

---

## 0. The current state of the build

- **Working tree:** clean, all changes committed
- **Branch:** `main` with 5 commits on top of upstream `0129f69`
- **Tests:** 50 / 50 passing
- **Type-check:** clean
- **Production build:** clean, all routes generated

Local dev still running at <http://localhost:3000> (API at :8080). If those are stopped, restart with:

```bash
cd /Users/rajat/Desktop/trying1/ai-builder-challenge
cd api && npx tsx watch src/index.ts &     # in one terminal
cd starter && npx next dev -p 3000 &       # in another
```

---

## 1. Push to GitHub (5 min)

```bash
cd /Users/rajat/Desktop/trying1/ai-builder-challenge

# Create a new GitHub repo named whatever you like. Public.
# Then:
gh repo create cerebras-asset-tracking --public --source=. --push
# OR, if you don't have gh CLI:
#   1. Create the repo at https://github.com/new (public, no README/license).
#   2. Then:
#   git remote add origin https://github.com/05102005rajat/cerebras-asset-tracking.git
#   git push -u origin main
```

Verify the public URL loads: <https://github.com/05102005rajat/cerebras-asset-tracking>

---

## 2. Deploy (15-30 min)

You need a public URL where the app runs. Two pieces: the **frontend** (Vercel) and the **API** (either Cerebras-hosted, or your own deploy).

### 2a. Find the hosted API URL — try this first

The brief at `docs/CHALLENGE.md` says *"A hosted API holds ~1,000 seeded assets…"*. The candidate-facing email from Daniel **should have included** the public `API_BASE_URL` and `API_TOKEN`.

- **Check the original challenge email or the submission form** for these.
- If they're not there, email Daniel (`Daniel.Kim@cerebras.net`) — quote the relevant line from the brief. This is a clarifying question, not a complaint; the brief itself implies these should have been provided.

### 2b. If no hosted API is available, deploy the API yourself

The API is a small Node + Fastify + SQLite app — Render's free tier hosts it in 5 minutes:

```bash
# In the api/ directory there's already a Dockerfile and docker-compose.yml.
# On Render:
#   New → Web Service → Connect your GitHub repo
#   Root directory:    api
#   Build command:     npm install && npm run build
#   Start command:     npm run start
#   Free instance type.
# After deploy, note the URL — e.g. https://your-api.onrender.com
# Test: curl https://your-api.onrender.com/health  →  {"ok":true,...}
```

(Railway and Fly.io work just as well; Render is the most click-through-able.)

### 2c. Deploy the frontend to Vercel

```bash
# Easiest path:
cd starter && npx vercel
# It will prompt:
#   Set up and deploy "starter"?  → yes
#   Which scope?                  → your personal scope
#   Link to existing project?     → no
#   What's your project's name?   → cerebras-asset-tracking
#   In which directory is your code located?  → ./
#   Auto-detected: Next.js. Override? → no
```

After the first deploy, set env vars in the Vercel dashboard
(<https://vercel.com/your-name/cerebras-asset-tracking/settings/environment-variables>):

| Key | Value |
|---|---|
| `API_BASE_URL` | The hosted API URL from step 2a/2b, with `/v1` suffix |
| `API_TOKEN`    | The token from the challenge email, or `local-dev-token-1234567890` if you self-deployed |

Then **redeploy** so the env vars take effect (or just `npx vercel --prod`).

Verify the public URL loads, then click through `/tech`, `/manager`, `/manager/reconcile`, `/dev/barcodes`. They should all 200 and show seeded data.

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

### Beat 1 (0:00–0:30) — Frame the system

> "I'm Rajat. This is the asset-tracking submission. A multi-site research lab tracks instruments across three systems — operations, facilities, finance — that disagree by default. The whole product is the work of keeping them aligned. Two surfaces: a phone-first tech surface for scan workflows, and a desktop manager surface for the dashboard, asset detail, and the reconciliation report."

Show: home page.

### Beat 2 (0:30–1:30) — Manager surface, where the work begins

> "The manager opens this at 8:55am before standup. The first thing the page tells them is whether anything actually needs them — drift topline at the top, in this case '6 items need investigation, 2 to watch.' Filter chips, sortable columns, a drift dot on every row that has an open issue."
>
> [Click the drift topline → reconcile page]
>
> "The report is categorized, not diffed — two severities, ten categories. *Needs action* at the top, grouped by category so a single botched migration that produces 80 rack mismatches reads as one chunk, not a fire. I write the category names in the language of the action the manager would take — *Walk the row*, *Send finance the retire-out*, *Awaiting finance*."
>
> [Scroll to a ghost issue, point at "Resolve via Receive →"]
>
> "For ghosts — where facilities or finance carries a tag ops doesn't know about — the link goes straight to /tech/receive with the tag prefilled, because the action is to receive it for the first time."
>
> [Click "Export CSV"]
>
> "Export — same data, CSV — so the manager can hand it to procurement after standup."

### Beat 3 (1:30–2:30) — The scan UX

Phone view, or 375px wide DevTools.

> "Now the tech. Phone, gloves, cold dock bay, scanner in one hand or just the phone camera. I built for continuous-scan: success banner stays visible while the input clears and re-focuses for the next scan, no auto-dismiss timer, no waiting."
>
> [Show /tech/receive, scan C0009101 with a fresh serial → success → input is already armed for next]
>
> "When the tag is already on file — common at the dock — the form prefills from the existing record. The tech reads, glances, confirms. If a field is edited, it turns amber with 'edited' so they can see they're about to flag a divergence."
>
> [Scan C0000101 — known asset. Banner shows "Tag already on file" with state badge.]
>
> "Errors are routed by code. If the tech scans a location label where the tag goes — easy to do at 11pm — I detect the LOC| prefix and tell them which scan to do first, instead of generic 'invalid format'."
>
> [Try scanning a LOC| payload into the tag input → context-specific error message]

### Beat 4 (2:30–3:15) — One call I nearly made the other way + one piece of microcopy

> "One design call: I almost left the success banner on a 4-second auto-dismiss timer. It demoed beautifully. It was wrong for the actual job — a tech mid-rhythm is already moving the next box; the 4-second window is long enough to feel slow and short enough to feel anxious. What shipped: banner stays until the next scan replaces it. The input clears and re-focuses immediately. On phones, navigator.vibrate gives a short double-pulse on success so the tech can tell what happened without looking."
>
> "And one piece of microcopy I'd point at: the empty state on the reconcile page when nothing is broken — 'All three systems agree on every asset. Most weeks you'll have something here — enjoy the quiet one.' Most empty states pretend the absence of data is normal; this one names it as the rare case it actually is."

### Beat 5 (3:15–3:45) — Wrap

> "Architecture in one sentence: the reconciliation classifier and the scan-write orchestrator are pure functions tested in isolation; everything else is server components rendering whatever they need. Full write-up of the three calls I made and what I deliberately didn't build is in the README. Thanks for the review."

---

## 5. Submit the form

Go to <https://forms.gle/6gxhe8Js98KGqSDx8>.

Paste exactly these into the form fields:

**Public URL:**
```
https://cerebras-asset-tracking.vercel.app
```
(Your actual Vercel URL.)

**GitHub link:**
```
https://github.com/05102005rajat/cerebras-asset-tracking
```
(Your actual GitHub URL.)

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
