import React, { useMemo, useState } from 'react';
import { InboxIcon } from 'lucide-react';
import { IssueQuickRow } from '../../components/issues/IssueQuickRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { useIssueTransition } from '../../hooks/useIssueTransition';
import type { Issue } from '../../types/bugTracker';
import { daysFromToday } from '../../utils/dates';
import { isOverdue } from '../../utils/issueMetrics';
import { severityRank } from '../../utils/issueStyles';
import { getAvailableTransitions, isOpenStatus } from '../../utils/workflow';

type TabId = 'assigned' | 'reported' | 'recent' | 'overdue' | 'qa';

const emptyCopy: Record<TabId, {title: string;description: string;}> = {
  assigned: { title: 'Nothing assigned to you', description: 'Issues assigned to you by a team lead will show up here.' },
  reported: { title: 'You haven’t reported any issues', description: 'Bugs you report are tracked here so you can follow their progress.' },
  recent: { title: 'No recent updates', description: 'Issues you’re involved in will appear here when they change.' },
  overdue: { title: 'Nothing overdue', description: 'You’re on track — none of your issues are past their due date.' },
  qa: { title: 'QA queue is clear', description: 'Fixes waiting for your verification will appear here.' }
};

export function MyIssues() {
  const { scopedIssues, currentUser, permissions } = useBugTracker();
  const { startTransition, dialogs } = useIssueTransition();
  const [tab, setTab] = useState<TabId>(currentUser.role === 'reporter' ? 'reported' : currentUser.role === 'qa' ? 'qa' : 'assigned');

  const involved = (i: Issue) => i.assigneeId === currentUser.id || i.reporterId === currentUser.id || i.comments.some((c) => c.authorId === currentUser.id);

  const lists = useMemo(() => {
    const bySeverity = (a: Issue, b: Issue) => severityRank[a.severity] - severityRank[b.severity];
    return {
      assigned: scopedIssues.filter((i) => i.assigneeId === currentUser.id && isOpenStatus(i.status)).sort(bySeverity),
      reported: scopedIssues.filter((i) => i.reporterId === currentUser.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      recent: scopedIssues.
      filter(involved).
      sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).
      slice(0, 10),
      overdue: scopedIssues.filter((i) => involved(i) && isOverdue(i)).sort(bySeverity),
      qa: scopedIssues.
      filter((i) => i.status === 'Fixed' || i.status === 'QA Testing' && i.qa.verifierId === currentUser.id).
      sort(bySeverity)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedIssues, currentUser.id]);

  const tabs: {id: TabId;label: string;}[] = [
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'reported', label: 'Reported by me' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'overdue', label: 'Overdue' },
  ...(permissions.verifyQA ? [{ id: 'qa' as TabId, label: 'Awaiting my QA' }] : [])];


  const dueThisWeek = lists.assigned.filter((i) => i.dueDate && daysFromToday(i.dueDate) >= 0 && daysFromToday(i.dueDate) <= 7).length;
  const summary = [
  { label: 'Open & assigned', value: lists.assigned.length },
  { label: 'Due in 7 days', value: dueThisWeek },
  { label: 'Overdue', value: lists.overdue.length, danger: lists.overdue.length > 0 },
  permissions.verifyQA ?
  { label: 'Awaiting my QA', value: lists.qa.length } :
  { label: 'My open reports', value: lists.reported.filter((i) => isOpenStatus(i.status)).length }];


  const current = lists[tab];

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="My issues" description={`${currentUser.name} · ${currentUser.title}`} />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-4">
        {summary.map((s) =>
        <div key={s.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-ink-subtle">{s.label}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${s.danger ? 'text-danger-ink' : 'text-ink'}`}>{s.value}</dd>
          </div>
        )}
      </dl>

      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist" aria-label="My issue views">
          {tabs.map((t) =>
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors duration-150 ${
            tab === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-subtle hover:text-ink'}`
            }>
            
              {t.label}
              <span className={`ml-1.5 rounded px-1.5 text-[11px] ${t.id === 'overdue' && lists.overdue.length ? 'bg-danger-soft text-danger-ink' : 'bg-neutral-soft text-ink-subtle'}`}>
                {lists[t.id].length}
              </span>
            </button>
          )}
        </div>
        <div role="tabpanel">
          {current.length === 0 ?
          <EmptyState icon={InboxIcon} title={emptyCopy[tab].title} description={emptyCopy[tab].description} /> :

          <ul className="divide-y divide-line">
              {current.map((issue) =>
            <IssueQuickRow
              key={issue.id}
              issue={issue}
              quickAction={getAvailableTransitions(issue, currentUser.role, currentUser.id).find((t) => t.id !== 'assign' && t.id !== 'close')}
              onQuickAction={startTransition} />

            )}
            </ul>
          }
        </div>
      </section>
      {dialogs}
    </div>);

}