import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon, SearchIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { priorities, workloadCapacity } from '../../data/trackerConfig';
import type { Issue, Priority } from '../../types/bugTracker';
import { isOpenStatus } from '../../utils/workflow';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SelectField } from '../ui/SelectField';
import { TextField } from '../ui/TextField';

export interface AssignmentResult {
  assigneeId: string;
  dueDate: string | null;
  priority?: Priority;
}

interface AssignmentDialogProps {
  issue: Issue | null;
  onClose: () => void;
  onConfirm: (result: AssignmentResult) => void;
}

export function AssignmentDialog({ issue, onClose, onConfirm }: AssignmentDialogProps) {
  const { employees, issues, permissions, getProject } = useBugTracker();
  const [query, setQuery] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!issue) return;
    setAssigneeId(issue.assigneeId ?? '');
    setDueDate(issue.dueDate ?? '');
    setPriority(issue.priority);
    setQuery('');
    setError('');
  }, [issue]);

  const developers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.
    filter((e) => e.role === 'developer').
    filter((e) => !q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)).
    map((e) => ({
      employee: e,
      openCount: issues.filter((i) => i.assigneeId === e.id && isOpenStatus(i.status)).length,
      worksOnProject: issue ? e.projectIds.includes(issue.projectId) : false
    })).
    sort((a, b) => Number(b.worksOnProject) - Number(a.worksOnProject) || a.openCount - b.openCount);
  }, [employees, issues, query, issue]);

  const submit = () => {
    if (!assigneeId) {
      setError('Choose a developer to assign.');
      return;
    }
    onConfirm({ assigneeId, dueDate: dueDate || null, priority: permissions.setPriority ? priority : undefined });
  };

  const isReassign = Boolean(issue?.assigneeId);

  return (
    <Modal
      open={Boolean(issue)}
      onClose={onClose}
      title={isReassign ? 'Reassign issue' : 'Assign developer'}
      description={issue ? `${issue.key} · ${issue.title}` : undefined}
      size="lg"
      footer={
      <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {isReassign ? 'Reassign' : 'Assign'}
          </Button>
        </>
      }>
      
      <div className="space-y-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search developers"
            aria-label="Search developers"
            className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          
        </div>
        <div role="radiogroup" aria-label="Developers" className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {developers.map(({ employee, openCount, worksOnProject }) => {
            const selected = assigneeId === employee.id;
            const overCapacity = openCount >= workloadCapacity;
            return (
              <button
                key={employee.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setAssigneeId(employee.id);
                  setError('');
                }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ${selected ? 'bg-accent-soft' : 'hover:bg-canvas'}`}>
                
                <Avatar employee={employee} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{employee.name}</p>
                  <p className="truncate text-xs text-ink-subtle">
                    {employee.title}
                    {worksOnProject && issue ? ` · Works on ${getProject(issue.projectId)?.name}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${overCapacity ? 'text-danger-ink' : 'text-ink-muted'}`}>{openCount} open</p>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-neutral-soft">
                    <div className={`h-full ${overCapacity ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, openCount / workloadCapacity * 100)}%` }} />
                  </div>
                </div>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${selected ? 'bg-accent text-white' : 'border border-line-strong'}`}>
                  {selected && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
                </span>
              </button>);

          })}
          {!developers.length && <p className="px-3 py-6 text-center text-sm text-ink-subtle">No developers match “{query}”.</p>}
        </div>
        {error && <p className="text-xs text-danger-ink">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="assign-due" label="Due date" type="date" value={dueDate} onChange={setDueDate} />
          {permissions.setPriority &&
          <SelectField id="assign-priority" label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={priorities.map((p) => ({ value: p, label: p }))} />
          }
        </div>
      </div>
    </Modal>);

}