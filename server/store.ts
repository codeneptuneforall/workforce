import mongoose from 'mongoose';
import { config } from './config';
import type { AppState, AppNotification, AuditEntry, Employee, Holiday, Leave, PayrollRun, Payslip, Project, SalaryStructure, Settings, ShortfallReview, Task, Team, Timesheet, WfhHistory, WorkSession } from '../shared/types';
import { LEARNING_PROJECT_ID, learningProject } from '../shared/domain/learning';
import { pauseTimer } from '../shared/domain/timerMutations';
import { isBreakTime } from '../shared/domain/workday';
import {
  AuditModel,
  EmployeeModel,
  HolidayModel,
  LateLoginModel,
  LeaveModel,
  NotificationModel,
  PayslipModel,
  PayrollRunModel,
  ProjectModel,
  ReviewModel,
  SalaryModel,
  SessionModel,
  SettingsModel,
  TaskModel,
  UserModel,
  TeamModel,
  TimesheetModel,
  WfhHistoryModel
} from './models';

/**
 * The API keeps one in-memory working copy of the aggregate and writes every accepted
 * change straight through to MongoDB. The database stays the source of truth: the copy is
 * rebuilt from the collections on boot, and a diff of only the touched documents is
 * persisted per mutation.
 */

let cache: AppState | null = null;
/** When `cache` was last rebuilt from MongoDB. Mutations do not reset it. */
let loadedAt = 0;
/** A reload in progress, shared by every caller that needs one. */
let loading: Promise<AppState> | null = null;
/** Bumped by `invalidateCache()` so a reload that started earlier is not cached as fresh. */
let generation = 0;

const strip = <T>(doc: any): T => {
  const { _id, __v, ...rest } = doc ?? {};
  return rest as T;
};

/**
 * The stored shape of a domain record.
 *
 * The domain id lives in `_id`, so it is never written twice: the `id` field is dropped
 * on the way in and restored on the way out.
 */
export function toDocument(id: string, doc: Record<string, any>): Record<string, unknown> {
  const { id: _domainId, ...rest } = doc;
  return { ...rest, _id: id };
}

/** Restores the domain id of a stored record. */
const withId = <T>(doc: any): T => ({ ...strip<T>(doc), id: doc?._id } as T);

export async function loadState(): Promise<AppState> {
  const [
    employees,
    teams,
    projects,
    tasks,
    sessions,
    timesheets,
    reviews,
    leaves,
    holidays,
    salary,
    payrollRuns,
    payslips,
    notifications,
    audit,
    lateUsers,
    lateHistory,
    wfhHistory,
    settingsDoc
  ] = await Promise.all([
    EmployeeModel.find({}).lean(),
    TeamModel.find({}).lean(),
    ProjectModel.find({}).lean(),
    TaskModel.find({}).lean(),
    SessionModel.find({}).lean(),
    TimesheetModel.find({}).lean(),
    ReviewModel.find({}).lean(),
    LeaveModel.find({}).lean(),
    HolidayModel.find({}).lean(),
    SalaryModel.find({}).lean(),
    PayrollRunModel.find({}).lean(),
    PayslipModel.find({}).lean(),
    NotificationModel.find({}).lean(),
    AuditModel.find({}).sort({ at: -1 }).limit(1000).lean(),
    UserModel.find({ lateLoginAt: { $exists: true } }).lean(),
    LateLoginModel.find({}).sort({ at: -1 }).limit(500).lean(),
    WfhHistoryModel.find({}).sort({ declaredAt: -1 }).lean(),
    SettingsModel.findOne({ _id: 'app' }).lean()
  ]);

  const state: AppState = {
    version: settingsDoc?.version ?? 1,
    employees: employees.map((d) => withId<Employee>(d)),
    teams: teams.map((d) => withId<Team>(d)),
    projects: projects.map((d) => withId<Project>(d)),
    tasks: tasks.map((d) => withId<Task>(d)),
    sessions: sessions.map((d) => withId<WorkSession>(d)),
    timesheets: timesheets.map((d) => withId<Timesheet>(d)),
    reviews: Object.fromEntries(reviews.map((d) => [d._id as string, withId<ShortfallReview>(d)])),
    leaves: leaves.map((d) => withId<Leave>(d)),
    holidays: holidays.map((d) => withId<Holiday>(d)),
    salary: salary.map((d) => strip<SalaryStructure>(d)),
    payrollRuns: payrollRuns.map((d) => strip<PayrollRun>(d)),
    payslips: payslips.map((d) => withId<Payslip>(d)),
    notifications: notifications.map((d) => withId<AppNotification>(d)),
    audit: audit.map((d) => withId<AuditEntry>(d)),
    lateLogins: lateUsers.map((u: any) => ({ employeeId: u.employeeId ?? u._id, name: u.name, reason: u.lateLoginReason ?? '', at: u.lateLoginAt ? new Date(u.lateLoginAt).toISOString() : '' })),
    lateLoginHistory: lateHistory.map((d: any) => ({ id: d._id, employeeId: d.employeeId, name: d.name, reason: d.reason, at: new Date(d.at).toISOString() })),
    wfhHistory: wfhHistory.map((d: any) => withId<WfhHistory>(d)),
    settings: (settingsDoc?.settings ?? {}) as Settings
  };
  return state;
}

