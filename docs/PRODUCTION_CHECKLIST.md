# Production Readiness Checklist

Tracks the fixes needed to keep the app stable on Render and bring it to production standard.
Work top to bottom. Tick an item only once it is merged **and** verified on Render.

Each item has sub-steps (committed → deployed → verified). The main box is ticked when all of them are.

**Problem summary (Nov 2026):** the Render instance freezes or restarts. The main causes are
memory, CPU and bandwidth, not Chromium alone:

- `GET /api/state` reloads the **entire database** on every call, and every open tab polls it every 15 s.
- Profile photos are stored as base64 inside employee records, so every poll resends every photo.
- Sessions, timesheets, payslips and notifications grow forever, so each poll gets heavier over time.
- The payslip Chromium stays resident (~150–300 MB) after the first PDF and is never closed while idle.
- Production runs TypeScript through `tsx`, which compiles at runtime and uses extra memory.

**How to confirm on Render:** Metrics → Memory (sawtooth climb then drop = restart),
Events ("ran out of memory"), Usage → Bandwidth, and logs around `[pdfBrowser]` lines.

---

## Hotfix: duplicate timesheets (found in the Phase 1 deploy logs)

- [ ] **H1. Auto-submit cron creates duplicate timesheets on every server start**
  - Cause: [server/cron/autoSubmitTimesheets.ts](../server/cron/autoSubmitTimesheets.ts) only checked **Draft** timesheets before creating one, so every week already Submitted/Approved got a new copy on each restart (12 created in the 2026-11-20 deploy). The `{employeeId, weekStart}` index is not unique, so MongoDB allowed it.
  - [ ] Code fix committed (check all timesheets + re-check before insert)
  - [ ] Deployed to Render
  - [ ] Existing duplicates cleaned with [server/fix-duplicate-timesheets.ts](../server/fix-duplicate-timesheets.ts) (dry run first, then `--apply`)
  - [ ] Later: make the `{employeeId, weekStart}` index unique, once there are no duplicates left

## Phase 1: Stop the crashes (low risk)

- [ ] **1. Serve `/api/state` from the in-memory cache**
  - [x] Code committed (`a2b3d36`): 60 s TTL cache; cron and bug-tracker writes invalidate it
  - [x] Deployed to Render (2026-11-20, merge `b1692f9`)
  - [ ] Verified on Render (memory flat, edits show for other users)
  - Where: [server/routes/api.ts](../server/routes/api.ts) (`GET /state`, line ~33), [server/store.ts](../server/store.ts) (`ensureLoaded`)
  - Change: use `ensureLoaded()` instead of `loadState()`.
  - Before switching: audit every write that bypasses `persistDiff` / `invalidateCache` (bug tracker routes, WFH history, late logins, uploads) so the cache never goes stale.
  - Note: the cache only works with **one** Render instance. Scaling to more instances needs Redis or similar.
  - Verify: Render memory and MongoDB read ops drop; data edited by one user still appears for others within one poll.

- [ ] **2. Close the warm Chromium when idle**
  - [x] Code committed (`74ddbdf`): closes after `PDF_BROWSER_IDLE_MS` (default 2 min)
  - [x] Deployed to Render (2026-11-20, merge `b1692f9`)
  - [ ] Verified on Render (logs show `closing idle Chromium`, memory drops after)
  - Where: [server/pdfBrowser.ts](../server/pdfBrowser.ts)
  - Change: close the shared browser after ~2 min with no PDF requests and relaunch it on demand.
  - Verify: memory returns to baseline a few minutes after a payslip download.

- [ ] **3. Run compiled JavaScript in production instead of `tsx`**
  - [x] Code committed (`b2efcc8`): esbuild bundle at `dist/server/index.js`; booted locally OK
  - [x] Deployed to Render (2026-11-20, merge `b1692f9`; compiled bundle boots, `/api/health` 200)
  - [ ] Verified on Render (app loads, login + payslip PDF work)
  - Where: [package.json](../package.json) (`build` / `start`), [Dockerfile](../Dockerfile)
  - Change: compile `server/` and `shared/` to `dist/server` and run it with `node`.
  - Verify: the app starts, and memory at idle is lower than before.

- [ ] **4. Add a health check and a memory cap**
  - [x] Code committed (`e801e67`): `/api/health` checks MongoDB; `[memory]` log every 5 min
  - [ ] Render: Health Check Path set to `/api/health`
  - [ ] Render: env `NODE_OPTIONS=--max-old-space-size=<per plan>` added
  - [x] Deployed to Render (2026-11-20; `/api/health` → `{"ok":true,"db":"connected","commit":"b1692f9"}`)
  - [ ] Verified on Render (a stuck instance is restarted automatically)
  - Where: [server/index.ts](../server/index.ts), Render service settings
  - Change: add `GET /health` (checks the DB connection) and set the Render health check path to it. Start Node with `--max-old-space-size` sized to the plan.
  - Verify: Render shows the service healthy, and a stuck instance is restarted automatically.

---

## Phase 2: Cut bandwidth and payload size (medium risk, touches the frontend)

