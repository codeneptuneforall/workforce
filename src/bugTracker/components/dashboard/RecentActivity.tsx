import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { bugTrackerApi } from '../../api/bugTrackerApi';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { ActivityFeedEntry } from '../../types/bugTracker';
import { relativeTime } from '../../utils/dates';
import { statusStyles } from '../../utils/issueStyles';
import { Avatar } from '../ui/Avatar';

interface RecentActivityProps {
  /** Project scope ('all' or a project id). */
  projectId: string;
  /** YYYY-MM-DD: only issues created on/after this date (Overview range), or undefined for all time. */
  since?: string;
  /**
   * Keys of the issues the Overview is currently showing. Entries for other
   * issues are dropped so the feed matches the rest of the page exactly.
   */
  visibleKeys: Set<string>;
  /**
   * Changes whenever any visible issue changes (e.g. latest updatedAt).
   * Used to refetch after socket / poll updates.
   */
  version: string;
  limit?: number;
}

/** Fetch a few extra so client-side visibility filtering still leaves `limit` entries. */
const FETCH_LIMIT = 25;

export function RecentActivity({ projectId, since, visibleKeys, version, limit = 8 }: RecentActivityProps) {
  const { getEmployee } = useBugTracker();
  const [feed, setFeed] = useState<ActivityFeedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const lastParams = useRef<string | null>(null);

  useEffect(() => {
    const id = ++requestId.current;
    const load = () => {
      bugTrackerApi.
      getOverviewActivity({ projectId, since, limit: FETCH_LIMIT }).
      then((res) => {
        if (id !== requestId.current) return;
        setFeed(res.activity ?? []);
        setFailed(false);
      }).
      catch((err) => {
        if (id !== requestId.current) return;
        console.error('[bugTracker] activity feed load failed', err);
        setFailed(true);
        setFeed((prev) => prev ?? []);
      });
    };
    // Load immediately on mount or when project / range changes; debounce
    // refetches triggered only by live updates (version change).
    const paramsKey = `${projectId}|${since ?? ''}`;
    if (lastParams.current !== paramsKey) {
      lastParams.current = paramsKey;
      load();
      return;
    }
    const t = window.setTimeout(load, 1000);
    return () => window.clearTimeout(t);
  }, [projectId, since, version]);

  const entries = useMemo(
    () => (feed ?? []).filter((e) => visibleKeys.has(e.issueKey)).slice(0, limit),
    [feed, visibleKeys, limit]
  );

  if (feed === null) {
    return (
      <ol className="space-y-4 p-4" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) =>
        <li key={i} className="flex animate-pulse gap-3">
            <div className="h-6 w-6 shrink-0 rounded-full bg-neutral-soft" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-4/5 rounded bg-neutral-soft" />
              <div className="h-2.5 w-1/3 rounded bg-neutral-soft" />
            </div>
          </li>
        )}
      </ol>);

  }

  if (!entries.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-ink-subtle">
        {failed ? 'Could not load recent activity.' : 'No recent activity.'}
      </p>);

  }

  return (
    <ol className="space-y-4 p-4">
      {entries.map((entry) => {
        const actor = getEmployee(entry.actorId);
        return (
          <li key={`${entry.issueKey}-${entry.id}`} className="flex gap-3">
            <Avatar employee={actor} size="sm" />
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="text-ink-muted">
                <span className="font-medium text-ink">{actor?.name}</span> {entry.message}{' '}
                <Link to={bugTrackerRoutes.issue(entry.issueKey)} className="font-mono text-xs font-medium text-accent hover:text-accent-hover">
                  {entry.issueKey}
                </Link>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                {entry.toStatus && <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[entry.toStatus]?.dot ?? ''}`} aria-hidden="true" />}
                {entry.toStatus ? `${entry.toStatus} · ` : ''}
                {relativeTime(entry.createdAt)}
              </p>
            </div>
          </li>);

      })}
    </ol>);

}
