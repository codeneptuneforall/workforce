import { addDays } from 'date-fns';
import type { Employee, Holiday, Leave, LeaveType, Settings } from '../types';
import { holidayOn, isScheduled } from './compliance';
import { eachDateKey, fmtDate, fromDateKey, toDateKey, todayKey } from './time';

export interface LeaveForm {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  contact: string;
}

export interface LeaveValidation {
  errors: Partial<Record<'type' | 'startDate' | 'endDate' | 'reason' | 'overlap' | 'days', string>>;
  days: number;
  retrospective: boolean;
  earliestCasual: string;
  holidaysInRange: Holiday[];
}

export function countLeaveDays(emp: Employee, start: string, end: string, holidays: Holiday[], settings: Settings): number {
  if (!start || !end || end < start) return 0;
  return eachDateKey(start, end).filter((d) => isScheduled(emp, d, settings) && !holidayOn(d, holidays)).length;
}

export function earliestCasualDate(settings: Settings, now: number): string {
  return toDateKey(addDays(fromDateKey(todayKey(now)), settings.casualAdvanceDays));
}

export function validateLeave(
form: LeaveForm,
emp: Employee,
leaves: Leave[],
holidays: Holiday[],
settings: Settings,
now: number)
: LeaveValidation {
  const errors: LeaveValidation['errors'] = {};
  const today = todayKey(now);
  const earliestCasual = earliestCasualDate(settings, now);
  if (!form.startDate) errors.startDate = 'Select a start date.';
  if (!form.endDate) errors.endDate = 'Select an end date.';
  if (form.startDate && form.endDate && form.endDate < form.startDate)
  errors.endDate = 'End date cannot be before the start date.';
  const days = countLeaveDays(emp, form.startDate, form.endDate, holidays, settings);
  const holidaysInRange =
  form.startDate && form.endDate && form.endDate >= form.startDate ?
  holidays.filter((h) => h.status === 'Published' && h.date >= form.startDate && h.date <= form.endDate) :
  [];
  if (form.startDate && form.endDate && form.endDate >= form.startDate && days === 0)
  errors.days = 'The selected dates contain no scheduled working days.';

  const retrospective = form.type === 'Emergency' && !!form.startDate && form.startDate < today;
  if (form.type === 'Casual' && form.startDate && form.startDate < earliestCasual) {
    errors.startDate = `Casual Leave needs ${settings.casualAdvanceDays} calendar days' notice. Earliest eligible start date: ${fmtDate(earliestCasual, 'EEE, d MMM yyyy')}.`;
  }
  if (form.type === 'Emergency' && retrospective && !settings.emergencyRetrospective) {
    errors.startDate = 'Past-dated Emergency Leave is disabled by company policy.';
  }
  const reason = form.reason.trim();
  if (!reason) errors.reason = 'A reason is required.';else
  if (retrospective && reason.length < 15)
  errors.reason = 'Past-dated requests need a fuller explanation (at least 15 characters).';

  if (form.startDate && form.endDate) {
    const clash = leaves.find(
      (l) =>
      l.employeeId === emp.id && (
      l.status === 'Pending Approval' || l.status === 'Approved') &&
      l.startDate <= form.endDate &&
      l.endDate >= form.startDate
    );
    if (clash)
    errors.overlap = `These dates overlap your ${clash.status === 'Approved' ? 'approved' : 'pending'} ${clash.type} Leave (${fmtDate(clash.startDate, 'd MMM')} – ${fmtDate(clash.endDate, 'd MMM')}).`;
  }
  return { errors, days, retrospective, earliestCasual, holidaysInRange };
}

export function leaveYearRange(settings: Settings, now: number): [string, string] {
  const d = new Date(now);
  const startMonth = settings.leaveYearStartMonth - 1;
  const year = d.getMonth() >= startMonth ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(year, startMonth, 1);
  const end = addDays(new Date(year + 1, startMonth, 1), -1);
  return [toDateKey(start), toDateKey(end)];
}