# Bug Tracker performance fix

## Problem

Overview, My Issues, Kanban and Issue pages load slowly. Causes:

1. `GET /api/bug-tracker/issues` returns **full** issue documents (description, steps,
   all comments, full activity history, attachments) for every visible issue, with no
   projection or pagination.
2. The frontend ignores the server-side filters and downloads the whole list, then
   filters in the browser.
3. The list is fetched **twice** on mount, then again every 15 s, then again after every
   action (create / edit / assign / transition / comment / attach / delete) — even though
   socket.io already pushes live updates.
4. All issue routes share one rate limit of **30 req/min per IP**. The traffic above can
   hit it, causing 429s that look like "stuck loading".
5. The `loading` flag does not cover issues, so pages show "Nothing assigned to you" or
   "Issue not found" while issues are still downloading.
6. No index on `updatedAt` (the list sort key); employees trigger an extra project
   lookup per list request.

## Plan

Each step can be merged, deployed and verified on its own. The order matters: screens
stop depending on heavy list fields **before** the list stops sending them.

| # | Step | Risk | Doc |
|---|------|------|-----|
| 1 | Context load fixes (duplicate fetch, loading flag, polling, no refetch after actions) | Low | [step-1-context-load-fixes.md](step-1-context-load-fixes.md) |
| 2 | Backend indexes + per-user rate limit | Low | [step-2-backend-indexes-rate-limit.md](step-2-backend-indexes-rate-limit.md) |
| 3 | Issue Detail & QA panel always fetch the full issue | Low | [step-3-detail-fetch-full-issue.md](step-3-detail-fetch-full-issue.md) |
| 4 | Separate Overview activity API | Low | [step-4-overview-activity-api.md](step-4-overview-activity-api.md) |
| 5 | Add summary fields to list + switch screens to them | Medium | [step-5-list-summary-fields.md](step-5-list-summary-fields.md) |
| 6 | Slim the list response (remove heavy fields) | Medium | [step-6-slim-list-response.md](step-6-slim-list-response.md) |
| 7 | Tests + manual QA checklist | — | [step-7-verification.md](step-7-verification.md) |

## Status

- [x] Step 1 — implemented 2026-11-20 (awaiting manual verification)
- [x] Step 2 — implemented 2026-11-20 (awaiting manual verification)
- [ ] Step 3
- [ ] Step 4
- [ ] Step 5
- [ ] Step 6
- [ ] Step 7

## Out of scope (for later)

- Server-side pagination of the list. All screens currently filter client-side, so
  paging would need every list screen to move to server queries. Re-evaluate after
  step 6 if the slim list is still too large.
