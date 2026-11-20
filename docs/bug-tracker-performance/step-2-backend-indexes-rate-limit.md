# Step 2 — Backend indexes + per-user rate limit

**Risk:** Low · **Files:** `server/models.ts`, `server/routes/bugTracker.ts`

## Goal

Make the list query cheaper and stop legitimate usage from hitting 429s.

## Changes

### `server/models.ts` (BugTrackerIssueSchema, ~line 502)

Add:

```ts
BugTrackerIssueSchema.index({ updatedAt: -1 });
BugTrackerIssueSchema.index({ projectId: 1, updatedAt: -1 });
BugTrackerIssueSchema.index({ assigneeId: 1, status: 1 });
```

Mongoose builds these on startup (`autoIndex`). If `autoIndex` is disabled in
production, create them manually in the DB (see below).

### `server/routes/bugTracker.ts` (~line 236)

1. **Key the limiter by user, not IP.** Offices behind one NAT share an IP today.

   ```ts
   keyGenerator: (req) => (req as any).user?.id ?? req.ip,
   ```

   Confirm the limiter runs **after** auth middleware so `req.user` is set.

2. **Separate read and write limits.**
   - `issueReadLimiter`: 120/min — `GET /issues`, `GET /issues/:key`, `GET /overview/*`,
     attachment download.
   - `issueWriteLimiter`: 30/min (current value) — POST / PATCH / DELETE.

3. **Employee project lookup** in `GET /issues` (~line 289): add a projection so only
   `_id` is loaded:

   ```ts
   ProjectModel.find({ employeeIds: ... }, { _id: 1 }).lean()
   ```

## Verify

- `db.bugtrackerissues.getIndexes()` shows the new indexes.
- `db.bugtrackerissues.find({}).sort({updatedAt:-1}).explain("executionStats")` uses
  `IXSCAN`, not `SORT` in memory.
- Rapidly switching between Bug Tracker pages never returns 429.
- Existing `server/test/bug-tracker-api.mjs` passes.

## Manual index creation (if autoIndex is off)

```js
db.bugtrackerissues.createIndex({ updatedAt: -1 })
db.bugtrackerissues.createIndex({ projectId: 1, updatedAt: -1 })
db.bugtrackerissues.createIndex({ assigneeId: 1, status: 1 })
```

## Rollback

Revert the commit. Indexes can stay; they are harmless.
