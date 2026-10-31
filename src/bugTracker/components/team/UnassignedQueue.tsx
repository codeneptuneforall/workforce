import React from 'react';
import { CheckCircle2Icon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { relativeTime } from '../../utils/dates';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Button } from '../ui/Button';

export function UnassignedQueue({ issues, onAssign }: {issues: Issue[];onAssign: (issue: Issue) => void;}) {
  const { getProject } = useBugTracker();

  if (!issues.length) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <CheckCircle2Icon className="h-5 w-5 text-success" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-ink">Every issue has an owner</p>
        <p className="mt-0.5 text-xs text-ink-subtle">New reports will appear here for triage.</p>
      </div>);

  }

  return (
    <ul className="divide-y divide-line">
      {issues.map((issue) =>
      <li key={issue.id} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-subtle">{issue.key}</span>
            <SeverityBadge severity={issue.severity} />
            <IssueStatusBadge status={issue.status} />
          </div>
          <Link to={bugTrackerRoutes.issue(issue.key)} className="mt-1 block text-[13px] font-medium leading-snug text-ink hover:text-accent">
            {issue.title}
          </Link>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-ink-subtle">
              {getProject(issue.projectId)?.name} · {relativeTime(issue.createdAt)}
            </span>
            <Button size="sm" variant="primary" onClick={() => onAssign(issue)}>
              Assign
            </Button>
          </div>
        </li>
      )}
    </ul>);

}