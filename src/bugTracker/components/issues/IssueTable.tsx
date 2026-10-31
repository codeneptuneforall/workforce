import React from 'react';
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, BanIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue, SortKey, SortState } from '../../types/bugTracker';
import { formatDate } from '../../utils/dates';
import { DueDateLabel } from '../badges/DueDateLabel';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { PriorityBadge } from '../badges/PriorityBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';

interface IssueTableProps {
  issues: Issue[];
  sort: SortState;
  onSort: (key: SortKey) => void;
}

const columns: {key: SortKey;label: string;className?: string;}[] = [
{ key: 'key', label: 'Key', className: 'w-20' },
{ key: 'title', label: 'Title', className: 'min-w-[260px]' },
{ key: 'project', label: 'Project' },
{ key: 'type', label: 'Type' },
{ key: 'severity', label: 'Severity' },
{ key: 'priority', label: 'Priority' },
{ key: 'status', label: 'Status' },
{ key: 'assignee', label: 'Assignee' },
{ key: 'reporter', label: 'Reporter' },
{ key: 'createdAt', label: 'Created' },
{ key: 'dueDate', label: 'Due' }];


export function IssueTable({ issues, sort, onSort }: IssueTableProps) {
  const navigate = useNavigate();
  const { getEmployee, getProject } = useBugTracker();

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1180px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-canvas">
              {columns.map((col) => {
                const active = sort.key === col.key;
                const SortIcon = !active ? ArrowUpDownIcon : sort.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}
                    className={`px-3 py-2 font-medium text-ink-subtle ${col.className ?? ''}`}>
                    
                    <button type="button" onClick={() => onSort(col.key)} className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-ink ${active ? 'text-ink' : ''}`}>
                      {col.label}
                      <SortIcon className={`h-3.5 w-3.5 ${active ? 'text-accent' : 'text-ink-faint'}`} aria-hidden="true" />
                    </button>
                  </th>);

              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {issues.map((issue) => {
              const assignee = getEmployee(issue.assigneeId);
              const reporter = getEmployee(issue.reporterId);
              return (
                <tr
                  key={issue.id}
                  onClick={() => navigate(bugTrackerRoutes.issue(issue.key))}
                  className="cursor-pointer transition-colors duration-150 hover:bg-canvas">
                  
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-ink-muted">{issue.key}</td>
                  <td className="px-3 py-2.5">
                    <a
                      href={bugTrackerRoutes.issue(issue.key)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(bugTrackerRoutes.issue(issue.key));
                      }}
                      className="font-medium text-ink hover:text-accent focus:outline-none focus-visible:underline">
                      
                      {issue.title}
                    </a>
                    {issue.blocked &&
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 align-middle text-[11px] font-medium text-danger-ink">
                        <BanIcon className="h-3 w-3" aria-hidden="true" />
                        Blocked
                      </span>
                    }
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{getProject(issue.projectId)?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{issue.type}</td>
                  <td className="px-3 py-2.5">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge priority={issue.priority} />
                  </td>
                  <td className="px-3 py-2.5">
                    <IssueStatusBadge status={issue.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-muted">
                      <Avatar employee={assignee} size="xs" />
                      {assignee?.name ?? <span className="text-ink-faint">Unassigned</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{reporter?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{formatDate(issue.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <DueDateLabel issue={issue} />
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {issues.map((issue) => {
          const assignee = getEmployee(issue.assigneeId);
          return (
            <li key={issue.id}>
              <button type="button" onClick={() => navigate(bugTrackerRoutes.issue(issue.key))} className="w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-ink-subtle">{issue.key}</span>
                  <IssueStatusBadge status={issue.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{issue.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <SeverityBadge severity={issue.severity} />
                  <PriorityBadge priority={issue.priority} />
                  <span className="text-xs text-ink-subtle">{getProject(issue.projectId)?.name}</span>
                  <DueDateLabel issue={issue} variant="relative" />
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <Avatar employee={assignee} size="xs" />
                    {assignee?.name?.split(' ')[0] ?? 'Unassigned'}
                  </span>
                </div>
              </button>
            </li>);

        })}
      </ul>
    </>);

}