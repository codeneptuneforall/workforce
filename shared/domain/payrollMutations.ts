import type { AppState, PayrollRun, PayrollStatus, Payslip } from '../types';
import { buildPayslipData, monthLabel, payslipBlocker } from './payroll';
import type { PayrollRecord } from './payroll';
import { uid } from './random';
import { fail, isoNow, withAudit, withNotification } from './stateHelpers';
import type { Mutation } from './stateHelpers';
import { fmtDate } from './time';

export const getRun = (s: AppState, month: string): PayrollRun =>
s.payrollRuns.find((r) => r.month === month) ?? { month, status: 'Draft', history: [] };

function putRun(s: AppState, run: PayrollRun): AppState {
  const exists = s.payrollRuns.some((r) => r.month === run.month);
  return { ...s, payrollRuns: exists ? s.payrollRuns.map((r) => r.month === run.month ? run : r) : [...s.payrollRuns, run] };
}

function step(run: PayrollRun, status: PayrollStatus, action: string, actor: string, now: number, note?: string, extra: Partial<PayrollRun> = {}): PayrollRun {
  return { ...run, ...extra, status, history: [...run.history, { action, by: actor, at: isoNow(now), note }] };
}

export function calculatePayroll(s: AppState, month: string, records: PayrollRecord[], actor: string, now: number): Mutation {
  const run = getRun(s, month);
  if (!['Draft', 'Calculated', 'Needs Review'].includes(run.status)) return fail('Payroll is locked. Start a correction to recalculate.');
  const issues = records.filter((r) => !r.ready).length;
  const status: PayrollStatus = issues ? 'Needs Review' : 'Calculated';
  let next = putRun(s, step(run, status, issues ? `Calculated — ${issues} record(s) need review` : 'Calculated', actor, now, undefined, { calculatedAt: isoNow(now) }));
  if (issues)
  next = withNotification(next, now, { audience: 'management', title: 'Payroll needs review', body: `${issues} record(s) in ${monthLabel(month)} need review before approval.`, link: '/management/payroll', tone: 'warn' });
  return withAudit(next, now, { actor, action: 'Payroll calculated', entity: 'Payroll', entityId: month, previous: run.status, next: status });
}

export function approvePayroll(s: AppState, month: string, records: PayrollRecord[], actor: string, now: number): Mutation {
  const run = getRun(s, month);
  if (run.status !== 'Calculated') return fail('Calculate payroll with no outstanding issues before approving.');
  if (records.some((r) => !r.ready)) return fail('Some records still need review. Recalculate after resolving them.');
  const next = putRun(s, step(run, 'Approved', 'Approved', actor, now, undefined, { approvedBy: actor, approvedAt: isoNow(now) }));
  return withAudit(withNotification(next, now, { audience: 'management', title: 'Salary credit pending', body: `${monthLabel(month)} payroll is approved. Record salary credit once paid.`, link: '/management/payroll', tone: 'info' }), now, {
    actor, action: 'Payroll approved', entity: 'Payroll', entityId: month, previous: run.status, next: 'Approved'
  });
}

export function confirmCredit(s: AppState, month: string, date: string, reference: string, actor: string, now: number): Mutation {
  const run = getRun(s, month);
  if (run.status !== 'Approved') return fail('Payroll must be approved before salary credit can be recorded.');
  if (!date) return fail('Enter the date the salary was credited.');
  const next = putRun(s, step(run, 'Salary Credited', 'Salary credit confirmed', actor, now, `Credited on ${fmtDate(date)}${reference ? ` · Ref ${reference}` : ''}`, { creditDate: date, creditReference: reference || undefined, creditedBy: actor }));
  return withAudit(next, now, { actor, action: 'Salary credit confirmed', entity: 'Payroll', entityId: month, previous: 'Approved', next: `Salary Credited · ${fmtDate(date)}`, reason: reference ? `Reference ${reference}` : undefined });
}

export function generatePayslips(s: AppState, month: string, records: PayrollRecord[], actor: string, now: number, onlyFailed = false): Mutation {
  const run = getRun(s, month);
  const allowed = s.settings.releaseRequiresCredit ? ['Salary Credited', 'Payslips Generated'] : ['Approved', 'Salary Credited', 'Payslips Generated'];
  if (!allowed.includes(run.status)) return fail(s.settings.releaseRequiresCredit ? 'Confirm salary credit before generating final payslips.' : 'Approve payroll first.');
  const target = onlyFailed ? records.filter((r) => run.failedEmployeeIds?.includes(r.employee.id)) : records;
  const failed: string[] = [];
  const created: Payslip[] = [];
  for (const rec of target) {
    const blocker = payslipBlocker(rec.structure);
    if (blocker) {
      failed.push(rec.employee.id);
      continue;
    }
    const existing = s.payslips.filter((p) => p.employeeId === rec.employee.id && p.month === month);
    if (existing.some((p) => p.status === 'Generated' || p.status === 'Released')) continue;
    created.push({ id: uid('ps'), employeeId: rec.employee.id, month, version: existing.length + 1, status: 'Generated', generatedAt: isoNow(now), data: buildPayslipData(rec, s.settings) });
  }
  let next: AppState = { ...s, payslips: [...s.payslips, ...created] };
  next = putRun(next, step(run, 'Payslips Generated', `Generated ${created.length} payslip(s)${failed.length ? `, ${failed.length} failed` : ''}`, actor, now, undefined, { generatedAt: isoNow(now), failedEmployeeIds: failed }));
  if (failed.length) {
    const names = failed.map((id) => s.employees.find((e) => e.id === id)?.name).join(', ');
    next = withNotification(next, now, { audience: 'management', title: 'Payslip generation failed', body: `Could not generate payslips for ${names}: bank details missing.`, link: '/management/payroll', tone: 'bad' });
  }
  return withAudit(next, now, { actor, action: 'Payslips generated', entity: 'Payroll', entityId: month, next: `${created.length} generated · ${failed.length} failed` });
}

