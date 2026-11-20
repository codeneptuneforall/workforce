# Step 6 — Slim the list response

**Risk:** Medium · **Files:** `server/routes/bugTracker.ts` (+ socket emit sites)

## Goal

`GET /issues` and socket list events stop sending heavy fields. This is the step that
makes the payload small. Steps 3–5 must be deployed first.

## Changes

### `GET /issues`

Replace `find(filter).sort(...).lean()` with an aggregation that never loads heavy
fields into Node:

```ts
[
  { $match: filter /* + visibility filter from step 4 helper */ },
  { $sort: { updatedAt: -1 } },
  { $project: {
      // light fields
      key: 1, title: 1, projectId: 1, type: 1, severity: 1, priority: 1, status: 1,
      assigneeId: 1, reporterId: 1, createdAt: 1, updatedAt: 1, dueDate: 1,
      feature: 1, environment: 1, labels: 1, relatedIssueKeys: 1, blocked: 1,
      blockedReason: 1, submittedForQaAt: 1, reopenReason: 1, qa: 1,
      // derived
      commentCount: { $size: '$comments' },
      commentAuthorIds: { $setUnion: ['$comments.authorId', []] },
      attachmentCount: { $size: '$attachments' },
      attachmentPreview: { $slice: ['$attachments', 3] },
      resolvedAt: { $ifNull: ['$resolution.resolvedAt', null] },
  } },
]
```

Move the visibility filter into `$match` (instead of filtering in JS after loading
everything), using the shared helper from step 4.

### Socket emits

Everywhere the server emits `issue:created`, `issue:updated`, `issue:transitioned`,
send `toIssueSummary(doc)` instead of the full doc. `issue:commented` can send
`{ issueKey, authorId, createdAt }` only.

### Mutation responses

`POST/PATCH /issues…` can keep returning the **full** issue — the client converts it
to a summary for the list (step 5) and the detail page refetches anyway.

## As implemented

- `GET /issues` = aggregation `$match` (filters + visibility) → `$sort updatedAt` →
  `$project ISSUE_SUMMARY_PROJECTION`. Derived fields computed in MongoDB;
  `attachmentPreview` = first 3 **image** attachments (matches the Kanban card).
  `fixSummary` stays in the projection (light; used by TransitionDialog).
- New `toIssueSummary()` (server) = `toApiIssue()` + heavy fields removed; used for
  `issue:created` / `issue:updated` / `issue:transitioned` broadcasts.
- `issue:commented` now broadcasts only `{ id, authorId, createdAt }` of the comment
  — previously the comment **body** was broadcast to every connected socket,
  regardless of who can see the issue.
- Mutation responses (`POST/PATCH/transition/attachments`) still return the full
  issue; the client reduces them with `toIssueSummary()` (step 5).
- Note: socket broadcasts still go to all connected clients (pre-existing); the
  summary still contains title/status/etc. Scoping broadcasts per user is out of
  scope here.

## Verify

- Network: `GET /issues` response size drops sharply (compare before/after; note both
  numbers in the PR).
- Response time of `GET /issues` before/after (DevTools timing).
- Every screen in the [step 7 checklist](step-7-verification.md).
- No console errors on any Bug Tracker page.

## Rollback

Revert the commit — the client from step 5 works with both full and slim responses,
because it only reads summary fields.
