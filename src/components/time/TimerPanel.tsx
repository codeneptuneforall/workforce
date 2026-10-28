import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRightIcon, FlagIcon, PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { AppState, Employee, TaskKind, WorkSession } from '@shared/types';
import { canTrackProject, canWorkOnTask } from '@shared/domain/access';
import { isLearningProject } from '@shared/domain/learning';
import { cn } from '../../utils/cn';
import type { Command } from '../../utils/commands';
import { cmd } from '../../utils/commands';
import { fmtClock, fmtDate, fmtMin, fmtTime, sessionActiveMs, sessionPausedMs, todayKey, MINUTE } from '@shared/domain/time';
import { breakAt, breakLabel, isBreakTime } from '@shared/domain/workday';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Overlay';
import { Banner, KeyValue } from '../ui/Primitives';

/** Whether the timer picks an existing task or creates a new one on the spot. */
export type TaskMode = 'existing' | 'new';

export interface TaskSelection {
  projectId: string;
  taskId: string;
  mode: TaskMode;
  kind: TaskKind;
  description: string;
}

const emptySelection: TaskSelection = {
  projectId: '',
  taskId: '',
  mode: 'existing',
  kind: 'Work',
  description: ''
};

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useAssignable(state: AppState, emp: Employee) {
  return useMemo(() => {
    const tasks = state.tasks.filter((t) => t.status !== 'Completed' && canWorkOnTask(t, emp));
    const projects = state.projects.filter((p) => canTrackProject(p));
    return { tasks, projects };
  }, [state.tasks, state.projects, emp]);
}

/**
 * The work entry form: pick a project, then whether this is a new or an existing task,
 * then describe the work.
 */
