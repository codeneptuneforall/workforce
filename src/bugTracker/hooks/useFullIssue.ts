import { useCallback, useEffect, useRef, useState } from 'react';
import { useBugTracker } from '../contexts/BugTrackerContext';
import type { Issue } from '../types/bugTracker';

interface FullIssueState {
  /** Full issue (description, steps, comments, activity, attachments) or null until loaded. */
  issue: Issue | null;
  /** True while the first fetch for the current key is in flight. */
  loading: boolean;
  /** True when the API returned no issue (missing, no permission or request failed). */
  notFound: boolean;
  /** Force a refetch (normally not needed — see below). */
  refresh: () => void;
}

/**
 * Loads the full issue from `GET /api/bug-tracker/issues/:key`.
 *
 * The shared issue list is meant to carry only summary fields, so screens that
 * show description / steps / comments / activity / attachments must use this.
 *
 * Freshness: every server mutation bumps `updatedAt` and emits `issue:updated`
 * over socket.io, which updates the list copy. This hook refetches whenever the
 * list copy's `updatedAt` changes, so own and other users' changes show up
 * without manual refresh calls.
 */
export function useFullIssue(key: string | null | undefined): FullIssueState {
  const { getIssue, getIssueByKey } = useBugTracker();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  const summary = key ? getIssueByKey(key) : undefined;
  const summaryUpdatedAt = summary?.updatedAt;
  // Read inside async callbacks without re-running the effect.
  const inListRef = useRef(false);
  inListRef.current = Boolean(summary);
  const issueRef = useRef<Issue | null>(null);
  issueRef.current = issue;

  useEffect(() => {
    if (!key) return;
    const id = ++requestId.current;
    getIssue(key).then((fetched) => {
      if (id !== requestId.current) return; // a newer request superseded this one
      if (!fetched && issueRef.current?.key === key && inListRef.current) {
        // Background refetch failed (network / rate limit) but the issue still
        // exists in the list: keep showing the data we already have.
        return;
      }
      setIssue(fetched);
      setNotFound(!fetched);
      setLoadedKey(key);
    });
  }, [key, summaryUpdatedAt, nonce, getIssue]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Never hand back data that belongs to a previous key.
  const current = issue && issue.key === key ? issue : null;
  return {
    issue: current,
    loading: Boolean(key) && loadedKey !== key,
    notFound: loadedKey === key && notFound,
    refresh
  };
}