export function releasePayslips(s: AppState, month: string, actor: string, now: number): Mutation {
  const run = getRun(s, month);
  if (run.status !== 'Payslips Generated') return fail('Generate payslips before releasing them.');
  if (s.settings.releaseRequiresCredit && !run.creditDate) return fail('Salary credit has not been confirmed for this month.');
  const toRelease = s.payslips.filter((p) => p.month === month && p.status === 'Generated');
  if (!toRelease.length) return fail('There are no generated payslips waiting for release.');
  let next: AppState = {
    ...s,
    payslips: s.payslips.map((p) => {
      if (p.month !== month) return p;
      if (p.status === 'Generated') return { ...p, status: 'Released', releasedAt: isoNow(now) };
      if (p.status === 'Released' && toRelease.some((r) => r.employeeId === p.employeeId)) return { ...p, status: 'Superseded' };
      return p;
    })
  };
  next = putRun(next, step(run, 'Released', `Released ${toRelease.length} payslip(s)`, actor, now, undefined, { releasedAt: isoNow(now) }));
  for (const p of toRelease)
  next = withNotification(next, now, { audience: p.employeeId, title: 'Payslip released', body: `Your payslip for ${monthLabel(month)} is now available.`, link: '/employee/payslips', tone: 'ok' });
  return withAudit(next, now, { actor, action: 'Payslips released', entity: 'Payroll', entityId: month, previous: 'Payslips Generated', next: `Released · ${toRelease.length} payslip(s)` });
}

export function reopenPayroll(s: AppState, month: string, reason: string, actor: string, now: number): Mutation {
  const run = getRun(s, month);
  if (run.status !== 'Approved') return fail('Only approved payroll that has not been credited can be reopened. Use payslip revisions after credit.');
  if (!reason.trim()) return fail('A correction reason is required.');
  const next = putRun(s, step(run, 'Needs Review', 'Correction started', actor, now, reason.trim()));
  return withAudit(next, now, { actor, action: 'Payroll correction started', entity: 'Payroll', entityId: month, previous: 'Approved', next: 'Needs Review', reason: reason.trim() });
}

export function revisePayslip(s: AppState, payslipId: string, reason: string, record: PayrollRecord, actor: string, now: number): Mutation {
  const original = s.payslips.find((p) => p.id === payslipId);
  if (!original || original.status !== 'Released') return fail('Only released payslips can be revised.');
  if (!reason.trim()) return fail('A revision reason is required.');
  if (s.payslips.some((p) => p.employeeId === original.employeeId && p.month === original.month && p.status === 'Generated'))
  return fail('A revised version is already waiting for release.');
  const blocker = payslipBlocker(record.structure);
  if (blocker) return fail(`Payslip generation failed: ${blocker}`);
  const versions = s.payslips.filter((p) => p.employeeId === original.employeeId && p.month === original.month).length;
  const revised: Payslip = {
    id: uid('ps'), employeeId: original.employeeId, month: original.month, version: versions + 1, status: 'Generated', generatedAt: isoNow(now), revisionReason: reason.trim(),
    data: buildPayslipData(record, s.settings)
  };
  return withAudit({ ...s, payslips: [...s.payslips, revised] }, now, {
    actor, action: 'Payslip revision created', entity: 'Payslip', entityId: `${record.employee.name} · ${monthLabel(original.month)}`, previous: `v${original.version} (preserved)`, next: `v${revised.version} · awaiting release`, reason: reason.trim()
  });
}

export function releaseSinglePayslip(s: AppState, payslipId: string, actor: string, now: number): Mutation {
  const p = s.payslips.find((x) => x.id === payslipId);
  if (!p || p.status !== 'Generated') return fail('This payslip is not waiting for release.');
  const run = getRun(s, p.month);
  if (s.settings.releaseRequiresCredit && !run.creditDate) return fail('Salary credit has not been confirmed for this month.');
  let next: AppState = {
    ...s,
    payslips: s.payslips.map((x) => {
      if (x.id === payslipId) return { ...x, status: 'Released', releasedAt: isoNow(now) };
      if (x.employeeId === p.employeeId && x.month === p.month && x.status === 'Released') return { ...x, status: 'Superseded' };
      return x;
    })
  };
  next = withNotification(next, now, { audience: p.employeeId, title: p.version > 1 ? 'Revised payslip released' : 'Payslip released', body: `Your payslip for ${monthLabel(p.month)}${p.version > 1 ? ` (version ${p.version})` : ''} is now available.`, link: '/employee/payslips', tone: 'ok' });
  return withAudit(next, now, { actor, action: 'Payslip released', entity: 'Payslip', entityId: `${p.data.employee.name} · ${monthLabel(p.month)} v${p.version}`, next: 'Released' });
}