function TaskPicker({ emp, value, onChange, errors }: {
  emp: Employee;
  value: TaskSelection;
  onChange: (patch: Partial<TaskSelection>) => void;
  errors?: {project?: string;task?: string;description?: string;};
}) {
  const { state } = useData();
  const { tasks, projects } = useAssignable(state, emp);
  const project = projects.find((p) => p.id === value.projectId);
  const learningProject = !!project && isLearningProject(project);
  const projectTasks = tasks.filter((t) => t.projectId === value.projectId);

  const pickProject = (id: string) => {
    const next = projects.find((p) => p.id === id);
    onChange({
      projectId: id,
      taskId: '',
      kind: next && isLearningProject(next) ? 'Learning' : value.kind
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Project" required error={errors?.project}>
        {(id) =>
        <Select id={id} value={value.projectId} onChange={(e) => pickProject(e.target.value)} invalid={!!errors?.project}>
            <option value="">Select project</option>
            {projects.map((p) =>
          <option key={p.id} value={p.id}>{p.code} · {p.name}{isLearningProject(p) ? ' (learning)' : ''}</option>)}
          </Select>
        }
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">
          Status<span className="ml-0.5 text-bad" aria-hidden>*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['new', 'existing'] as const).map((m) =>
          <label key={m} className={cn('cursor-pointer rounded-lg border p-3 transition-colors duration-150', value.mode === m ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="task-mode" className="sr-only" checked={value.mode === m} onChange={() => onChange({ mode: m, taskId: m === 'new' ? '' : value.taskId })} />
              <span className="block text-sm font-semibold">{m === 'new' ? 'New task' : 'Existing task'}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{m === 'new' ? 'Create the task as you start the timer.' : 'Pick up work that is already planned.'}</span>
            </label>
          )}
        </div>
      </fieldset>

      {value.mode === 'existing' ?
      <Field label="Task" required error={errors?.task}>
          {(id) =>
          <>
            <Select id={id} value={value.taskId} onChange={(e) => onChange({ taskId: e.target.value })} disabled={!value.projectId} invalid={!!errors?.task}>
              <option value="">{value.projectId ? 'Select task' : 'Choose a project first'}</option>
              {projectTasks.map((t) =>
            <option key={t.id} value={t.id}>{t.title}{t.kind === 'Learning' ? ' (learning)' : ''}{t.status === 'Blocked' ? ' (blocked)' : ''}</option>)}
            </Select>
            {!value.projectId || projectTasks.length > 0 ?
            <p className="mt-1 text-xs text-ink-muted">Only tasks assigned to you, your team, or shared learning tasks are listed.</p> :
            <p className="mt-1 text-xs text-warn">There is no task you can pick up here — choose “New task” to create one.</p>}
          </>}
        </Field> :
      <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Task type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['Work', 'Learning'] as const).map((k) =>
            <label key={k} className={cn('cursor-pointer rounded-lg border p-3 transition-colors duration-150', value.kind === k ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong', learningProject && k === 'Work' && 'cursor-not-allowed opacity-50')}>
                <input type="radio" name="task-kind" className="sr-only" checked={value.kind === k} onChange={() => onChange({ kind: k })} disabled={learningProject && k === 'Work'} />
                <span className="block text-sm font-semibold">{k === 'Work' ? 'Work task' : 'Learning task'}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{k === 'Work' ? 'Assigned to you, tracked like any other task.' : 'Shared with every employee.'}</span>
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {learningProject ?
            'Learning & Development only holds learning tasks — available to the whole company.' :
            'A learning task is created without an owner, so every employee can pick it up.'}
          </p>
        </fieldset>}

      <Field label="Description" required={value.mode === 'new'} error={errors?.description}
      hint={value.mode === 'new' ? 'This becomes the title of the new task.' : 'Optional'}>
        {(id) =>
        <Input id={id} value={value.description} onChange={(e) => onChange({ description: e.target.value })} invalid={!!errors?.description}
          placeholder="e.g. Fix date validation on the leave form" />
        }
      </Field>
    </div>);
}

export function TimerPanel({ employee }: {employee: Employee;}) {
  const { state, project, task, restoredSessionIds } = useData();
  const now = useNow(1000);
  const online = useOnline();
  const { mutate, pending, error, setError } = useMutation();
  const lastAction = useRef<{command: Command;msg?: string;} | null>(null);
  const [selection, setSelection] = useState<TaskSelection>(emptySelection);
  const [touched, setTouched] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [restoredDismissed, setRestoredDismissed] = useState(false);
  const { projects } = useAssignable(state, employee);

  const today = todayKey(now);
  const currentBreak = breakAt(now);
  const inBreak = !!currentBreak;
  const mine = state.sessions.filter((s) => s.employeeId === employee.id);
  const active = mine.find((s) => s.status === 'Working' && s.date === today);
  const pausedToday = mine.filter((s) => s.status === 'Paused' && s.date === today);
  const current: WorkSession | undefined = active ?? pausedToday[0];
  const otherPaused = pausedToday.filter((s) => s.id !== current?.id);
  const stale = mine.filter((s) => (s.status === 'Working' || s.status === 'Paused') && s.date < today);

  const exec = async (command: Command, msg?: string) => {
    lastAction.current = { command, msg };
    return mutate(command, msg);
  };

  const start = async () => {
    setTouched(true);
    const { projectId, taskId, mode, kind, description } = selection;
    if (!projectId) return;
    if (mode === 'existing' && !taskId) return;
    if (mode === 'new' && !description.trim()) return;
    const ok = await exec(cmd.startTimer({ projectId, taskId: mode === 'existing' ? taskId : '', description, mode, kind }), 'Timer started');
    if (ok) {
      setSelection(emptySelection);
      setTouched(false);
    }
  };

  const startErrors = touched ? {
    project: !selection.projectId ? 'Select a project.' : undefined,
    task: selection.mode === 'existing' && !selection.taskId ? 'Select a task.' : undefined,
    description: selection.mode === 'new' && !selection.description.trim() ? 'Describe what you are working on.' : undefined
  } : undefined;

  return (
    <div className="space-y-4">
      {!online &&
      <Banner tone="warn" title="You’re offline">Timer actions won’t save until you reconnect. A running timer keeps counting from its saved start time.</Banner>
      }
      {inBreak && current &&
      <Banner tone="warn" title="Break time — timer auto-paused">
        It is {breakLabel(currentBreak)}. Your running timer was paused automatically. You can resume it after the break ends.
      </Banner>
      }
      {inBreak && !current &&
      <Banner tone="neutral" title="Break time">
        It is {breakLabel(currentBreak)}. Starting or resuming timers is not allowed during break hours.
      </Banner>
      }
      {current && restoredSessionIds.includes(current.id) && !restoredDismissed &&
      <Banner tone="info" title="Timer restored" action={<Button size="sm" variant="ghost" onClick={() => setRestoredDismissed(true)}>Dismiss</Button>}>
          We recovered your running session from its saved start time ({fmtTime(current.intervals[0]?.start)}). Elapsed time is calculated from saved timestamps.
        </Banner>
      }
      {stale.map((s) =>
      <Banner key={s.id} tone="warn" title={`Incomplete session from ${fmtDate(s.date, 'EEE, d MMM')}`}
      action={<Button size="sm" variant="secondary" icon={FlagIcon} loading={pending} onClick={() => exec(cmd.flagSession(s.id), 'Flagged for correction')}>Flag for correction</Button>}>
          “{task(s.taskId)?.title}” was never ended. Only time up to the last saved pause counts. Flag it so management can correct the record — original timestamps are kept.
        </Banner>
      )}
      {error &&
      <Banner tone="bad" title="Not saved" action={lastAction.current &&
      <Button size="sm" variant="secondary" icon={RotateCcwIcon} loading={pending} onClick={() => lastAction.current && exec(lastAction.current.command, lastAction.current.msg)}>Retry</Button>
      }>
          {error}
        </Banner>
      }

      {current ?
      <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={current.status} />
            <span className="text-xs text-ink-muted">{project(current.projectId)?.code} · {project(current.projectId)?.name}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-ink">{task(current.taskId)?.title}</p>
          {current.description && current.description !== task(current.taskId)?.title && <p className="mt-0.5 text-sm text-ink-muted">{current.description}</p>}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={cn('font-mono text-4xl font-semibold tracking-tight tnum sm:text-5xl', current.status === 'Paused' ? 'text-ink-muted' : 'text-ink')} aria-live="off">
                {fmtClock(sessionActiveMs(current, now))}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Started {fmtTime(current.intervals[0]?.start)} · Paused {fmtMin(Math.floor(sessionPausedMs(current, now) / MINUTE))} (not counted)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {current.status === 'Working' ?
            <Button size="lg" variant="secondary" icon={PauseIcon} loading={pending} disabled={inBreak} onClick={() => exec(cmd.pauseTimer(current.id), 'Timer paused')}>Pause</Button> :

            <Button size="lg" variant="secondary" icon={PlayIcon} loading={pending} disabled={inBreak} onClick={() => exec(cmd.resumeTimer(current.id), 'Timer resumed')}>Resume</Button>
            }
              <Button size="lg" icon={SquareIcon} onClick={() => {setError(null);setEndOpen(true);}} disabled={pending}>End task</Button>
            </div>
          </div>
          <button onClick={() => setSwitchOpen(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800" disabled={inBreak}>
            <ArrowLeftRightIcon className="h-4 w-4" /> Switch to another task
          </button>
          {otherPaused.length > 0 &&
        <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium text-ink-muted">Other paused sessions today</p>
              <ul className="space-y-2">
                {otherPaused.map((s) =>
            <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{task(s.taskId)?.title} <span className="text-ink-muted">· {fmtMin(Math.floor(sessionActiveMs(s, now) / MINUTE))}</span></span>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" loading={pending} disabled={inBreak} onClick={() => exec(cmd.resumeTimer(s.id), 'Timer resumed')}>Resume</Button>
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => exec(cmd.endTimer(s.id, ''), 'Session saved')}>End</Button>
                    </div>
                  </li>
            )}
              </ul>
            </div>
        }
        </div> :
      projects.length === 0 ?
      <Banner tone="neutral" title="No active projects">There is no project you can record time on yet. Ask your manager to add you to one.</Banner> :

      <div className="space-y-4">
          <TaskPicker emp={employee} value={selection} onChange={(patch) => setSelection((s) => ({ ...s, ...patch }))} errors={startErrors} />
          <Button size="lg" icon={PlayIcon} className="w-full sm:w-auto" loading={pending} onClick={start} disabled={!online || inBreak}>Start timer</Button>
        </div>
      }

      {current &&
      <EndSessionModal open={endOpen} onClose={() => setEndOpen(false)} session={current} pending={pending} error={error}
      onConfirm={async (notes) => {
        const mins = Math.floor(sessionActiveMs(current, Date.now()) / MINUTE);
        const ok = await exec(cmd.endTimer(current.id, notes));
        if (ok) {
          setEndOpen(false);
          toast.success(`Session saved · ${fmtMin(mins)}`, { description: task(current.taskId)?.title });
        }
      }} />

      }
      {current &&
      <SwitchTaskModal open={switchOpen} onClose={() => setSwitchOpen(false)} employee={employee} session={current} pending={pending} error={error}
      onConfirm={async (mode, input) => {
        const ok = await exec(cmd.switchTimer(current.id, mode, input), mode === 'pause' ? 'Previous task paused · new timer started' : 'Previous session saved · new timer started');
        if (ok) setSwitchOpen(false);
      }} />

      }
    </div>);

}

function EndSessionModal({ open, onClose, session, onConfirm, pending, error }: {open: boolean;onClose: () => void;session: WorkSession;onConfirm: (notes: string) => void;pending: boolean;error: string | null;}) {
  const { project, task } = useData();
  const now = useNow(1000);
  const [notes, setNotes] = useState('');
  useEffect(() => {if (open) setNotes('');}, [open]);
  return (
    <Modal open={open} onClose={onClose} title="End this session?" description="Review the session before saving."
    footer={<><Button variant="secondary" onClick={onClose} disabled={pending}>Keep working</Button><Button loading={pending} onClick={() => onConfirm(notes)}>End & save session</Button></>}>
      <dl className="grid grid-cols-2 gap-4">
        <KeyValue label="Project" value={project(session.projectId)?.name} />
        <KeyValue label="Task" value={task(session.taskId)?.title} />
        <KeyValue label="Started" value={fmtTime(session.intervals[0]?.start)} />
        <KeyValue label="Ends" value={fmtTime(new Date(now).toISOString())} />
        <KeyValue label="Active duration" value={<span className="tnum">{fmtMin(Math.floor(sessionActiveMs(session, now) / MINUTE))}</span>} />
        <KeyValue label="Paused (not counted)" value={<span className="tnum">{fmtMin(Math.floor(sessionPausedMs(session, now) / MINUTE))}</span>} />
      </dl>
      <div className="mt-4">
        <Field label="Work notes" hint="Optional — what did you get done?">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Ending a session doesn’t mark the task as complete. Update the task status from My Projects when it’s done.</p>
      {error && <Banner tone="bad" title="Not saved" className="mt-3">{error}</Banner>}
    </Modal>);

}

function SwitchTaskModal({ open, onClose, employee, session, onConfirm, pending, error }: {open: boolean;onClose: () => void;employee: Employee;session: WorkSession;onConfirm: (mode: 'pause' | 'end', input: {projectId: string;taskId: string;description: string;mode: TaskMode;kind: TaskKind;}) => void;pending: boolean;error: string | null;}) {
  const { task } = useData();
  const [mode, setMode] = useState<'pause' | 'end'>('pause');
  const [selection, setSelection] = useState<TaskSelection>(emptySelection);
  const [touched, setTouched] = useState(false);
  useEffect(() => {if (open) {setMode('pause');setSelection(emptySelection);setTouched(false);}}, [open]);
  const sameTask = selection.mode === 'existing' && selection.taskId === session.taskId;
  const ready = !!selection.projectId && (selection.mode === 'new' ? !!selection.description.trim() : !!selection.taskId && !sameTask);
  return (
    <Modal open={open} onClose={onClose} title="Switch task" size="md"
    footer={<><Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button><Button loading={pending} onClick={() => {setTouched(true);if (ready) onConfirm(mode, { ...selection, taskId: selection.mode === 'existing' ? selection.taskId : '' });}}>Switch & start timer</Button></>}>
      <p className="text-sm text-ink-2">Only one timer can run at a time. Your current session for <span className="font-medium text-ink">“{task(session.taskId)?.title}”</span> will be {mode === 'pause' ? 'paused' : 'ended'} first. All time recorded so far is kept.</p>
      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">What should happen to the current session?</legend>
        {(['pause', 'end'] as const).map((m) =>
        <label key={m} className={cn('cursor-pointer rounded-lg border p-3 transition-colors duration-150', mode === m ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong')}>
            <input type="radio" name="switch-mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
            <span className="block text-sm font-medium">{m === 'pause' ? 'Pause current session' : 'End current session'}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">{m === 'pause' ? 'Resume it later today.' : 'Save it as completed now.'}</span>
          </label>
        )}
      </fieldset>
      <div className="mt-4">
        <TaskPicker emp={employee} value={selection} onChange={(patch) => setSelection((s) => ({ ...s, ...patch }))}
        errors={touched ? {
          project: !selection.projectId ? 'Select a project.' : undefined,
          task: selection.mode === 'existing' && !selection.taskId ? 'Select a task.' : sameTask ? 'You’re already tracking this task.' : undefined,
          description: selection.mode === 'new' && !selection.description.trim() ? 'Describe what you are working on.' : undefined
        } : undefined} />
      </div>
      {error && <Banner tone="bad" title="Not saved" className="mt-3">{error}</Banner>}
    </Modal>);

}
