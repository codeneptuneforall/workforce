import React from 'react';
import { BanIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { relativeTime } from '../../utils/dates';
import type { WorkflowTransition } from '../../utils/workflow';
import { DueDateLabel } from '../badges/DueDateLabel';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { PriorityBadge } from '../badges/PriorityBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface IssueQuickRowProps {
  issue: Issue;
  quickAction?: WorkflowTransition;
  onQuickAction: (issue: Issue, transition: WorkflowTransition) => void;
}

const toneToVariant = { primary: 'primary', success: 'success', danger: 'danger-outline', neutral: 'secondary' } as const;

export function IssueQuickRow({ issue, quickAction, onQuickAction }: IssueQuickRowProps) {
  const { getProject, getEmployee } = useBugTracker();
  const assignee = getEmployee(issue.assigneeId);

  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-canvas sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink-subtle">{issue.key}</span>
          <IssueStatusBadge status={issue.status} />
          <SeverityBadge severity={issue.severity} />
          {issue.blocked &&
          <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger-ink">
              <BanIcon className="h-3 w-3" aria-hidden="true" />
              Blocked
            </span>
          }
        </div>
        <Link to={bugTrackerRoutes.issue(issue.key)} className="mt-1 block truncate text-sm font-medium text-ink hover:text-accent">
          {issue.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
          <span>{getProject(issue.projectId)?.name}</span>
          <PriorityBadge priority={issue.priority} />
          <DueDateLabel issue={issue} variant="relative" />
          <span>Updated {relativeTime(issue.updatedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted sm:w-32">
          <Avatar employee={assignee} size="xs" />
          <span className="truncate">{assignee?.name ?? 'Unassigned'}</span>
        </span>
        <div className="ml-auto sm:ml-0 sm:w-40 sm:text-right">
          {quickAction ?
          <Button size="sm" variant={toneToVariant[quickAction.tone]} onClick={() => onQuickAction(issue, quickAction)}>
              {quickAction.label}
            </Button> :

          <Link to={bugTrackerRoutes.issue(issue.key)} className="text-[13px] font-medium text-accent hover:text-accent-hover">
              View details
            </Link>
          }
        </div>
      </div>
    </li>);

}