import React from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { rolePreviews } from '../../data/rolePreview';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { transitions, WORKFLOW_STATUSES } from '../../utils/workflow';

const roleShort = (role: string) => rolePreviews.find((r) => r.role === role)?.label.split(' / ')[0] ?? role;

export function StatusWorkflowSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Status workflow</h2>
        <p className="mt-0.5 text-[13px] text-ink-subtle">Issues move only through these transitions. Reopened returns work to the assigned developer.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface p-4 shadow-card">
        <div className="flex min-w-max items-center gap-2">
          {WORKFLOW_STATUSES.map((s, idx) =>
          <React.Fragment key={s}>
              <IssueStatusBadge status={s} />
              {idx < WORKFLOW_STATUSES.length - 1 && <ArrowRightIcon className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />}
            </React.Fragment>
          )}
        </div>
        <div className="mt-3 flex min-w-max items-center gap-2 text-xs text-ink-subtle">
          <IssueStatusBadge status="Reopened" />
          <span>from QA Testing (failed), Resolved or Closed → back to In Progress</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-canvas text-xs text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Action</th>
              <th scope="col" className="px-4 py-2 font-medium">From → To</th>
              <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">Who can do it</th>
              <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">Requires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {transitions.map((t) =>
            <tr key={t.id}>
                <td className="px-4 py-2.5 font-medium text-ink">{t.label}</td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {t.from.join(', ')} → <span className="text-ink">{t.to}</span>
                </td>
                <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">
                  {t.roles.map(roleShort).join(', ')}
                  {t.assigneeOnly && <span className="text-ink-faint"> (developer must be assignee)</span>}
                </td>
                <td className="hidden px-4 py-2.5 text-ink-muted lg:table-cell">
                  {t.opensAssignment ? 'Assignee' : t.prompt ? `${t.prompt.label}${t.prompt.required ? '' : ' (optional)'}` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>);

}