- [ ] **5. Take profile photos out of the state payload**
  - Where: [server/routes/upload.ts](../server/routes/upload.ts), [server/store.ts](../server/store.ts), components that render avatars
  - Change: store photos separately and serve them from an endpoint with cache headers. Shrink and compress them on upload.
  - Before switching: find every place in `src/` that reads `photoUrl` from the state.
  - Verify: the `/api/state` response size drops sharply (check the browser Network tab).

- [ ] **6. Limit what the state returns**
  - Where: [server/store.ts](../server/store.ts) (`loadState`), `projectState` in the API
  - Change: send only recent sessions and timesheets (e.g. the last 60 days) and only the signed-in user's notifications. Load older history through dedicated paged endpoints.
  - Before switching: list the pages that rely on full history (reports, attendance, payroll).
  - Verify: response size stays flat as data grows, and the reports still show correct totals.

- [ ] **7. Turn on gzip compression**
  - Where: [server/index.ts](../server/index.ts)
  - Change: add the `compression` middleware.
  - Verify: responses carry `Content-Encoding: gzip`.

- [ ] **8. Poll less often or push changes**
  - Where: [src/contexts/DataContext.tsx](../src/contexts/DataContext.tsx) (`POLL_INTERVAL_MS`), [src/bugTracker/contexts/BugTrackerContext.tsx](../src/bugTracker/contexts/BugTrackerContext.tsx)
  - Change: poll every 30–60 s, or use the existing Socket.IO connection to tell clients when to refresh.
  - Verify: the live tracker still updates; request count per user drops.

---

## Phase 3: Production standard

- [ ] **9. Move bug tracker attachments to object storage**
  - Where: [server/routes/bugTracker.ts](../server/routes/bugTracker.ts) (`multer.diskStorage`, `uploads/bug-tracker`)
  - Why: Render's disk is wiped on every deploy, so these files are currently lost. Use S3, Cloudinary, R2 or similar.

- [ ] **10. Logging and error tracking**
  - Structured logs and an error tracker (e.g. Sentry) for the server and the client.

- [ ] **11. Tests for the money and HR logic**
  - Where: [shared/domain/](../shared/domain/) (payroll, leave, time, workday, compliance)
  - Add unit tests and run them in CI before deploys.

- [ ] **12. Database indexes and backups**
  - Where: [server/models.ts](../server/models.ts)
  - Add indexes for frequent queries (sessions by employee and date, leaves by status, etc.). Turn on and test Atlas backups.

- [ ] **13. Fix the Socket.IO proxy in dev**
  - Where: [vite.config.ts](../vite.config.ts)
  - Add a `/socket.io` proxy entry with `ws: true` so live bug tracker updates work locally.

- [ ] **14. (Optional) Generate PDFs without a browser**
  - Where: payslip download in [server/routes/api.ts](../server/routes/api.ts), [server/pdfBrowser.ts](../server/pdfBrowser.ts)
  - Build payslips with `pdf-lib` (already installed) and remove Playwright and Chromium entirely.

- [ ] **15. Known races (pre-existing, found during item 1)**
  - [server/cron/autoPauseBreaks.ts](../server/cron/autoPauseBreaks.ts) writes sessions directly, outside the mutation queue, so it can race with a user's pause/stop.
  - `ensureLoaded()` in [server/store.ts](../server/store.ts) also auto-pauses during breaks, duplicating the cron. Keep one of the two.
  - `maskBankDetails` in [shared/domain/access.ts](../shared/domain/access.ts) returns its input unchanged, so managers without payroll access still receive bank details.

- [ ] **16. Tidy the repo**
  - Move `@types/*` packages to `devDependencies`.
  - Remove `test.txt` and `diagnose-pdf.ts` from the root if they are no longer needed.
  - Weekly cron [server/cron/autoSubmitTimesheets.ts](../server/cron/autoSubmitTimesheets.ts) loads every session ever: limit it to the relevant week.

---

## Progress log

| Date | Item | Branch / PR | Notes |
|------|------|-------------|-------|
| 2026-11-20 | 1. `/api/state` from cache | `fix/production-stability` @ a2b3d36 | Committed. Typecheck passes. Awaiting local test + Render memory check. |
| 2026-11-20 | 2. Close idle Chromium | `fix/production-stability` @ 74ddbdf | Committed. Typecheck passes. Awaiting local test + Render memory check. |
| 2026-11-20 | 3. Compiled JS instead of tsx | `fix/production-stability` | esbuild bundle `dist/server/index.js`; booted locally, `/api/health` OK. Awaiting Render deploy. Follow-up: add `esbuild` as an explicit devDependency (now comes via tsx). Pre-existing: Mongoose warns of a duplicate index on `{employeeId, date}`. |
| 2026-11-20 | 4. Health check + memory cap | `fix/production-stability` | `/api/health` returns 503 when MongoDB is down; `[memory]` log every 5 min. Render setup still to do: Health Check Path `/api/health`, env `NODE_OPTIONS=--max-old-space-size=<per plan>`. |
