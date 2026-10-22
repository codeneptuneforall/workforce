import type { AppState, Employee, Holiday, Leave, Settings, ShortfallReview, WorkSession } from '../types';
import { MINUTE, fromDateKey, todayKey, unionMs } from './time';

export type DayStatus =
'Not Started' |
'In Progress' |
'Target Completed' |
'Below Target at Day End' |
'Approved Exception' |
'Needs Review' |
'Approved Leave' |
'Holiday' |
'Non-working Day' |
'Not Recorded';

export type AttendanceStatus =
'Present' |
'Below Target' |
'Target Completed' |
'Approved Leave' |
'Holiday' |
'Absent' |
'Not Recorded' |
'Needs Review' |
'Non-working Day' |
'Approved Exception';

export interface ComplianceCtx {
  sessionsByKey: Map<string, WorkSession[]>;
  holidays: Holiday[];
  leaves: Leave[];
  reviews: Record<string, ShortfallReview>;
  settings: Settings;
}

export interface DayCompliance {
  employeeId: string;
  date: string;
  scheduled: boolean;
  holiday?: Holiday;
  leave?: Leave;
  pendingLeave?: Leave;
  expectedMin: number;
  completedMin: number;
  remainingMin: number;
  shortfallMin: number;
  excessMin: number;
  unapprovedShortfallMin: number;
  dayEnded: boolean;
  status: DayStatus;
  review?: ShortfallReview;
  firstStart?: number;
  lastEnd?: number;
  hasIncomplete: boolean;
  sessions: WorkSession[];
  isShortfall: boolean;
}

export const dayKey = (employeeId: string, date: string): string => `${employeeId}_${date}`;

export function indexSessions(sessions: WorkSession[]): Map<string, WorkSession[]> {
  const map = new Map<string, WorkSession[]>();
  for (const s of sessions) {
    const k = dayKey(s.employeeId, s.date);
    const arr = map.get(k);
    if (arr) arr.push(s);else
    map.set(k, [s]);
  }
  return map;
}

/** Builds the compliance lookup context from a whole state snapshot. */
export function complianceCtx(state: AppState): ComplianceCtx {
  return {
    sessionsByKey: indexSessions(state.sessions),
    holidays: state.holidays,
    leaves: state.leaves,
    reviews: state.reviews,
    settings: state.settings
  };
}

export function holidayOn(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.date === date && h.status === 'Published' && h.type !== 'Optional');
}

export function approvedLeaveOn(employeeId: string, date: string, leaves: Leave[]): Leave | undefined {
  return leaves.find(
    (l) => l.employeeId === employeeId && l.status === 'Approved' && date >= l.startDate && date <= l.endDate
  );
}

/**
 * The ordinal position of a date within its month's Saturdays: 1 for the first
 * Saturday, 2 for the second, and so on. Saturdays are seven days apart, so the
 * day-of-month ranges map cleanly (1–7 → 1st, 8–14 → 2nd, …).
 */
