import type { AdjustmentCategory, AppState, Leave, ReviewStatus, ShortfallReview, TimesheetStatus } from '../types';
import { dayKey } from './compliance';
import type { LeaveForm, LeaveValidation } from './leave';
import { monthLabel } from './payroll';
import { uid } from './random';
import { fail, isoNow, withAudit, withNotification } from './stateHelpers';
import type { Mutation } from './stateHelpers';
import { fmtDate, fmtMin } from './time';
import { fmtINR } from './currency';

const LOCKED_PAYROLL = ['Approved', 'Salary Credited', 'Payslips Generated', 'Released'];

export function submitTimesheet(s: AppState, employeeId: string, weekStart: string, actor: string, now: number): Mutation {
  const existing = s.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === weekStart);
  if (existing && (existing.status === 'Approved' || existing.status === 'Under Review'))
  return fail('This timesheet is already being reviewed or has been approved.');
  const item = { action: existing?.status === 'Changes Requested' ? 'Resubmitted' : 'Submitted', by: actor, at: isoNow(now) };
  const timesheets = existing ?
  s.timesheets.map((t) => t.id === existing.id ? { ...t, status: 'Submitted' as TimesheetStatus, submittedAt: isoNow(now), history: [...t.history, item] } : t) :
  [...s.timesheets, { id: uid('ts'), employeeId, weekStart, status: 'Submitted' as TimesheetStatus, submittedAt: isoNow(now), history: [item] }];
  const emp = s.employees.find((e) => e.id === employeeId);
  let next = { ...s, timesheets };
  next = withNotification(next, now, {
    audience: 'management',
    title: 'Timesheet submitted',
    body: `${emp?.name} submitted the timesheet for the week of ${fmtDate(weekStart, 'd MMM')}.`,
    link: '/management/timesheets',
    tone: 'info'
  });
  return withNotification(next, now, {
    audience: employeeId,
    title: 'Timesheet submitted',
    body: `Your timesheet for the week of ${fmtDate(weekStart, 'd MMM')} was submitted for review.`,
    link: '/employee/timesheets',
    tone: 'info'
  });
}

export function reviewTimesheet(
s: AppState,
timesheetId: string,
decision: 'Approved' | 'Changes Requested' | 'Under Review',
note: string,
actor: string,
now: number)
: Mutation {
  const ts = s.timesheets.find((t) => t.id === timesheetId);
  if (!ts) return fail('Timesheet not found.');
  if (decision === 'Changes Requested' && !note.trim()) return fail('Add a reason so the employee knows what to correct.');
  const timesheets = s.timesheets.map((t) =>
  t.id === timesheetId ?
  { ...t, status: decision as TimesheetStatus, history: [...t.history, { action: decision, by: actor, at: isoNow(now), note: note.trim() || undefined }] } :
  t
  );
  let next: AppState = { ...s, timesheets };
  if (decision !== 'Under Review')
  next = withNotification(next, now, {
    audience: ts.employeeId,
    title: decision === 'Approved' ? 'Timesheet approved' : 'Timesheet needs changes',
    body: decision === 'Approved' ? `Your timesheet for the week of ${fmtDate(ts.weekStart, 'd MMM')} was approved.` : `Changes requested: ${note.trim()}`,
    link: '/employee/timesheets',
    tone: decision === 'Approved' ? 'ok' : 'warn'
  });
  const emp = s.employees.find((e) => e.id === ts.employeeId);
  return withAudit(next, now, {
    actor,
    action: `Timesheet ${decision.toLowerCase()}`,
    entity: 'Timesheet',
    entityId: `${emp?.name} · week of ${fmtDate(ts.weekStart, 'd MMM yyyy')}`,
    previous: ts.status,
    next: decision,
    reason: note.trim() || undefined
  });
}

export interface ShortfallDecision {
  status: ReviewStatus;
  category?: AdjustmentCategory;
  reason: string;
  adjustedPayableMinutes?: number;
  proposedDeduction: number | null;
  finalDeduction?: number | null;
  shortfallMin: number;
  canManagePayroll: boolean;
}

