import { addDays } from 'date-fns';
import type { AppState, Employee, Project, Task, TaskKind, WorkSession } from '../types';
import { canTrackProject, canWorkOnTask } from './access';
import { indexSessions, computeDay } from './compliance';
import { uid } from './random';
import { fail, isoNow, withAudit, withNotification } from './stateHelpers';
import type { Mutation } from './stateHelpers';
import { breakAt, breakLabel, isBreakTime } from './workday';
import { fmtDate, fromDateKey, toDateKey, todayKey } from './time';

export interface StartInput {
  projectId: string;
  taskId: string;
  description: string;
  /** `existing` uses a task that already exists; `new` creates one on the spot. */
  mode?: 'existing' | 'new';
  /** The kind of task to create when `mode` is `new`. */
  kind?: TaskKind;
}

const TASK_TITLE_LIMIT = 120;

function replaceSession(s: AppState, session: WorkSession): AppState {
  return { ...s, sessions: s.sessions.map((x) => x.id === session.id ? session : x) };
}

/**
 * Creates the task for a "new task" timer session.
 *
 * A work task is assigned to the employee who created it. A learning task is left
 * unassigned on purpose: it stays visible and pickable by every employee.
 */
function createSelfTask(
  s: AppState,
  employee: Employee,
  project: Project,
  description: string,
  kind: TaskKind,
  now: number
): {state: AppState; task: Task;} | {error: string;} {
  const title = description.trim();
  if (!title) return { error: 'Describe what you are working on — it becomes the task title.' };
  const today = todayKey(now);
  const task: Task = {
    id: uid('k'),
    title: title.length > TASK_TITLE_LIMIT ? `${title.slice(0, TASK_TITLE_LIMIT - 1)}…` : title,
    description: title,
    projectId: project.id,
    assigneeId: kind === 'Learning' ? undefined : employee.id,
    teamId: kind === 'Learning' ? undefined : employee.teamId,
    startDate: today,
    dueDate: toDateKey(addDays(fromDateKey(today), 7)),
    status: 'In Progress',
    kind
  };
  const state = withAudit({ ...s, tasks: [...s.tasks, task] }, now, {
    actor: employee.name,
    action: kind === 'Learning' ? 'Learning task created' : 'Task created',
    entity: 'Task',
    entityId: task.title,
    next:
      kind === 'Learning' ?
        `${project.code} · shared with every employee` :
        `${project.code} · assigned to ${employee.name}`
  });
  return { state, task };
}

export function startTimer(s: AppState, employeeId: string, input: StartInput, now: number): Mutation {
  const employee = s.employees.find((e) => e.id === employeeId);
  if (!employee) return fail('Your employee record could not be found.');
  const b = breakAt(now);
  if (b) {
    return fail(`It is ${breakLabel(b)} — timers cannot be started during break hours.`);
  }
  const project = s.projects.find((p) => p.id === input.projectId);
  if (!project) return fail('Select a project before starting the timer.');
  if (!canTrackProject(project))
  return fail(`“${project.name}” is archived, so no new time can be recorded on it.`);
  const working = s.sessions.find((x) => x.employeeId === employeeId && x.status === 'Working');
  if (working && !s.settings.allowOverlap) {
    const t = s.tasks.find((k) => k.id === working.taskId);
    return fail(`You already have a running timer for “${t?.title ?? 'another task'}”. Pause or end it first — timers can’t overlap.`);
  }

  const mode = input.mode === 'new' ? 'new' : 'existing';
  let state = s;
  let task = s.tasks.find((k) => k.id === input.taskId);

  if (mode === 'new') {
    const kind: TaskKind = input.kind === 'Learning' ? 'Learning' : 'Work';
    const created = createSelfTask(s, employee, project, input.description ?? '', kind, now);
    if ('error' in created) return created;
    state = created.state;
    task = created.task;
  } else {
    if (s.settings.requireTask && !task) return fail('Select a task before starting the timer.');
    if (task) {
      if (task.projectId !== project.id) return fail('That task belongs to a different project.');
      if (!canWorkOnTask(task, employee)) return fail('This task is not assigned to you.');
    }
  }

  const session: WorkSession = {
    id: uid('s'),
    employeeId,
    projectId: project.id,
    taskId: task?.id ?? '',
    description: (input.description ?? '').trim() || task?.title || 'Work session',
    date: todayKey(now),
    intervals: [{ start: isoNow(now) }],
    status: 'Working'
  };
  return { ...state, sessions: [...state.sessions, session] };
}

