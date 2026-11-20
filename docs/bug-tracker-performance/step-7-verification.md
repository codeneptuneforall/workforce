# Step 7 — Tests + manual QA checklist

Run after each step where relevant, and fully after step 6.

## Automated

- `npx tsc --noEmit` — clean.
- `server/test/bug-tracker-api.mjs` — passes. Update assertions that expect
  `comments` / `activity` / `attachments` in the **list** response; they should
  check `GET /issues/:key` instead.
- Add tests:
  - `GET /issues` items have `commentCount`, `commentAuthorIds`, `attachmentCount`,
    `attachmentPreview`, `resolvedAt` and **no** `comments` / `activity` /
    `description`.
  - `GET /overview/activity` respects visibility (developer can't see activity on
    issues outside their projects) and `limit`.
  - Rate limit: 60 rapid GETs from one user → no 429.

## Manual — test as admin, developer and QA user

| Screen | Check |
|---|---|
| Overview | Skeleton then data; metrics, charts, Recently reported, Recent activity correct; project + range filters work |
| My Issues | Every tab has the right counts; "Recently updated" includes issues you only commented on; no "Nothing assigned" flash on refresh |
| Report a Bug | Create with attachments → success screen shows attachment count; appears in lists for other users within ~1 s |
| Kanban | Cards show thumbnails and "+N"; drag / transition works |
| All Issues | Search (key, title, feature, labels) and filters work |
| Issue Detail | Description, steps, expected/actual, attachments, comments, activity load; edit, comment, attach, transition and delete all update the page; hard refresh shows a skeleton, not "not found" |
| QA Verification | Queue correct; selecting an item shows steps, evidence attachments and fix summary; pass/fail works |
| Team Assignments | Workload and unassigned queue correct; assigning works |
| Reports | Average resolution time matches pre-change value |
| Two browsers | Change in one shows in the other within ~1 s (socket) |
| Socket down | Block the websocket in DevTools → changes still show within ~60 s (polling) |

## Record results

| Metric | Before | After |
|---|---|---|
| `GET /issues` size | | |
| `GET /issues` time | | |
| List requests in the first minute after opening | | |
| Overview time to first render | | |
