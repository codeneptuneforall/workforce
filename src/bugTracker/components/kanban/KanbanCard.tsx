import React from 'react';
import { AlertTriangleIcon, BanIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { isOverdue } from '../../utils/issueMetrics';
import type { WorkflowTransition } from '../../utils/workflow';
import { DueDateLabel } from '../badges/DueDateLabel';
import { PriorityBadge } from '../badges/PriorityBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';

interface KanbanCardProps {
  issue: Issue;
  transitions: WorkflowTransition[];
  dragging: boolean;
  onDragStart: (issue: Issue) => void;
  onDragEnd: () => void;
  onMove: (issue: Issue, transition: WorkflowTransition) => void;
}

export function KanbanCard({ issue, transitions, dragging, onDragStart, onDragEnd, onMove }: KanbanCardProps) {
  const navigate = useNavigate();
  const { getEmployee, getProject } = useBugTracker();
  const overdue = isOverdue(issue);
  const critical = issue.severity === 'Critical';
  const assignee = getEmployee(issue.assigneeId);

  return (
    <article
      draggable={transitions.length > 0}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', issue.id);
        onDragStart(issue);
      }}
      onDragEnd={onDragEnd}
      className={`group relative rounded-md border bg-surface p-3 shadow-card transition-[box-shadow,border-color] duration-150 hover:border-line-strong hover:shadow-pop ${
      critical ? 'border-danger-line' : 'border-line'} ${transitions.length ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      
      {critical && <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-danger" aria-hidden="true" />}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-ink-subtle">{issue.key}</span>
        <SeverityBadge severity={issue.severity} />
      </div>
      <button
        type="button"
        onClick={() => navigate(bugTrackerRoutes.issue(issue.key))}
        className="mt-1.5 line-clamp-2 text-left text-[13px] font-medium leading-snug text-ink hover:text-accent focus:outline-none focus-visible:underline">
        
        {issue.title}
      </button>
      <p className="mt-1 truncate text-xs text-ink-subtle">{getProject(issue.projectId)?.name}</p>

      {(issue.blocked || overdue) &&
      <div className="mt-2 flex flex-wrap gap-1">
          {issue.blocked &&
        <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger-ink" title={issue.blockedReason}>
              <BanIcon className="h-3 w-3" aria-hidden="true" />
              Blocked
            </span>
        }
          {overdue &&
        <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger-ink">
              <AlertTriangleIcon className="h-3 w-3" aria-hidden="true" />
              Overdue
            </span>
        }
        </div>
      }

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
        <div className="flex items-center gap-2.5">
          <PriorityBadge priority={issue.priority} iconOnly />
          <DueDateLabel issue={issue} variant="relative" />
        </div>
        <span title={assignee?.name ?? 'Unassigned'}>
          <Avatar employee={assignee} size="xs" />
        </span>
      </div>

      {transitions.length > 0 &&
      <label className="mt-2 block lg:hidden">
          <span className="sr-only">Move {issue.key}</span>
          <select
          value=""
          onChange={(e) => {
            const t = transitions.find((x) => x.id === e.target.value);
            if (t) onMove(issue, t);
          }}
          className="h-8 w-full rounded-md border border-line-strong bg-canvas px-2 text-xs text-ink-muted">
          
            <option value="">Move to…</option>
            {transitions.map((t) =>
          <option key={t.id} value={t.id}>
                {t.label} → {t.to}
              </option>
          )}
          </select>
        </label>
      }
    </article>);

}