export function getCachedState(): AppState | null {
  return cache;
}

/**
 * The current state, served from memory.
 *
 * The cache is rebuilt from MongoDB when it is empty (first request, or after
 * `invalidateCache()`) or older than `config.stateCacheTtlMs`. Concurrent callers share
 * one rebuild, so a burst of polls never triggers more than one full read.
 */
export async function ensureLoaded(): Promise<AppState> {
  let state = cache;
  if (!state || Date.now() - loadedAt > config.stateCacheTtlMs) {
    state = await reload();
  }
  // Auto-pause any running sessions during break hours (IST).
  const paused = await autoPauseDuringBreaks(state);
  if (paused !== state && cache === state) cache = paused;
  return paused;
}

function reload(): Promise<AppState> {
  if (!loading) {
    const startedFor = generation;
    const started = Date.now();
    const pending = (async () => {
      const fresh = await ensureLearningProject(await loadState());
      if (startedFor === generation) {
        cache = fresh;
        loadedAt = Date.now();
      }
      console.log(`[store] state reloaded in ${Date.now() - started}ms`);
      return fresh;
    })().finally(() => {
      if (loading === pending) loading = null;
    });
    loading = pending;
  }
  return loading;
}

/** Pauses every Working session when the current IST time falls inside a break window.
 *  Changes are persisted to MongoDB so the paused state survives server restarts. */
async function autoPauseDuringBreaks(state: AppState): Promise<AppState> {
  if (!isBreakTime(Date.now())) return state;
  const working = state.sessions.filter((s) => s.status === 'Working');
  if (!working.length) return state;
  const now = Date.now();
  let next: AppState = state;
  for (const session of working) {
    const result = pauseTimer(next, session.id, now);
    if ('error' in result) continue;
    next = result;
  }
  await persistDiff(state, next);
  return next;
}

/**
 * The system learning project always exists.
 *
 * It is created on the fly for installations that were set up before learning tasks
 * existed, so every employee always has a place to log learning time — even when no
 * work task is assigned to them.
 */
async function ensureLearningProject(state: AppState): Promise<AppState> {
  if (state.projects.some((p) => p.id === LEARNING_PROJECT_ID)) return state;
  const project = learningProject();
  await ProjectModel.updateOne({ _id: project.id }, { $set: toDocument(project.id, project) }, { upsert: true });
  return { ...state, projects: [...state.projects, project] };
}

/**
 * Replace the cached state after a mutation has been persisted.
 *
 * Skipped when the cache was invalidated while the mutation ran: MongoDB already holds
 * the mutation, and the next read rebuilds from it. `loadedAt` is left alone so the TTL
 * still bounds how long the cache can drift from the database.
 */
