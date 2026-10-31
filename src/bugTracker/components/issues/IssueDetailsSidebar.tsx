import React from 'react';
import { Link } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { formatDate, formatDateTime } from '../../utils/dates';
import { dueLabel } from '../../utils/issueMetrics';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { PriorityBadge } from '../badges/PriorityBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { Avatar } from '../ui/Avatar';

const qaTone: Record<string, string> = {
  'Not submitted': 'text-ink-subtle',
  'Awaiting QA': 'text-teal-ink',
  'In testing': 'text-warning-ink',
  Passed: 'text-success-ink',
  Failed: 'text-danger-ink'
};

export function IssueDetailsSidebar({ issue }: {issue: Issue;}) {
  const { getEmployee, getProject, getIssueByKey } = useBugTracker();
  const assignee = getEmployee(issue.assigneeId);
  const reporter = getEmployee(issue.reporterId);
  const due = dueLabel(issue);
  const verifier = getEmployee(issue.qa.verifierId);

  const rows: {label: string;value: React.ReactNode;}[] = [
  { label: 'Status', value: <IssueStatusBadge status={issue.status} /> },
  { label: 'Project', value: getProject(issue.projectId)?.name },
  { label: 'Type', value: issue.type },
  { label: 'Severity', value: <SeverityBadge severity={issue.severity} /> },
  { label: 'Priority', value: <PriorityBadge priority={issue.priority} /> },
  {
    label: 'Assignee',
    value:
    <span className="inline-flex items-center gap-2">
          <Avatar employee={assignee} size="xs" />
          {assignee?.name ?? <span className="text-ink-faint">Unassigned</span>}
        </span>

  },
  {
    label: 'Reporter',
    value:
    <span className="inline-flex items-center gap-2">
          <Avatar employee={reporter} size="xs" />
          {reporter?.name}
        </span>

  },
  {
    label: 'Due date',
    value: issue.dueDate ?
    <span>
          {formatDate(issue.dueDate)}
          {due.tone !== 'muted' && <span className={`ml-1.5 text-xs font-medium ${due.tone === 'danger' ? 'text-danger-ink' : 'text-warning-ink'}`}>{due.text}</span>}
        </span> :

    <span className="text-ink-faint">Not set</span>

  },
  { label: 'Environment', value: issue.environment },
  { label: 'Feature', value: issue.feature || '—' },
  { label: 'Created', value: <span title={formatDateTime(issue.createdAt)}>{formatDate(issue.createdAt)}</span> },
  { label: 'Updated', value: <span title={formatDateTime(issue.updatedAt)}>{formatDate(issue.updatedAt)}</span> }];


  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Details</h2>
        <dl className="divide-y divide-line">
          {rows.map((row) =>
          <div key={row.label} className="grid grid-cols-[96px_1fr] items-center gap-3 px-4 py-2.5 text-[13px]">
              <dt className="text-ink-subtle">{row.label}</dt>
              <dd className="min-w-0 text-ink">{row.value}</dd>
            </div>
          )}
          <div className="grid grid-cols-[96px_1fr] gap-3 px-4 py-2.5 text-[13px]">
            <dt className="text-ink-subtle">Labels</dt>
            <dd className="flex flex-wrap gap-1">
              {issue.labels.length ?
              issue.labels.map((l) =>
              <span key={l} className="rounded bg-neutral-soft px-1.5 py-0.5 text-xs text-neutral-ink">
                    {l}
                  </span>
              ) :

              <span className="text-ink-faint">None</span>
              }
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">QA verification</h2>
        <p className={`mt-1 text-[13px] font-medium ${qaTone[issue.qa.status]}`}>{issue.qa.status}</p>
        {verifier && <p className="mt-0.5 text-xs text-ink-subtle">Verifier: {verifier.name}</p>}
        {issue.submittedForQaAt && <p className="mt-0.5 text-xs text-ink-subtle">Submitted {formatDate(issue.submittedForQaAt)}</p>}
      </section>

      <section className="rounded-lg border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Related issues</h2>
        {issue.relatedIssueKeys.length === 0 ?
        <p className="px-4 py-3 text-[13px] text-ink-faint">No related issues</p> :

        <ul className="divide-y divide-line">
            {issue.relatedIssueKeys.map((key) => {
            const related = getIssueByKey(key);
            if (!related) return null;
            return (
              <li key={key}>
                  <Link to={bugTrackerRoutes.issue(key)} className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-canvas">
                    <span className="font-mono text-xs text-ink-subtle">{key}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{related.title}</span>
                    <IssueStatusBadge status={related.status} />
                  </Link>
                </li>);

          })}
          </ul>
        }
      </section>
    </div>);

}