# Step 5 — Add summary fields to the list + switch screens to them

**Risk:** Medium · **Files:** `server/routes/bugTracker.ts`, `types/bugTracker.ts`,
`bugTrackerApi.ts`, `BugTrackerContext.tsx`, `MyIssues.tsx`, `KanbanCard.tsx`,
`Reports.tsx`

## Goal

The list **still returns full documents** in this step, but also returns small derived
fields. Screens switch to the derived fields, and TypeScript enforces that nothing
reads heavy fields from list items. After this step, step 6 can remove the heavy
fields safely.

## Backend — add derived fields to `GET /issues`

| Field | Type | Replaces |
|---|---|---|
| `commentCount` | number | `comments.length` |
| `commentAuthorIds` | string[] (unique) | `comments.some(c => c.authorId === me)` in My Issues |
| `attachmentCount` | number | `attachments.length` on Kanban card |
| `attachmentPreview` | `Attachment[]` (first 3) | `attachments.slice(0, 3)` on Kanban card |
| `resolvedAt` | string \| null | `resolution?.resolvedAt` in Reports |

Write a single `toIssueSummary(doc)` helper and use it everywhere the server sends an
issue **to the list**, including socket emits (`issue:created/updated/transitioned`).
Socket payloads may keep full fields for now; just add the derived ones.

## Types — `src/bugTracker/types/bugTracker.ts`

```ts
export type IssueSummary = Omit<Issue,
  'description' | 'stepsToReproduce' | 'expectedResult' | 'actualResult' |
  'comments' | 'activity' | 'attachments' | 'fixSummary' | 'resolution'> & {
  commentCount: number;
  commentAuthorIds: string[];
  attachmentCount: number;
  attachmentPreview: Attachment[];
  resolvedAt: string | null;
};
```

`Issue` (full) stays as is.

## Context — `BugTrackerContext.tsx`

- `issues`, `visibleIssues`, `scopedIssues`, `getIssueByKey` → typed `IssueSummary`.
- Add `toSummary(issue: Issue): IssueSummary` on the client too; use it when storing
  `res.issue` from mutations and socket payloads, so the store never holds full
  issues.
- `issue:commented` handler: increment `commentCount`, add `authorId` to
  `commentAuthorIds`, bump `updatedAt` — instead of `[...i.comments, data.comment]`
  (that line crashes once `comments` is gone).
- `addComment`: same local update.

## Screens

- `MyIssues.tsx` line 29: `i.commentAuthorIds.includes(currentUser.id)`.
- `KanbanCard.tsx` ~line 57–72: `attachmentPreview` for thumbnails,
  `attachmentCount - 3` for the "+N" badge.
- `Reports.tsx` line 85: `i.resolvedAt || i.updatedAt`.
- `RecentActivity` already moved in step 4; `IssueDetail` / `QAVerification` in step 3.

## Use the compiler

Run `npx tsc --noEmit`. Every remaining read of `.comments`, `.activity`,
`.attachments`, `.description`, etc. on a list item is now a type error. Fix each one
(move it to `useFullIssue` or a derived field) — do **not** cast to `any`.

## Verify

- `tsc` clean.
- My Issues → "Recently updated" / "Overdue" still include issues you only commented
  on.
- Kanban cards still show attachment thumbnails and "+N".
- Reports → average resolution time unchanged vs. before.
- Post a comment from another account → no console error; counts update.

## Rollback

Revert the commit. Server still sends full docs, so nothing else depends on it yet.
