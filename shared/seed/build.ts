import { addDays, format, startOfMonth, subMonths } from 'date-fns';
import { employees } from './employees';
import { projects, tasks, teams } from './organisation';
import { salaryStructures } from './salaryStructures';
import { holidayTemplates, leaveTemplates, notificationTemplates, workNotes } from './templates';
import { defaultSettings } from './settings';
import type {
  AppState,
  AuditEntry,
  Employee,
  Holiday,
  HistoryItem,
  Leave,
  PayrollRun,
  Payslip,
  ShortfallReview,
  Task,
  Timesheet,
  WorkSession,
  Settings } from '../types';
import { approvedLeaveOn, computeDay, dayKey, holidayOn, indexSessions, isScheduled } from '../domain/compliance';
import { countLeaveDays } from '../domain/leave';
import { learningProject } from '../domain/learning';
import { buildPayslipData, linesFromStructure, monthLabel } from '../domain/payroll';
import type { PayrollRecord } from '../domain/payroll';
import { hashString, seededRandom } from '../domain/random';
import { MINUTE, eachDateKey, fromDateKey, monthDates, toDateKey, todayKey, weekDates, weekStartKey } from '../domain/time';

export const STATE_VERSION = 3;

const iso = (ms: number) => new Date(ms).toISOString();

function shiftToWorking(d: Date, emp: Employee, holidays: Holiday[], dir: 1 | -1, settings: Settings): Date {
  let x = d;
  let guard = 0;
  while ((!isScheduled(emp, toDateKey(x), settings) || holidayOn(toDateKey(x), holidays)) && guard < 14) {
    x = addDays(x, dir);
    guard++;
  }
  return x;
}

function genDay(
rng: () => number,
emp: Employee,
date: string,
totalMin: number,
pool: Task[],
cutoff: number | null,
tail?: 'Working' | 'Paused')
: WorkSession[] {
  const out: WorkSession[] = [];
  if (!pool.length) return out;
  const base = fromDateKey(date);
  base.setHours(9, 15 + Math.floor(rng() * 30), 0, 0);
  let t = base.getTime();
  let lastEnd = 0;
  const first = Math.round(totalMin * 0.45);
  const parts = totalMin >= 180 ? [first, totalMin - first] : totalMin > 0 ? [totalMin] : [];
  parts.forEach((mins, i) => {
    const task = pool[Math.floor(rng() * pool.length)];
    const withPause = mins > 90 && rng() < 0.55;
    const c1 = withPause ? Math.round(mins * (0.4 + rng() * 0.2)) : mins;
    const chunks = withPause ? [c1, mins - c1] : [mins];
    const intervals: {start: string;end?: string;}[] = [];
    chunks.forEach((c, ci) => {
      const s = t;
      let e = t + c * MINUTE;
      if (cutoff !== null && s >= cutoff) return;
      if (cutoff !== null && e > cutoff) e = cutoff;
      intervals.push({ start: iso(s), end: iso(e) });
      lastEnd = e;
      t = e + (ci < chunks.length - 1 ? (10 + Math.floor(rng() * 12)) * MINUTE : 0);
    });
    if (intervals.length)
    out.push({
      id: `s-${emp.id}-${date}-${i}`,
      employeeId: emp.id,
      projectId: task.projectId,
      taskId: task.id,
      description: task.title,
      notes: workNotes[Math.floor(rng() * workNotes.length)],
      date,
      intervals,
      status: 'Completed'
    });
    t += (40 + Math.floor(rng() * 15)) * MINUTE;
  });
  if (tail && cutoff !== null) {
    let start = Math.min(t, cutoff - 25 * MINUTE);
    if (start < lastEnd) start = lastEnd + MINUTE;
    if (start < cutoff - 2 * MINUTE) {
      const task = pool[0];
      const intervals =
      tail === 'Working' ?
      [{ start: iso(start) }] :
      [{ start: iso(start), end: iso(Math.min(start + 30 * MINUTE, cutoff - MINUTE)) }];
      out.push({
        id: `s-${emp.id}-${date}-live`,
        employeeId: emp.id,
        projectId: task.projectId,
        taskId: task.id,
        description: task.title,
        date,
        intervals,
        status: tail
      });
    }
  }
  return out;
}

