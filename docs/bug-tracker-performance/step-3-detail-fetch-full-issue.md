# Step 3 — Issue Detail & QA panel always fetch the full issue

**Risk:** Low · **Files:** frontend only

## Goal

Screens that show description, steps, comments, activity or attachments get them from
`GET /api/bug-tracker/issues/:key`, not from the list. This is the prerequisite for
removing those fields from the list in step 6.

## Changes

### New hook `src/bugTracker/hooks/useFullIssue.ts`

```ts
// Returns the full issue for `key`.
// - Starts with the list summary (instant render of title/status/badges)
// - Fetches GET /issues/:key on mount and when `key` changes
// - Refetches when the list copy's `updatedAt` changes (socket / poll pushed a change)
// - Exposes { issue, loading, notFound, refresh }
```

Implementation notes:

- Use `getIssueByKey(key)` from context for the placeholder and its `updatedAt` as an
  effect dependency.
- Ignore stale responses (keep a request counter or `AbortController`).
- `notFound` only when the API returns 404/403 — never while loading.

### `src/bugTracker/pages/bugTracker/IssueDetail.tsx`

- Replace `localIssue ?? issueFromApi` with `useFullIssue(issueKey)`.
- While `loading` and no placeholder → skeleton. Placeholder present but full issue
  not yet loaded → render header/badges, skeleton for description, attachments and the
  comments / activity tabs.
- After `updateIssue`, `addAttachments`, transitions (via `useIssueTransition`) and
  `IssueComments` submit → call `refresh()`.
- `EditIssueDialog` receives the **full** issue (it reads `description`).

### `src/bugTracker/components/issues/IssueComments.tsx`

Takes the full issue from props (already does). After posting, call the parent's
`refresh` (add an `onChanged` prop) so the new comment shows.

### `src/bugTracker/pages/bugTracker/QAVerification.tsx`

- Queue list stays on `scopedIssues` (only needs key, title, status, severity,
  assignee, `submittedForQaAt`, `qa`).
- Selected issue: `const { issue: full } = useFullIssue(selected?.key)`; pass `full`
  to `QAVerificationPanel` (reads `attachments`, `stepsToReproduce`,
  `expectedResult`, `fixSummary`). Skeleton while loading.

## As implemented

- `useFullIssue` refetches whenever the list copy's `updatedAt` changes. Every
  server mutation (edit, transition, comment, attachments JSON + upload) bumps
  `updatedAt` and emits `issue:updated`, so no explicit `refresh()` calls were
  needed in IssueDetail / IssueComments / transitions.
- A failed background refetch keeps the already-loaded data if the issue is still
  in the list (avoids flipping to "not found" on a 429 / network blip).
- IssueDetail shows a skeleton until the full issue loads (no partial header-only
  render — single-issue fetch is fast).
- QAVerification: queue from the list; the selected item's panel uses the full
  issue, with a skeleton while loading and an empty state if it can't be loaded.

## Verify

- Open an issue → Network shows `GET /issues/WF-xxx`; description, steps, attachments,
  comments and activity all render.
- Add a comment / attachment / edit / transition → the detail page updates without a
  manual refresh.
- Another user comments → detail page updates within ~1 s.
- QA Verification: select different queue items → each loads its full details.

## Rollback

Revert the commit. List still has full data at this point, so the old behaviour works.