export function reviewShortfall(s: AppState, employeeId: string, date: string, d: ShortfallDecision, actor: string, now: number): Mutation {
  if (!d.reason.trim()) return fail('A reason is required for every shortfall decision.');
  const payrollImpacting = d.status !== 'Correction Requested';
  if (payrollImpacting && !d.canManagePayroll)
  return fail('Only authorised payroll managers can confirm, adjust, waive or except payroll-impacting shortfalls.');
  const run = s.payrollRuns.find((r) => r.month === date.slice(0, 7));
  if (run && LOCKED_PAYROLL.includes(run.status))
  return fail(`Payroll for ${monthLabel(run.month)} is ${run.status.toLowerCase()}. Use the payroll correction workflow instead.`);
  if ((d.status === 'Adjusted' || d.status === 'Approved Exception' || d.status === 'Waived') && !d.category)
  return fail('Choose an adjustment category.');
  if (d.status === 'Adjusted' && (d.adjustedPayableMinutes === undefined || Number.isNaN(d.adjustedPayableMinutes)))
  return fail('Enter the adjusted payable hours.');
  if ((d.status === 'Confirmed' || d.status === 'Adjusted') && (d.finalDeduction === null || d.finalDeduction === undefined))
  return fail('Enter the final approved deduction (enter 0 if no deduction applies).');
  if (d.finalDeduction !== null && d.finalDeduction !== undefined && d.finalDeduction < 0) return fail('Deduction cannot be negative.');

  const key = dayKey(employeeId, date);
  const prev = s.reviews[key];
  const finalDeduction = d.status === 'Waived' || d.status === 'Approved Exception' ? 0 : d.status === 'Correction Requested' ? null : d.finalDeduction ?? null;
  const review: ShortfallReview = {
    id: key,
    employeeId,
    date,
    status: d.status,
    category: d.category,
    reason: d.reason.trim(),
    adjustedPayableMinutes: d.status === 'Adjusted' ? d.adjustedPayableMinutes : undefined,
    proposedDeduction: d.proposedDeduction,
    finalDeduction,
    reviewedBy: actor,
    reviewedAt: isoNow(now),
    history: [
    ...(prev?.history ?? []),
    {
      at: isoNow(now),
      by: actor,
      from: prev?.status ?? 'Pending Review',
      to: d.status,
      reason: d.reason.trim(),
      previousDeduction: prev?.finalDeduction ?? null,
      newDeduction: finalDeduction
    }]

  };
  let next: AppState = { ...s, reviews: { ...s.reviews, [key]: review } };
  const emp = s.employees.find((e) => e.id === employeeId);
  if (d.status === 'Correction Requested')
  next = withNotification(next, now, {
    audience: employeeId,
    title: 'Time-log correction requested',
    body: `Please review your time logs for ${fmtDate(date)}: ${d.reason.trim()}`,
    link: '/employee/attendance',
    tone: 'warn'
  });
  return withAudit(next, now, {
    actor,
    action: d.status === 'Adjusted' ? 'Manual working-hour adjustment' : `Shortfall ${d.status.toLowerCase()}`,
    entity: 'Shortfall',
    entityId: `${emp?.name} · ${fmtDate(date)}`,
    previous: prev ? `${prev.status}${prev.finalDeduction != null ? ` · ${fmtINR(prev.finalDeduction)}` : ''}` : `Pending Review · shortfall ${fmtMin(d.shortfallMin)}`,
    next: `${d.status}${d.adjustedPayableMinutes !== undefined && d.status === 'Adjusted' ? ` · payable ${fmtMin(d.adjustedPayableMinutes)}` : ''}${finalDeduction != null ? ` · final ${fmtINR(finalDeduction)}` : ''}${d.proposedDeduction != null ? ` (proposed ${fmtINR(d.proposedDeduction)})` : ''}`,
    reason: d.reason.trim()
  });
}

