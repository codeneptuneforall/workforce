import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { relativeTime } from '../../utils/dates';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';

export function RecentIssues({ issues }: {issues: Issue[];}) {
  const navigate = useNavigate();
  const { getEmployee, getProject } = useBugTracker();
  const recent = [...issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  if (!recent.length) return <p className="px-4 py-10 text-center text-sm text-ink-subtle">No issues reported in this period.</p>;

  return (
    <ul className="divide-y divide-line">
      {recent.map((issue) =>
      <li key={issue.id}>
          <button type="button" onClick={() => navigate(bugTrackerRoutes.issue(issue.key))} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-subtle">{issue.key}</span>
                <SeverityBadge severity={issue.severity} />
              </div>
              <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{issue.title}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {getProject(issue.projectId)?.name} · reported by {getEmployee(issue.reporterId)?.name} {relativeTime(issue.createdAt)}
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <IssueStatusBadge status={issue.status} />
              <Avatar employee={getEmployee(issue.assigneeId)} size="sm" />
            </div>
          </button>
        </li>
      )}
    </ul>);

}