export function saturdayOrdinal(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/**
 * Is this date a scheduled working day for the employee?
 *
 * Monday–Saturday are governed per employee, except Saturday, which follows the
 * company-wide policy in settings (`workingSaturdays`, e.g. the 1st and 3rd Saturday).
 * A missing value falls back to the company default so an older settings document is
 * still interpreted correctly.
 */
export function isScheduled(emp: Employee, date: string, settings: Settings): boolean {
  const d = fromDateKey(date);
  const dow = d.getDay();
  if (dow === 6) {
    const working = settings.workingSaturdays ?? [1, 3];
    return working.includes(saturdayOrdinal(d));
  }
  return emp.workingDays.includes(dow);
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ordinalLabel = (n: number): string => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

/** A human-readable summary of an employee's week, including the company Saturday rule. */
export function workingDaysLabel(emp: Employee, settings: Settings): string {
  const weekdays = emp.workingDays.filter((d) => d !== 6).map((d) => WEEKDAY_SHORT[d]).join(', ');
  const saturdays = [...(settings.workingSaturdays ?? [1, 3])].sort();
  const satLabel =
    saturdays.length === 0 ? 'no Saturdays' :
    saturdays.length === 5 ? 'all Saturdays' :
    `${saturdays.map(ordinalLabel).join(' & ')} Sat`;
  return `${weekdays || 'No weekdays'} · ${satLabel}`;
}

export function dayEndMs(date: string, settings: Settings): number {
  const d = fromDateKey(date);
  const [h, m] = settings.dayEndTime.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function computeDay(ctx: ComplianceCtx, emp: Employee, date: string, now: number): DayCompliance {
  const sessions = ctx.sessionsByKey.get(dayKey(emp.id, date)) ?? [];
  const holiday = holidayOn(date, ctx.holidays);
  const leave = approvedLeaveOn(emp.id, date, ctx.leaves);
  const pendingLeave = ctx.leaves.find(
    (l) => l.employeeId === emp.id && l.status === 'Pending Approval' && date >= l.startDate && date <= l.endDate
  );
  const scheduled = isScheduled(emp, date, ctx.settings);
  const review = ctx.reviews[dayKey(emp.id, date)];
  const target = emp.dailyTargetMinutes || ctx.settings.dailyTargetMinutes;
  const expectedMin = scheduled && !holiday && !leave ? target : 0;
  const today = todayKey(now);

  const ranges: [number, number][] = [];
  let hasIncomplete = false;
  let firstStart: number | undefined;
  let lastEnd: number | undefined;
  for (const s of sessions) {
    if (s.status === 'Interrupted') hasIncomplete = true;
    if ((s.status === 'Working' || s.status === 'Paused') && s.date < today) hasIncomplete = true;
    for (const iv of s.intervals) {
      const st = +new Date(iv.start);
      let en: number | undefined;
      if (iv.end) en = +new Date(iv.end);else
      if (s.status === 'Working' && s.date === today) en = now;
      firstStart = firstStart === undefined ? st : Math.min(firstStart, st);
      if (en !== undefined) {
        ranges.push([st, en]);
        if (iv.end) lastEnd = lastEnd === undefined ? en : Math.max(lastEnd, en);
      }
    }
  }
  const completedMin = Math.floor(unionMs(ranges) / MINUTE);
  const dayEnded = date < today || date === today && now >= dayEndMs(date, ctx.settings);
  const remainingMin = Math.max(expectedMin - completedMin, 0);
  const shortfallMin = remainingMin;
  const excessMin = Math.max(completedMin - expectedMin, 0);

  let unapprovedShortfallMin = shortfallMin;
  if (review && (review.status === 'Approved Exception' || review.status === 'Waived')) unapprovedShortfallMin = 0;else
  if (review && review.adjustedPayableMinutes !== undefined)
  unapprovedShortfallMin = Math.max(expectedMin - review.adjustedPayableMinutes, 0);

  let status: DayStatus;
  if (holiday && scheduled) status = 'Holiday';else
  if (!scheduled) status = 'Non-working Day';else
  if (leave) status = 'Approved Leave';else
  if (review?.status === 'Approved Exception') status = 'Approved Exception';else
  if (!dayEnded) {
    if (completedMin >= expectedMin) status = 'Target Completed';else
    if (completedMin === 0 && !sessions.length) status = 'Not Started';else
    status = 'In Progress';
  } else if (hasIncomplete) status = 'Needs Review';else
  if (completedMin >= expectedMin) status = 'Target Completed';else
  if (completedMin === 0) status = 'Not Recorded';else
  status = 'Below Target at Day End';

  const isShortfall =
  dayEnded && expectedMin > 0 && shortfallMin > 0 && status !== 'Approved Leave' && status !== 'Holiday';

  return {
    employeeId: emp.id,
    date,
    scheduled,
    holiday,
    leave,
    pendingLeave,
    expectedMin,
    completedMin,
    remainingMin,
    shortfallMin,
    excessMin,
    unapprovedShortfallMin,
    dayEnded,
    status,
    review,
    firstStart,
    lastEnd,
    hasIncomplete,
    sessions,
    isShortfall
  };
}

export function attendanceStatus(d: DayCompliance, settings: Settings): AttendanceStatus {
  switch (d.status) {
    case 'Holiday':
      return 'Holiday';
    case 'Non-working Day':
      return 'Non-working Day';
    case 'Approved Leave':
      return 'Approved Leave';
    case 'Approved Exception':
      return 'Approved Exception';
    case 'Target Completed':
      return 'Target Completed';
    case 'Below Target at Day End':
      return 'Below Target';
    case 'Needs Review':
      return 'Needs Review';
    case 'In Progress':
      return 'Present';
    case 'Not Started':
      return 'Not Recorded';
    case 'Not Recorded':
      return settings.absentPolicy === 'mark_absent' ? 'Absent' : 'Not Recorded';
    default:
      return 'Not Recorded';
  }
}

export function adjustmentLabel(d: DayCompliance): string {
  if (!d.review) return d.isShortfall ? 'Pending Review' : '—';
  return d.review.status;
}