export function pauseTimer(s: AppState, sessionId: string, now: number): Mutation {
  const session = s.sessions.find((x) => x.id === sessionId);
  if (!session || session.status !== 'Working') return fail('This timer is not running any more. Refresh to see its latest state.');
  const intervals = session.intervals.map((iv, i) =>
  i === session.intervals.length - 1 && !iv.end ? { ...iv, end: isoNow(now) } : iv
  );
  return replaceSession(s, { ...session, intervals, status: 'Paused' });
}

export function resumeTimer(s: AppState, sessionId: string, now: number): Mutation {
  const session = s.sessions.find((x) => x.id === sessionId);
  if (!session || session.status !== 'Paused') return fail('This session can’t be resumed.');
  const b = breakAt(now);
  if (b) {
    return fail(`It is ${breakLabel(b)} — timers cannot be resumed during break hours.`);
  }
  if (session.date !== todayKey(now))
  return fail(`This session started on ${fmtDate(session.date)}. End it or flag it for correction, then start a new session today.`);
  const other = s.sessions.find((x) => x.employeeId === session.employeeId && x.status === 'Working');
  if (other && !s.settings.allowOverlap) return fail('Another timer is running. Pause or end it before resuming this one.');
  return replaceSession(s, { ...session, intervals: [...session.intervals, { start: isoNow(now) }], status: 'Working' });
}

export function endTimer(s: AppState, sessionId: string, notes: string, now: number): Mutation {
  const session = s.sessions.find((x) => x.id === sessionId);
  if (!session || session.status !== 'Working' && session.status !== 'Paused') return fail('This session has already ended.');
  const intervals = session.intervals.map((iv, i) =>
  i === session.intervals.length - 1 && !iv.end ? { ...iv, end: isoNow(now) } : iv
  );
  let next = replaceSession(s, { ...session, intervals, status: 'Completed', notes: notes.trim() || undefined });
  const emp = next.employees.find((e) => e.id === session.employeeId);
  if (emp) {
    const before = computeDay(
      { sessionsByKey: indexSessions(s.sessions), holidays: s.holidays, leaves: s.leaves, reviews: s.reviews, settings: s.settings },
      emp, session.date, now
    );
    const after = computeDay(
      { sessionsByKey: indexSessions(next.sessions), holidays: next.holidays, leaves: next.leaves, reviews: next.reviews, settings: next.settings },
      emp, session.date, now
    );
    if (after.expectedMin > 0 && after.completedMin >= after.expectedMin && before.status !== 'Target Completed') {
      next = withNotification(next, now, {
        audience: emp.id,
        title: 'Daily target completed',
        body: 'You have completed your daily working-hour target. Nice work.',
        link: '/employee/dashboard',
        tone: 'ok'
      });
    }
  }
  return next;
}

export function flagSession(s: AppState, sessionId: string, actor: string, now: number): Mutation {
  const session = s.sessions.find((x) => x.id === sessionId);
  if (!session) return fail('Session not found.');
  const emp = s.employees.find((e) => e.id === session.employeeId);
  let next = replaceSession(s, { ...session, status: 'Interrupted' });
  next = withNotification(next, now, {
    audience: 'management',
    title: 'Missing time record',
    body: `${emp?.name ?? 'An employee'} flagged an incomplete session on ${fmtDate(session.date)} for correction.`,
    link: '/management/attendance/shortfalls',
    tone: 'warn'
  });
  return withAudit(next, now, {
    actor,
    action: 'Session flagged for correction',
    entity: 'Work session',
    entityId: session.id,
    previous: session.status,
    next: 'Interrupted',
    reason: 'Incomplete session — original timestamps preserved.'
  });
}