const todayPlan: Record<string, {total: number;tail?: 'Working' | 'Paused';}> = {
  e1: { total: 330 },
  e2: { total: 300, tail: 'Working' },
  e3: { total: 200, tail: 'Paused' },
  e4: { total: 150 },
  e5: { total: 495 },
  e6: { total: 240, tail: 'Working' }
};

/** Published holiday calendar for the previous and current calendar year. */
export function buildHolidays(now: number = Date.now()): Holiday[] {
  const year = fromDateKey(todayKey(now)).getFullYear();
  return [year - 1, year].flatMap((y) =>
    holidayTemplates.map((t, i) => ({
      id: `h-${y}-${i}`,
      name: t.name,
      date: `${y}-${t.monthDay}`,
      type: t.type,
      description: t.description,
      status: 'Published' as const
    }))
  );
}

/**
 * The clean starting point for a fresh installation: master data only.
 *
 * There are no work sessions, leave requests, timesheets, payroll runs, payslips,
 * notifications or audit entries — every one of those is produced by real usage.
 */
export function buildMasterState(now: number = Date.now()): AppState {
  return {
    version: STATE_VERSION,
    employees: employees.map((e) => ({ ...e })),
    teams: teams.map((t) => ({ ...t })),
    projects: [...projects.map((p) => ({ ...p })), learningProject(now)],
    tasks: tasks.map((t) => ({ ...t })),
    sessions: [],
    timesheets: [],
    reviews: {},
    leaves: [],
    holidays: buildHolidays(now),
    salary: salaryStructures.map((s) => ({ ...s, earnings: { ...s.earnings }, deductions: { ...s.deductions } })),
    payrollRuns: [],
    payslips: [],
    notifications: [],
    audit: [],
    lateLogins: [],
    lateLoginHistory: [],
    settings: { ...defaultSettings }
  };
}

/**
 * The blank starting point for a production install: no sample people or work at all.
 *
 * Only settings and the system learning project are written, because the app needs a
 * configuration to run and every employee needs somewhere to log learning time.
 * Everything else — employees, teams, projects, tasks, holidays, salary structures and
 * all activity — is created by the operator through the UI.
 */
export function buildEmptyState(now: number = Date.now()): AppState {
  return {
    version: STATE_VERSION,
    employees: [],
    teams: [],
    projects: [learningProject(now)],
    tasks: [],
    sessions: [],
    timesheets: [],
    reviews: {},
    leaves: [],
    holidays: [],
    salary: [],
    payrollRuns: [],
    payslips: [],
    notifications: [],
    audit: [],
    lateLogins: [],
    lateLoginHistory: [],
    settings: { ...defaultSettings }
  };
}

