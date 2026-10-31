import React from 'react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import type { ActivityEntry } from '../../types/bugTracker';
import { formatDateTime, relativeTime } from '../../utils/dates';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';

export function IssueActivityTimeline({ activity }: {activity: ActivityEntry[];}) {
  const { getEmployee } = useBugTracker();
  const entries = [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ol className="relative space-y-5 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
      {entries.map((entry, idx) => {
        const actor = getEmployee(entry.actorId);
        return (
          <li key={entry.id} className="relative">
            <span
              className={`absolute -left-6 top-1 h-[15px] w-[15px] rounded-full border-2 border-surface ${idx === 0 ? 'bg-accent' : 'bg-line-strong'}`}
              aria-hidden="true" />
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className="font-medium text-ink">{actor?.name ?? 'Someone'}</span>
              <span className="text-ink-muted">{entry.message}</span>
              {entry.toStatus && <IssueStatusBadge status={entry.toStatus} />}
            </div>
            <time className="mt-0.5 block text-xs text-ink-faint" dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
              {relativeTime(entry.createdAt)} · {formatDateTime(entry.createdAt)}
            </time>
          </li>);

      })}
    </ol>);

}