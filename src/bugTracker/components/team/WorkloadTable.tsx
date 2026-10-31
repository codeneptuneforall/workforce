import React, { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { workloadCapacity } from '../../data/trackerConfig';
import type { Employee, Issue } from '../../types/bugTracker';
import { isOverdue } from '../../utils/issueMetrics';
import { statusStyles } from '../../utils/issueStyles';
import { isOpenStatus } from '../../utils/workflow';
import { DueDateLabel } from '../badges/DueDateLabel';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface WorkloadTableProps {
  members: Employee[];
  issues: Issue[];
  onReassign: (issue: Issue) => void;
}

const segments = [
{ label: 'To start', statuses: ['Assigned'], color: statusStyles.Assigned.hex },
{ label: 'In progress', statuses: ['In Progress'], color: statusStyles['In Progress'].hex },
{ label: 'Reopened', statuses: ['Reopened'], color: statusStyles.Reopened.hex },
{ label: 'With QA', statuses: ['Fixed', 'QA Testing'], color: statusStyles['QA Testing'].hex }];


export function WorkloadTable({ members, issues, onReassign }: WorkloadTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { getProject } = useBugTracker();
  const scale = Math.max(workloadCapacity + 1, ...members.map((m) => issues.filter((i) => i.assigneeId === m.id && isOpenStatus(i.status)).length));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-xs text-ink-subtle">
        {segments.map((s) =>
        <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px bg-ink" aria-hidden="true" />
          Capacity ({workloadCapacity} open)
        </span>
      </div>

      <div className="hidden grid-cols-[minmax(200px,1.4fr)_2fr_repeat(4,64px)_24px] gap-3 border-b border-line bg-canvas px-4 py-2 text-xs font-medium text-ink-subtle md:grid">
        <span>Developer</span>
        <span>Open workload</span>
        <span className="text-right">Assigned</span>
        <span className="text-right">Open</span>
        <span className="text-right">Overdue</span>
        <span className="text-right">Critical</span>
        <span />
      </div>

      <ul className="divide-y divide-line">
        {members.map((member) => {
          const assigned = issues.filter((i) => i.assigneeId === member.id);
          const open = assigned.filter((i) => isOpenStatus(i.status));
          const overdue = open.filter(isOverdue).length;
          const critical = open.filter((i) => i.severity === 'Critical').length;
          const isOpen = expanded === member.id;
          const over = open.length > workloadCapacity;
          return (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : member.id)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas md:grid-cols-[minmax(200px,1.4fr)_2fr_repeat(4,64px)_24px]">
                
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar employee={member} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{member.name}</span>
                    <span className="block truncate text-xs text-ink-subtle">{member.title}</span>
                  </span>
                </span>
                <span className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                  <span className="relative flex h-2.5 overflow-hidden rounded-full bg-neutral-soft" role="img" aria-label={`${open.length} open issues of ${workloadCapacity} capacity`}>
                    {segments.map((s) => {
                      const count = open.filter((i) => s.statuses.includes(i.status)).length;
                      return count ? <span key={s.label} style={{ width: `${count / scale * 100}%`, backgroundColor: s.color }} /> : null;
                    })}
                    <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${workloadCapacity / scale * 100}%` }} aria-hidden="true" />
                  </span>
                  <span className={`mt-1 block text-xs ${over ? 'font-medium text-danger-ink' : 'text-ink-subtle'}`}>
                    {over ? `Over capacity by ${open.length - workloadCapacity}` : `${workloadCapacity - open.length} slots available`}
                  </span>
                </span>
                <span className="hidden text-right text-[13px] tabular-nums text-ink-muted md:block">{assigned.length}</span>
                <span className="hidden text-right text-[13px] font-semibold tabular-nums text-ink md:block">{open.length}</span>
                <span className={`hidden text-right text-[13px] tabular-nums md:block ${overdue ? 'font-semibold text-danger-ink' : 'text-ink-faint'}`}>{overdue}</span>
                <span className={`hidden text-right text-[13px] tabular-nums md:block ${critical ? 'font-semibold text-danger-ink' : 'text-ink-faint'}`}>{critical}</span>
                <span className="flex items-center justify-end gap-2 text-xs text-ink-subtle md:block">
                  <span className="md:hidden">
                    {open.length} open · {overdue} overdue
                  </span>
                  <ChevronRightIcon className={`h-4 w-4 text-ink-faint transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                </span>
              </button>

              {isOpen &&
              <div className="border-t border-line bg-canvas px-4 py-3">
                  {open.length === 0 ?
                <p className="text-[13px] text-ink-subtle">No open issues assigned.</p> :

                <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
                      {open.map((issue) =>
                  <li key={issue.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                          <span className="font-mono text-xs text-ink-subtle">{issue.key}</span>
                          <Link to={bugTrackerRoutes.issue(issue.key)} className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:text-accent">
                            {issue.title}
                          </Link>
                          <span className="hidden text-xs text-ink-subtle lg:inline">{getProject(issue.projectId)?.name}</span>
                          <SeverityBadge severity={issue.severity} />
                          <IssueStatusBadge status={issue.status} />
                          <DueDateLabel issue={issue} variant="relative" />
                          <Button size="sm" variant="ghost" onClick={() => onReassign(issue)}>
                            Reassign
                          </Button>
                        </li>
                  )}
                    </ul>
                }
                </div>
              }
            </li>);

        })}
      </ul>
    </div>);

}