export function buildInitialState(now: number = Date.now()): AppState {
  const settings = { ...defaultSettings };
  const today = todayKey(now);
  const todayDate = fromDateKey(today);
  const year = todayDate.getFullYear();
  const prevMonthStart = startOfMonth(subMonths(todayDate, 1));
  const prevMonth = format(prevMonthStart, 'yyyy-MM');

  const holidays: Holiday[] = buildHolidays(now);

  const leaves: Leave[] = leaveTemplates.map((t, i) => {
    const emp = employees.find((e) => e.id === t.employeeId) as Employee;
    const raw = t.inPreviousMonth ? addDays(prevMonthStart, 10) : addDays(todayDate, t.startOffset);
    const start = shiftToWorking(raw, emp, holidays, t.startOffset < 0 ? -1 : 1, settings);
    let end = start;
    for (let n = 1; n < t.length; n++) end = shiftToWorking(addDays(end, 1), emp, holidays, 1, settings);
    const submitted = t.inPreviousMonth ? new Date(start) : addDays(todayDate, t.submittedOffset);
    submitted.setHours(10, 5, 0, 0);
    const submittedAt = Math.min(submitted.getTime(), now - 30 * MINUTE);
    const decided = t.status === 'Approved' || t.status === 'Rejected';
    const decidedAt = Math.min(submittedAt + 20 * 60 * MINUTE, now - 15 * MINUTE);
    const startKey = toDateKey(start);
    return {
      id: `l-${i + 1}`,
      employeeId: t.employeeId,
      type: t.type,
      startDate: startKey,
      endDate: toDateKey(end),
      days: countLeaveDays(emp, startKey, toDateKey(end), holidays, settings),
      reason: t.reason,
      status: t.status,
      submittedAt: iso(submittedAt),
      retrospective: t.type === 'Emergency' && startKey < todayKey(submittedAt),
      decidedBy: decided ? 'Neha Kapoor' : undefined,
      decidedAt: decided ? iso(decidedAt) : undefined,
      rejectionReason: t.rejectionReason
    };
  });

  const rng = seededRandom(hashString(`neptune-${today}`));
  const sessions: WorkSession[] = [];
  const yesterday = toDateKey(addDays(todayDate, -1));
  const inactiveCutoff = toDateKey(addDays(prevMonthStart, 14));
  for (const emp of employees) {
    const pool = tasks.filter((t) => t.assigneeId === emp.id);
    const livePool = pool.filter((t) => t.status === 'In Progress' || t.status === 'To Do');
    for (const d of eachDateKey(toDateKey(prevMonthStart), yesterday)) {
      if (!isScheduled(emp, d, settings) || holidayOn(d, holidays) || approvedLeaveOn(emp.id, d, leaves)) continue;
      if (emp.status === 'Inactive' && d > inactiveCutoff) continue;
      const r = rng();
      const total = r < 0.03 ? 0 : r < 0.2 ? 360 + Math.floor(rng() * 110) : 480 + Math.floor(rng() * 45);
      if (total === 0) continue;
      sessions.push(...genDay(rng, emp, d, total, pool, null));
    }
    const plan = todayPlan[emp.id];
    if (plan && isScheduled(emp, today, settings) && !holidayOn(today, holidays) && !approvedLeaveOn(emp.id, today, leaves)) {
      sessions.push(...genDay(rng, emp, today, plan.total, livePool.length ? livePool : pool, now - 2 * MINUTE, plan.tail));
    }
  }

  // One interrupted session for Karthik, about a week ago, to demonstrate incomplete-session handling.
  const karthikPast = sessions.filter((s) => s.employeeId === 'e4' && s.date < today).sort((a, b) => a.date < b.date ? 1 : -1);
  const target = karthikPast.find((s, idx) => idx >= 8 && s.id.endsWith('-1'));
  if (target) {
    target.status = 'Interrupted';
    const last = target.intervals[target.intervals.length - 1];
    delete last.end;
  }

  // Reviews: last month mostly resolved, three left pending.
  //
  // The population is the same one the payroll uses for that month: everyone who is
  // active now, plus anyone who was active during the month and recorded time in it.
  // Leaving an employee's shortfalls unreviewed would block the payroll run forever.
  const reviews: Record<string, ShortfallReview> = {};
  const ctx = { sessionsByKey: indexSessions(sessions), holidays, leaves, reviews, settings };
  const prevMonthFirst = monthDates(prevMonth)[0];
  const payrollPopulation = employees.filter(
    (e) =>
    e.status === 'Active' ||
    (e.joiningDate <= prevMonthFirst && sessions.some((s) => s.employeeId === e.id && s.date.startsWith(prevMonth)))
  );
  const prevShortfalls = payrollPopulation.
  flatMap((e) => monthDates(prevMonth).map((d) => computeDay(ctx, e, d, now))).
  filter((d) => d.isShortfall).
  sort((a, b) => a.date < b.date ? -1 : 1);
  const pendingCount = 3;
  prevShortfalls.slice(0, Math.max(0, prevShortfalls.length - pendingCount)).forEach((d, i) => {
    const exception = i % 3 === 0;
    const reviewedAt = iso(fromDateKey(d.date).getTime() + 2 * 24 * 60 * MINUTE);
    reviews[dayKey(d.employeeId, d.date)] = {
      id: dayKey(d.employeeId, d.date),
      employeeId: d.employeeId,
      date: d.date,
      status: exception ? 'Approved Exception' : 'Waived',
      category: exception ? 'Approved exception' : 'Management-approved waiver',
      reason: exception ? 'Client workshop outside the tracker — approved by manager.' : 'First occurrence this month; waived per manager review.',
      proposedDeduction: null,
      finalDeduction: 0,
      reviewedBy: 'Neha Kapoor',
      reviewedAt,
      history: [{ at: reviewedAt, by: 'Neha Kapoor', from: 'Pending Review', to: exception ? 'Approved Exception' : 'Waived', reason: 'Sample historical review' }]
    };
  });

  // Timesheets
  const timesheets: Timesheet[] = [];
  const currentWeek = weekStartKey(today);
  const lastWeek = toDateKey(addDays(fromDateKey(currentWeek), -7));
  const lastWeekStatus: Record<string, Timesheet['status']> = {
    e1: 'Submitted', e2: 'Approved', e3: 'Submitted', e4: 'Changes Requested', e5: 'Submitted', e6: 'Under Review', e7: 'Submitted'
  };
  let w = weekStartKey(toDateKey(prevMonthStart));
  while (w < currentWeek) {
    for (const emp of employees.filter((e) => e.status === 'Active')) {
      const status = w === lastWeek ? lastWeekStatus[emp.id] ?? 'Submitted' : 'Approved';
      const submitted = fromDateKey(weekDates(w)[4]).getTime() + 18 * 60 * MINUTE;
      const history: HistoryItem[] = [{ action: 'Submitted', by: emp.name, at: iso(Math.min(submitted, now - 60 * MINUTE)) }];
      if (status === 'Approved') history.push({ action: 'Approved', by: 'Arjun Mehta', at: iso(Math.min(submitted + 2 * 24 * 60 * MINUTE, now - 30 * MINUTE)) });
      if (status === 'Changes Requested')
      history.push({ action: 'Changes Requested', by: 'Arjun Mehta', at: iso(now - 120 * MINUTE), note: 'One session has no end time. Please request a correction for the interrupted session.' });
      timesheets.push({ id: `ts-${emp.id}-${w}`, employeeId: emp.id, weekStart: w, status, submittedAt: history[0].at, history });
    }
    w = toDateKey(addDays(fromDateKey(w), 7));
  }

  // Released payroll for the two months before last month.
  const payrollRuns: PayrollRun[] = [];
  const payslips: Payslip[] = [];
  for (const offset of [3, 2]) {
    const m = format(startOfMonth(subMonths(todayDate, offset)), 'yyyy-MM');
    const next = startOfMonth(subMonths(todayDate, offset - 1));
    const credited = toDateKey(addDays(next, 0));
    const released = iso(addDays(next, 1).getTime() + 11 * 60 * MINUTE);
    payrollRuns.push({
      month: m,
      status: 'Released',
      calculatedAt: iso(addDays(next, -3).getTime() + 10 * 60 * MINUTE),
      approvedBy: 'Neha Kapoor',
      approvedAt: iso(addDays(next, -2).getTime() + 15 * 60 * MINUTE),
      creditDate: credited,
      creditReference: `SAMPLE-${m.replace('-', '')}`,
      creditedBy: 'Neha Kapoor',
      generatedAt: iso(addDays(next, 1).getTime() + 9 * 60 * MINUTE),
      releasedAt: released,
      history: [
      { action: 'Calculated', by: 'Neha Kapoor', at: iso(addDays(next, -3).getTime() + 10 * 60 * MINUTE) },
      { action: 'Approved', by: 'Neha Kapoor', at: iso(addDays(next, -2).getTime() + 15 * 60 * MINUTE) },
      { action: 'Salary credit confirmed', by: 'Neha Kapoor', at: iso(next.getTime() + 17 * 60 * MINUTE), note: `Credited on ${credited}` },
      { action: 'Payslips released', by: 'Neha Kapoor', at: released }]

    });
    for (const emp of employees) {
      const base = salaryStructures.find((s) => s.employeeId === emp.id);
      if (!base) continue;
      const ss = base.accountNumber ? base : { ...base, bankName: 'Sample Bank', accountNumber: '000077779999' };
      const lines = linesFromStructure(ss, 0, 0);
      const rec: PayrollRecord = {
        employee: emp, structure: ss, month: m, salaryDays: monthDates(m).length, lopDays: 0, lopAmount: 0, scheduledDays: 0,
        earnings: lines.earnings, gross: lines.gross, employerContribution: ss.employerContribution,
        deductions: lines.deductions, totalDeduction: lines.totalDeduction, takeHome: lines.gross - lines.totalDeduction,
        shortfall: { days: 0, totalMin: 0, pending: 0, approvedDeduction: 0, resolvedWithoutDeduction: 0 },
        leave: { casual: 0, emergency: 0 }, issues: [], ready: true
      };
      payslips.push({
        id: `ps-${emp.id}-${m}-1`,
        employeeId: emp.id,
        month: m,
        version: 1,
        status: 'Released',
        generatedAt: iso(addDays(next, 1).getTime() + 9 * 60 * MINUTE),
        releasedAt: released,
        data: buildPayslipData(rec, settings)
      });
    }
  }

  const notifications = notificationTemplates.map((n, i) => ({
    id: `n-${i + 1}`,
    audience: n.audience,
    title: n.title,
    body: n.body,
    link: n.link,
    createdAt: iso(now - n.minutesAgo * MINUTE),
    read: !!n.read,
    tone: n.tone
  }));

  const lastReleased = payrollRuns[payrollRuns.length - 1];
  const audit: AuditEntry[] = [
  { id: 'a-1', actor: 'Neha Kapoor', action: 'Holiday calendar published', entity: 'Holiday calendar', entityId: String(year), at: iso(fromDateKey(`${year}-01-02`).getTime() + 10 * 60 * MINUTE), reason: 'Annual calendar verified against official notification.' },
  { id: 'a-2', actor: 'Neha Kapoor', action: 'Payslips released', entity: 'Payroll', entityId: lastReleased.month, at: lastReleased.releasedAt as string, next: `${monthLabel(lastReleased.month)} · Released` },
  { id: 'a-3', actor: 'Neha Kapoor', action: 'Leave approved', entity: 'Leave', entityId: 'l-1', at: leaves[0].decidedAt as string, previous: 'Pending Approval', next: 'Approved' },
  { id: 'a-4', actor: 'Neha Kapoor', action: 'Leave rejected', entity: 'Leave', entityId: 'l-4', at: leaves[3].decidedAt as string, previous: 'Pending Approval', next: 'Rejected', reason: leaves[3].rejectionReason },
  { id: 'a-5', actor: 'Arjun Mehta', action: 'Employee deactivated', entity: 'Employee', entityId: 'e8', at: iso(addDays(prevMonthStart, 15).getTime() + 12 * 60 * MINUTE), previous: 'Active', next: 'Inactive', reason: 'Resigned — last working day completed. Records preserved.' }].
  sort((a, b) => a.at < b.at ? 1 : -1);

  return {
    version: STATE_VERSION,
    employees: employees.map((e) => ({ ...e })),
    teams: teams.map((t) => ({ ...t })),
    projects: [...projects.map((p) => ({ ...p })), learningProject(now)],
    tasks: tasks.map((t) => ({ ...t })),
    sessions,
    timesheets,
    reviews,
    leaves,
    holidays,
    salary: salaryStructures.map((s) => ({ ...s, earnings: { ...s.earnings }, deductions: { ...s.deductions } })),
    payrollRuns,
    payslips,
    notifications,
    audit,
    lateLogins: [],
    lateLoginHistory: [],
    settings
  };
}