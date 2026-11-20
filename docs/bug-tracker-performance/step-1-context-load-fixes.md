# Step 1 — Context load fixes

**Risk:** Low · **Files:** frontend only

## Goal

Cut redundant list downloads and stop showing misleading empty states while issues load.

## Changes

### `src/bugTracker/contexts/BugTrackerContext.tsx`

1. **Remove the duplicate initial fetch.**
   The effect at ~line 210 (`getIssues()` → `setIssues`) and the polling effect at
   ~line 225 (which calls `poll()` immediately) both fetch on mount. Keep one:
   delete the standalone initial-load effect and let the polling effect's first
   `poll()` do the initial load.

2. **Add `issuesLoading`.**
   - `const [issuesLoading, setIssuesLoading] = useState(true);`
   - Set it to `false` after the first `refreshIssues()` completes (success or failure).
   - The first load must run even if the tab is hidden (current `poll` skips when
     `document.visibilityState !== 'visible'`).
   - Expose `issuesLoading` on the context value and in `BugTrackerContextValue`.

3. **Polling 15 s → 60 s.**
   Socket.io already pushes `issue:created/updated/transitioned/deleted/commented`.
   Polling is only a fallback if the socket drops. Also refresh on
   `visibilitychange` → visible, but only if the last fetch is older than 30 s
   (so quick tab switching doesn't spam the API).

4. **No full-list refetch after actions.**
   Remove `await refreshIssues()` from `createIssue`, `updateIssue`, `assignIssue`,
   `runTransition`, `addComment`, `addAttachments`, `deleteIssue`.
   Each already applies the server response locally (`res.issue` / `res.comment` /
   filter on delete). The socket event also arrives.

### Pages — use `issuesLoading`

Show a skeleton (or keep the existing one) while `loading || issuesLoading`:

- `pages/bugTracker/Overview.tsx` — change `if (loading)` → `if (loading || issuesLoading)`.
- `pages/bugTracker/MyIssues.tsx` — skeleton instead of empty state.
- `pages/bugTracker/Kanban.tsx`, `AllIssues.tsx`, `QAVerification.tsx`,
  `TeamAssignments.tsx`, `Reports.tsx` — same pattern.
- `pages/bugTracker/IssueDetail.tsx` — don't render "Issue not found" until both
  `issuesLoading` is false **and** the `getIssue()` fallback has finished
  (track a `fetching` state).

## Verify

- DevTools → Network: opening the Bug Tracker makes **one** `GET /issues`, then one
  every 60 s while the tab is visible.
- Create / edit / transition / comment: no `GET /issues` follows the mutation; the UI
  still updates.
- Second browser as another user: change an issue → first browser updates within ~1 s
  (socket).
- Hard refresh on `/issues/WF-xxx`: shows skeleton, never flashes "not found".
- Hard refresh on My Issues: skeleton, never flashes "Nothing assigned to you".

## Rollback

Revert the single commit; no API or data changes.
