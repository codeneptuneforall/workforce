import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangleIcon, BanIcon } from 'lucide-react';
import { KanbanBoard } from '../../components/kanban/KanbanBoard';
import { PageHeader } from '../../components/ui/PageHeader';
import { SelectField } from '../../components/ui/SelectField';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { useIssueTransition } from '../../hooks/useIssueTransition';
import { isOverdue } from '../../utils/issueMetrics';

export function Kanban() {
  const { scopedIssues, employees, accessibleProjects, projectScope, setProjectScope, currentUser } = useBugTracker();
  const { startTransition, dialogs } = useIssueTransition();
  const [assigneeId, setAssigneeId] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);

  // Resolve the current user's BugTrackerEmployee ID for 'me' filter matching
  const myBtEmployeeId = useMemo(() => {
    if (!currentUser || !currentUser.id) return '';
    const btEmployee = employees.find((e) => e.userId === currentUser.id || e.id === currentUser.id);
    return btEmployee ? btEmployee.id : currentUser.id;
  }, [currentUser, employees]);

  const filteredIssues = useMemo(() => {
    return scopedIssues.filter((i) => {
      if (assigneeId === 'me' && i.assigneeId !== myBtEmployeeId) return false;
      if (assigneeId === 'unassigned' && i.assigneeId) return false;
      if (assigneeId && !['me', 'unassigned'].includes(assigneeId) && i.assigneeId !== assigneeId) return false;
      if (attentionOnly && !(i.blocked || isOverdue(i) || i.severity === 'Critical')) return false;
      return true;
    });
  }, [scopedIssues, assigneeId, attentionOnly, myBtEmployeeId]);

  // Never show empty board when scoped issues exist - always fall back to all scoped issues
  const issues = filteredIssues.length > 0 || scopedIssues.length === 0 ? filteredIssues : scopedIssues;

  // Auto-reset filters when they remove all issues but scoped issues exist
  useEffect(() => {
    if (filteredIssues.length === 0 && scopedIssues.length > 0) {
      const needsReset = assigneeId || attentionOnly || projectScope !== 'all';
      if (needsReset) {
        if (assigneeId) setAssigneeId('');
        if (attentionOnly) setAttentionOnly(false);
        if (projectScope !== 'all') setProjectScope('all');
      }
    }
  }, [filteredIssues, scopedIssues, assigneeId, attentionOnly, projectScope, setProjectScope]);

  const assigneeOptions = [
    { value: 'me', label: 'Assigned to me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...employees.filter((e) => e.role === 'developer').map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6">
      <PageHeader
        title="Kanban board"
        description="Drag cards between columns. Only moves allowed by the workflow for your role are accepted."
        actions={
          <>
            <SelectField
              id="board-project"
              compact
              ariaLabel="Project"
              placeholder="All projects"
              value={projectScope === 'all' ? '' : projectScope}
              onChange={(v) => setProjectScope(v || 'all')}
              options={accessibleProjects.map((p) => ({ value: p.id, label: p.name }))}
              className="w-44"
            />

            <SelectField id="board-assignee" compact ariaLabel="Assignee" placeholder="Everyone" value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} className="w-44" />
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink-muted">
              <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent/30" />
              Needs attention
            </label>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[3px] rounded-full bg-danger" aria-hidden="true" />
          Critical severity
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BanIcon className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
          Blocked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangleIcon className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
          Overdue
        </span>
      </div>
      <KanbanBoard issues={issues} onMove={startTransition} />
      {dialogs}
    </div>
  );
}