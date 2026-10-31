import React, { useState } from 'react';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import type { Issue, IssueStatus } from '../../types/bugTracker';
import { isOverdue } from '../../utils/issueMetrics';
import { severityRank, statusStyles } from '../../utils/issueStyles';
import { ALL_STATUSES, findTransitionTo, getAvailableTransitions, type WorkflowTransition } from '../../utils/workflow';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  issues: Issue[];
  onMove: (issue: Issue, transition: WorkflowTransition) => void;
}

export function KanbanBoard({ issues, onMove }: KanbanBoardProps) {
  const { currentUser } = useBugTracker();
  const [dragging, setDragging] = useState<Issue | null>(null);
  const [overColumn, setOverColumn] = useState<IssueStatus | null>(null);
  const [mobileColumn, setMobileColumn] = useState<IssueStatus>('In Progress');

  const byStatus = (status: IssueStatus) =>
  issues.filter((i) => i.status === status).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const handleDrop = (status: IssueStatus) => {
    setOverColumn(null);
    if (!dragging || dragging.status === status) return;
    const transition = findTransitionTo(dragging, status, currentUser.role, currentUser.id);
    if (!transition) {
      toast.error(`Can’t move ${dragging.key} to ${status}`, { description: `From ${dragging.status}, the workflow doesn’t allow this for your role.` });
      return;
    }
    onMove(dragging, transition);
    setDragging(null);
  };

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" role="tablist" aria-label="Board columns">
        {ALL_STATUSES.map((status) =>
        <button
          key={status}
          type="button"
          role="tab"
          aria-selected={mobileColumn === status}
          onClick={() => setMobileColumn(status)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
          mobileColumn === status ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-muted'}`
          }>
          
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[status].dot}`} aria-hidden="true" />
            {status}
            <span className="text-ink-faint">{byStatus(status).length}</span>
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 lg:-mx-6 lg:px-6">
        {ALL_STATUSES.map((status) => {
          const columnIssues = byStatus(status);
          const validTarget = dragging ? Boolean(findTransitionTo(dragging, status, currentUser.role, currentUser.id)) : false;
          const isOver = overColumn === status;
          const attention = columnIssues.filter((i) => isOverdue(i) || i.blocked).length;
          return (
            <section
              key={status}
              aria-label={`${status} column`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = validTarget ? 'move' : 'none';
                setOverColumn(status);
              }}
              onDragLeave={() => setOverColumn((c) => c === status ? null : c)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(status);
              }}
              className={`flex w-full shrink-0 flex-col rounded-lg border transition-[background-color,border-color,opacity] duration-150 lg:w-[272px] ${
              mobileColumn === status ? 'flex' : 'hidden lg:flex'} ${

              dragging && dragging.status !== status ?
              validTarget ?
              isOver ?
              'border-accent bg-accent-soft' :
              'border-dashed border-accent-line bg-canvas' :
              'border-line bg-canvas' :
              'border-line bg-neutral-soft/60'}`
              }>
              
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className={`h-2 w-2 rounded-full ${statusStyles[status].dot}`} aria-hidden="true" />
                <h2 className="text-[13px] font-semibold text-ink">{status}</h2>
                <span className="text-xs font-medium text-ink-subtle tabular-nums">{columnIssues.length}</span>
                {attention > 0 && <span className="ml-auto rounded bg-danger-soft px-1.5 text-[11px] font-medium text-danger-ink">{attention} need attention</span>}
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
                {columnIssues.map((issue) =>
                <KanbanCard
                  key={issue.id}
                  issue={issue}
                  transitions={getAvailableTransitions(issue, currentUser.role, currentUser.id)}
                  dragging={dragging?.id === issue.id}
                  onDragStart={setDragging}
                  onDragEnd={() => {
                    setDragging(null);
                    setOverColumn(null);
                  }}
                  onMove={onMove} />

                )}
                {columnIssues.length === 0 &&
                <p className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-faint">
                    {dragging && validTarget ? 'Drop here' : 'No issues'}
                  </p>
                }
              </div>
            </section>);

        })}
      </div>
    </div>);

}