export function setCachedState(state: AppState): void {
  if (cache === null) return;
  cache = state;
}

/** Drop the in-memory cache so the next state read re-fetches from MongoDB. */
export function invalidateCache(): void {
  generation++;
  cache = null;
  loading = null;
}

/** Writes the difference between two snapshots to MongoDB. */
export async function persistDiff(prev: AppState, next: AppState): Promise<void> {
  await Promise.all([
    syncCollection(EmployeeModel, prev.employees, next.employees, (e) => e.id),
    syncCollection(TeamModel, prev.teams, next.teams, (t) => t.id),
    syncCollection(ProjectModel, prev.projects, next.projects, (p) => p.id),
    syncCollection(TaskModel, prev.tasks, next.tasks, (t) => t.id),
    syncCollection(SessionModel, prev.sessions, next.sessions, (s) => s.id),
    syncCollection(TimesheetModel, prev.timesheets, next.timesheets, (t) => t.id),
    syncCollection(ReviewModel, Object.values(prev.reviews), Object.values(next.reviews), (r) => r.id),
    syncCollection(LeaveModel, prev.leaves, next.leaves, (l) => l.id),
    syncCollection(HolidayModel, prev.holidays, next.holidays, (h) => h.id),
    syncCollection(SalaryModel, prev.salary, next.salary, (s) => s.employeeId),
    syncCollection(PayrollRunModel, prev.payrollRuns, next.payrollRuns, (r) => r.month),
    syncCollection(PayslipModel, prev.payslips, next.payslips, (p) => p.id),
    syncCollection(NotificationModel, prev.notifications, next.notifications, (n) => n.id),
    syncCollection(AuditModel, prev.audit, next.audit, (a) => a.id),
    syncCollection(WfhHistoryModel, prev.wfhHistory, next.wfhHistory, (w) => w.id),
    syncSettings(prev.settings, next.settings, next.version)
  ]);
}

async function syncCollection<T extends Record<string, any>>(
  model: mongoose.Model<any>,
  prev: T[],
  next: T[],
  key: (item: T) => string
): Promise<void> {
  const before = new Map(prev.map((item) => [key(item), item]));
  const after = new Map(next.map((item) => [key(item), item]));
  const ops: any[] = [];

  for (const [id, doc] of after) {
    const previous = before.get(id);
    if (!previous) {
      ops.push({ updateOne: { filter: { _id: id }, update: { $set: toDocument(id, doc) }, upsert: true } });
    } else if (JSON.stringify(previous) !== JSON.stringify(doc)) {
      ops.push({ updateOne: { filter: { _id: id }, update: { $set: toDocument(id, doc) }, upsert: false } });
    }
  }
  for (const id of before.keys()) {
    if (!after.has(id)) ops.push({ deleteOne: { filter: { _id: id } } });
  }
  if (ops.length) await model.bulkWrite(ops, { ordered: false });
}

async function syncSettings(prev: Settings, next: Settings, version: number): Promise<void> {
  if (JSON.stringify(prev) === JSON.stringify(next)) return;
  await SettingsModel.updateOne({ _id: 'app' }, { $set: { settings: next, version } }, { upsert: true });
}

/** Removes every document from the domain collections (used by `npm run db:reset`). */
export async function clearAll(): Promise<void> {
  await Promise.all([
    EmployeeModel.deleteMany({}),
    TeamModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TaskModel.deleteMany({}),
    SessionModel.deleteMany({}),
    TimesheetModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    LeaveModel.deleteMany({}),
    HolidayModel.deleteMany({}),
    SalaryModel.deleteMany({}),
    PayrollRunModel.deleteMany({}),
    PayslipModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    AuditModel.deleteMany({}),
    WfhHistoryModel.deleteMany({}),
    SettingsModel.deleteMany({})
  ]);
  invalidateCache();
}
