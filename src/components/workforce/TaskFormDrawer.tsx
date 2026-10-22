import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Task, TaskKind, TaskPriority, TaskStatus } from '@shared/types';
import { uid } from '@shared/domain/random';
import { cmd } from '../../utils/commands';
import { fmtMin, sessionActiveMs, todayKey, MINUTE } from '@shared/domain/time';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { DatePicker } from '../ui/DatePicker';
import { Drawer } from '../ui/Overlay';
import { Banner, KeyValue } from '../ui/Primitives';

export const taskStatuses: TaskStatus[] = ['To Do', 'In Progress', 'Blocked', 'Completed'];
export const blankTask = (projectId = ''): Task => ({ id: uid('k'), title: '', description: '', projectId, assigneeId: '', startDate: todayKey(), dueDate: '', status: 'To Do', kind: 'Work' });

export function TaskFormDrawer({ task, onClose }: {task: Task | null;onClose: () => void;}) {
  const { state, personName } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [f, setF] = useState<Task | null>(task);
  const [assignTo, setAssignTo] = useState<'employee' | 'team'>('employee');
  const [touched, setTouched] = useState(false);
  useEffect(() => {setF(task);setAssignTo(task?.teamId && !task.assigneeId ? 'team' : 'employee');setTouched(false);setError(null);}, [task, setError]);
  if (!f) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const isNew = !state.tasks.some((t) => t.id === f.id);
  const kind: TaskKind = f.kind === 'Learning' ? 'Learning' : 'Work';
  const sessions = state.sessions.filter((s) => s.taskId === f.id);
  const logged = sessions.reduce((a, s) => a + Math.floor(sessionActiveMs(s, Date.now()) / MINUTE), 0);
  const contributors = [...new Set(sessions.map((s) => s.employeeId))];
  const errs: Record<string, string | undefined> = {
    title: !f.title.trim() ? 'Enter a task title.' : undefined,
    projectId: !f.projectId ? 'Choose a project.' : undefined,
    assignee: kind === 'Learning' ? undefined : assignTo === 'employee' ? !f.assigneeId ? 'Choose an employee.' : undefined : !f.teamId ? 'Choose a team.' : undefined,
    dueDate: !f.dueDate ? 'Enter a due date.' : f.dueDate < f.startDate ? 'Due date must be after the start date.' : undefined
  };
  const show = (k: string) => touched ? errs[k] : undefined;
  const save = async () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const next: Task = {
      ...f,
      title: f.title.trim(),
      kind,
      assigneeId: kind === 'Learning' ? undefined : assignTo === 'employee' ? f.assigneeId : undefined,
      teamId: kind === 'Learning' ? undefined : assignTo === 'team' ? f.teamId : undefined,
      priority: f.priority || undefined
    };
    if (await mutate(cmd.saveTask(next), isNew ? 'Task created' : 'Task updated')) onClose();
  };
  return (
    <Drawer open onClose={onClose} title={isNew ? 'Create task' : 'Task details'}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={save}>{isNew ? 'Create task' : 'Save changes'}</Button></>}>
      <div className="space-y-4">
        {!isNew &&
        <dl className="grid grid-cols-2 gap-4 rounded-lg bg-canvas p-4">
            <KeyValue label="Time logged" value={fmtMin(logged)} />
            <KeyValue label="Contributors" value={contributors.length ? contributors.map(personName).join(', ') : '—'} />
          </dl>
        }
        <Field label="Title" required error={show('title')}>{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} invalid={!!show('title')} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Task type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['Work', 'Learning'] as const).map((k) =>
            <label key={k} className={cn('cursor-pointer rounded-lg border p-3 transition-colors duration-150', kind === k ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="task-kind" className="sr-only" checked={kind === k} onChange={() => setF({ ...f, kind: k })} />
              <span className="block text-sm font-semibold">{k === 'Work' ? 'Work task' : 'Learning task'}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{k === 'Work' ? 'Owned by one person or one team.' : 'Shared with every employee.'}</span>
            </label>
            )}
          </div>
        </fieldset>
        <Field label="Project" required error={show('projectId')}>{(id) => <Select id={id} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} invalid={!!show('projectId')}><option value="">Select project</option>{state.projects.filter((p) => p.status !== 'Archived').map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</Select>}</Field>
        {kind === 'Learning' ?
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">Learning tasks are created without an owner, so every employee can pick them up and record time against them.</p> :
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Assign to">{(id) => <Select id={id} value={assignTo} onChange={(e) => setAssignTo(e.target.value as 'employee' | 'team')}><option value="employee">Employee</option><option value="team">Team</option></Select>}</Field>
          {assignTo === 'employee' ?
          <Field label="Employee" required error={show('assignee')}>{(id) => <Select id={id} value={f.assigneeId ?? ''} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} invalid={!!show('assignee')}><option value="">Select employee</option>{state.employees.filter((e) => e.status === 'Active').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}</Field> :

          <Field label="Team" required error={show('assignee')}>{(id) => <Select id={id} value={f.teamId ?? ''} onChange={(e) => setF({ ...f, teamId: e.target.value })} invalid={!!show('assignee')}><option value="">Select team</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          }
        </div>
        }
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required>{(id) => <DatePicker id={id} value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />}</Field>
          <Field label="Due date" required error={show('dueDate')}>{(id) => <DatePicker id={id} value={f.dueDate} min={f.startDate || undefined} onChange={(v) => setF({ ...f, dueDate: v })} invalid={!!show('dueDate')} />}</Field>
          <Field label="Priority" hint="Optional">{(id) => <Select id={id} value={f.priority ?? ''} onChange={(e) => setF({ ...f, priority: (e.target.value || undefined) as TaskPriority | undefined })}><option value="">None</option><option>Low</option><option>Medium</option><option>High</option></Select>}</Field>
          <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TaskStatus })}>{taskStatuses.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
        </div>
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Drawer>);

}