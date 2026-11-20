# Step 4 — Separate Overview activity API

**Risk:** Low · **Files:** `server/routes/bugTracker.ts`, `bugTrackerApi.ts`,
`RecentActivity.tsx`, `Overview.tsx`

## Goal

The Overview "Recent activity" panel stops computing its feed from every issue's
`activity` array in the list.

## Backend — `GET /api/bug-tracker/overview/activity`

Query params (all optional):

| Param | Meaning |
|---|---|
| `projectId` | Limit to one project (`all` or empty = every visible project) |
| `since` | `YYYY-MM-DD`; only issues **created** on/after this date (matches the Overview range filter, which filters by `createdAt`) |
| `limit` | Default 8, max 50 |

Response:

```json
{
  "activity": [
    { "id": "act-…", "actorId": "…", "message": "moved to QA Testing",
      "createdAt": "2026-11-20T10:00:00Z", "toStatus": "QA Testing",
      "issueKey": "WF-123", "issueTitle": "…" }
  ]
}
```

Implementation:

- Reuse the **same visibility rules** as `GET /issues` (admin/qa see all; others see
  assigned / reported / their projects). Extract that logic into a shared helper
  (`buildVisibilityFilter(req, context)`) so both routes stay in sync.
- Aggregation:
  `$match` (visibility + projectId + createdAt ≥ since) →
  `$project { key, title, activity }` → `$unwind: "$activity"` →
  `$sort { "activity.createdAt": -1 }` → `$limit`.
- Use the read limiter from step 2.

## Frontend

- `bugTrackerApi.getOverviewActivity({ projectId, since, limit })`.
- `RecentActivity.tsx`: replace the `issues` prop with `projectId` + `since`; fetch on
  mount and when they change; skeleton while loading. Link uses `issueKey`.
- `Overview.tsx`: pass `projectScope` and the computed `from` date (or nothing for
  "All time").
- Refresh the feed on socket `issue:*` events (simple: refetch, debounced ~1 s).

## Verify

- Overview → Network shows `GET /overview/activity`; panel shows the same 8 entries as
  before for the same project / range.
- Developer account sees only activity on issues they can view.
- Change project / range → feed updates.
- Transition an issue → feed updates within ~1–2 s.

## Rollback

Revert the commit; `RecentActivity` goes back to reading `issues`.