export function requestDayCorrection(s: AppState, _employeeId: string, date: string, note: string, actor: string, now: number): Mutation {
  if (!note.trim()) return fail('Describe what needs correcting.');
  const next = withNotification(s, now, {
    audience: 'management',
    title: 'Time-log correction request',
    body: `${actor} requested a correction for ${fmtDate(date)}: ${note.trim()}`,
    link: '/management/attendance/shortfalls',
    tone: 'warn'
  });
  return withAudit(next, now, { actor, action: 'Correction requested by employee', entity: 'Work day', entityId: `${actor} · ${fmtDate(date)}`, reason: note.trim() });
}

export function applyLeave(s: AppState, employeeId: string, form: LeaveForm, v: LeaveValidation, attachmentName: string | undefined, actor: string, now: number): Mutation {
  if (Object.keys(v.errors).length) return fail('Fix the highlighted fields before submitting.');
  const leave: Leave = {
    id: uid('l'),
    employeeId,
    type: form.type,
    startDate: form.startDate,
    endDate: form.endDate,
    days: v.days,
    reason: form.reason.trim(),
    contact: form.contact.trim() || undefined,
    attachmentName,
    status: 'Pending Approval',
    submittedAt: isoNow(now),
    retrospective: v.retrospective
  };
  let next: AppState = { ...s, leaves: [leave, ...s.leaves] };
  next = withNotification(next, now, {
    audience: 'management',
    title: v.retrospective ? 'Retrospective Emergency Leave' : 'New leave request',
    body: `${actor} requested ${v.days} day(s) of ${form.type} Leave from ${fmtDate(form.startDate, 'd MMM')}.`,
    link: '/management/leaves/requests',
    tone: 'warn'
  });
  next = withNotification(next, now, {
    audience: employeeId,
    title: 'Leave request submitted',
    body: `Your ${form.type} Leave request is pending approval.`,
    link: '/employee/leaves/history',
    tone: 'info'
  });
  return withAudit(next, now, { actor, action: 'Leave requested', entity: 'Leave', entityId: leave.id, next: `${form.type} · ${v.days} day(s) · Pending Approval`, reason: form.reason.trim() });
}

export function decideLeave(s: AppState, leaveId: string, approve: boolean, reason: string, actor: string, now: number): Mutation {
  const leave = s.leaves.find((l) => l.id === leaveId);
  if (!leave) return fail('Leave request not found.');
  if (leave.status !== 'Pending Approval') return fail('This request has already been decided.');
  if (!approve && !reason.trim()) return fail('A rejection reason is required.');
  const status = approve ? 'Approved' : 'Rejected';
  const updated: Leave = { ...leave, status, decidedBy: actor, decidedAt: isoNow(now), rejectionReason: approve ? undefined : reason.trim() };
  let next: AppState = { ...s, leaves: s.leaves.map((l) => l.id === leaveId ? updated : l) };
  next = withNotification(next, now, {
    audience: leave.employeeId,
    title: approve ? 'Leave approved' : 'Leave rejected',
    body: approve ?
    `Your ${leave.type} Leave (${fmtDate(leave.startDate, 'd MMM')} – ${fmtDate(leave.endDate, 'd MMM')}) was approved by ${actor}.` :
    `Your ${leave.type} Leave was rejected: ${reason.trim()}`,
    link: '/employee/leaves/history',
    tone: approve ? 'ok' : 'bad'
  });
  return withAudit(next, now, {
    actor,
    action: approve ? 'Leave approved' : 'Leave rejected',
    entity: 'Leave',
    entityId: leaveId,
    previous: 'Pending Approval',
    next: status,
    reason: reason.trim() || undefined
  });
}

export function cancelLeave(s: AppState, leaveId: string, actor: string, now: number): Mutation {
  const leave = s.leaves.find((l) => l.id === leaveId);
  if (!leave || leave.status !== 'Pending Approval') return fail('Only pending requests can be cancelled.');
  const next: AppState = { ...s, leaves: s.leaves.map((l) => l.id === leaveId ? { ...l, status: 'Cancelled' } : l) };
  return withAudit(next, now, { actor, action: 'Leave request cancelled', entity: 'Leave', entityId: leaveId, previous: 'Pending Approval', next: 'Cancelled' });
}