import React from 'react';
import { Link } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { relativeTime } from '../../utils/dates';
import { statusStyles } from '../../utils/issueStyles';
import { Avatar } from '../ui/Avatar';

export function RecentActivity({ issues, limit = 8 }: {issues: Issue[];limit?: number;}) {
  const { getEmployee } = useBugTracker();
  const entries = issues.
  flatMap((issue) => issue.activity.map((entry) => ({ entry, issue }))).
  sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt)).
  slice(0, limit);

  if (!entries.length) return <p className="px-4 py-10 text-center text-sm text-ink-subtle">No recent activity.</p>;

  return (
    <ol className="space-y-4 p-4">
      {entries.map(({ entry, issue }) => {
        const actor = getEmployee(entry.actorId);
        return (
          <li key={entry.id} className="flex gap-3">
            <Avatar employee={actor} size="sm" />
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="text-ink-muted">
                <span className="font-medium text-ink">{actor?.name}</span> {entry.message}{' '}
                <Link to={bugTrackerRoutes.issue(issue.key)} className="font-mono text-xs font-medium text-accent hover:text-accent-hover">
                  {issue.key}
                </Link>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                {entry.toStatus && <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[entry.toStatus].dot}`} aria-hidden="true" />}
                {entry.toStatus ? `${entry.toStatus} · ` : ''}
                {relativeTime(entry.createdAt)}
              </p>
            </div>
          </li>);

      })}
    </ol>);

}