import { format } from 'date-fns';
import type {
  AppState,
  Employee,
  Holiday,
  PayrollStatus,
  PayslipData,
  PayslipLine,
  SalaryStructure,
  Settings } from '../types';
import { computeDay, complianceCtx, holidayOn, isScheduled } from './compliance';
import type { ComplianceCtx } from './compliance';
import { fmtINR, maskAccount } from './currency';
import { eachDateKey, fmtDate, fmtMin, fromDateKey, monthDates, todayKey } from './time';

export const PAYROLL_STEPS: PayrollStatus[] = [
'Draft',
'Calculated',
'Approved',
'Salary Credited',
'Payslips Generated',
'Released'];


export const monthLabel = (month: string): string => format(fromDateKey(`${month}-01`), 'MMMM yyyy');

export const grossOf = (ss: SalaryStructure): number =>
ss.earnings.basic + ss.earnings.hra + ss.earnings.conveyance + ss.earnings.otherAllowances + ss.earnings.incentives;

export function scheduledDaysInMonth(emp: Employee, month: string, holidays: Holiday[], settings: Settings): number {
  return monthDates(month).filter((d) => isScheduled(emp, d, settings) && !holidayOn(d, holidays)).length;
}

export function payrollBasisDays(settings: Settings, emp: Employee, month: string, holidays: Holiday[]): number | null {
  switch (settings.payrollBasis) {
    case 'calendar_days':
      return monthDates(month).length;
    case 'scheduled_working_days':
      return scheduledDaysInMonth(emp, month, holidays, settings);
    case 'fixed_days':
      return settings.fixedBasisDays && settings.fixedBasisDays > 0 ? settings.fixedBasisDays : null;
    default:
      return null;
  }
}

export function roundAmount(n: number, settings: Settings): number {
  return settings.rounding === 'nearest_rupee' ? Math.round(n) : Math.round(n * 100) / 100;
}

export interface DeductionProposal {
  amount: number | null;
  breakdown: string;
  missing?: string;
  manual?: boolean;
}

export function proposeShortfallDeduction(
settings: Settings,
emp: Employee,
ss: SalaryStructure | undefined,
month: string,
holidays: Holiday[],
shortfallMin: number)
: DeductionProposal {
  if (shortfallMin <= 0) return { amount: 0, breakdown: 'No unapproved shortfall remains.' };
  if (!settings.deductionEnabled)
  return { amount: null, breakdown: '', missing: 'Shortfall deductions are disabled in payroll policy settings.' };
  const hrs = shortfallMin / 60;
  const targetH = (emp.dailyTargetMinutes || settings.dailyTargetMinutes) / 60;
  switch (settings.deductionMethod) {
    case 'not_configured':
      return { amount: null, breakdown: '', missing: 'No deduction method has been configured and approved by management.' };
    case 'manual':
      return {
        amount: null,
        breakdown: 'Company policy requires a manually entered, management-approved amount.',
        manual: true
      };
    case 'daily_amount':{
        if (!ss) return { amount: null, breakdown: '', missing: 'No salary structure configured for this employee.' };
        if (!ss.dailyPayableAmount)
        return { amount: null, breakdown: '', missing: 'Daily payable amount is not configured for this employee.' };
        const rate = ss.dailyPayableAmount / targetH;
        const amount = roundAmount(rate * hrs, settings);
        return {
          amount,
          breakdown: `${fmtINR(ss.dailyPayableAmount)} daily payable ÷ ${targetH}h target = ${fmtINR(rate)}/h × ${fmtMin(shortfallMin)} = ${fmtINR(amount)}`
        };
      }
    case 'monthly_proration':{
        if (!ss) return { amount: null, breakdown: '', missing: 'No salary structure configured for this employee.' };
        const basis = payrollBasisDays(settings, emp, month, holidays);
        if (!basis) return { amount: null, breakdown: '', missing: 'Monthly payroll basis (days) is not configured.' };
        const gross = grossOf(ss);
        const rate = gross / basis / targetH;
        const amount = roundAmount(rate * hrs, settings);
        return {
          amount,
          breakdown: `${fmtINR(gross)} monthly gross ÷ ${basis} basis days ÷ ${targetH}h = ${fmtINR(rate)}/h × ${fmtMin(shortfallMin)} = ${fmtINR(amount)}`
        };
      }
    default:
      return { amount: null, breakdown: '', missing: 'Unknown deduction method.' };
  }
}

export function linesFromStructure(
ss: SalaryStructure,
lopAmount: number,
shortfallDeduction: number)
: {earnings: PayslipLine[];deductions: PayslipLine[];gross: number;totalDeduction: number;} {
  const earnings: PayslipLine[] = [
  { label: 'Basic & DA', amount: ss.earnings.basic },
  { label: 'HRA', amount: ss.earnings.hra },
  { label: 'Conveyance', amount: ss.earnings.conveyance },
  { label: 'Other Allowances', amount: ss.earnings.otherAllowances }];

  if (ss.earnings.incentives > 0) earnings.push({ label: 'Incentives', amount: ss.earnings.incentives });
  const deductions: PayslipLine[] = [
  { label: 'EPF', amount: ss.deductions.epf },
  { label: 'ESI', amount: ss.deductions.esi },
  { label: 'Professional Tax', amount: ss.deductions.professionalTax },
  { label: 'Leave / LOP', amount: lopAmount },
  { label: 'Working-Hour Shortfall Deduction', amount: shortfallDeduction },
  { label: 'Insurance', amount: ss.deductions.insurance },
  { label: 'TDS', amount: ss.deductions.tds },
  { label: 'Other Deductions', amount: ss.deductions.other }];

  return {
    earnings,
    deductions,
    gross: grossOf(ss),
    totalDeduction: deductions.reduce((a, b) => a + b.amount, 0)
  };
}

export interface ShortfallSummary {
  days: number;
  totalMin: number;
  pending: number;
  approvedDeduction: number;
  resolvedWithoutDeduction: number;
}

export interface PayrollRecord {
  employee: Employee;
  structure?: SalaryStructure;
  month: string;
  salaryDays: number;
  lopDays: number;
  lopAmount: number;
  scheduledDays: number;
  earnings: PayslipLine[];
  gross: number;
  employerContribution: number;
  deductions: PayslipLine[];
  totalDeduction: number;
  takeHome: number;
  shortfall: ShortfallSummary;
  leave: {casual: number;emergency: number;};
  issues: string[];
  ready: boolean;
}

export function computePayrollRecord(
ctx: ComplianceCtx,
emp: Employee,
month: string,
salary: SalaryStructure[],
now: number)
: PayrollRecord {
  const settings = ctx.settings;
  const ss = salary.find((s) => s.employeeId === emp.id);
  const dates = monthDates(month);
  const today = todayKey(now);
  const issues: string[] = [];

  let casual = 0;
  let emergency = 0;
  for (const l of ctx.leaves) {
    if (l.employeeId !== emp.id || l.status !== 'Approved') continue;
    for (const d of eachDateKey(l.startDate, l.endDate)) {
      if (!d.startsWith(month) || !isScheduled(emp, d, settings) || holidayOn(d, ctx.holidays)) continue;
      if (l.type === 'Casual') casual++;else
      emergency++;
    }
  }
  if (casual > 0 && settings.casualTreatment === 'not_configured')
  issues.push(`${casual} day(s) of approved Casual Leave — paid/unpaid treatment is not configured.`);
  if (emergency > 0 && settings.emergencyTreatment === 'not_configured')
  issues.push(`${emergency} day(s) of approved Emergency Leave — paid/unpaid treatment is not configured.`);
  const lopDays =
  (settings.casualTreatment === 'unpaid' ? casual : 0) + (settings.emergencyTreatment === 'unpaid' ? emergency : 0);

  const shortfall: ShortfallSummary = { days: 0, totalMin: 0, pending: 0, approvedDeduction: 0, resolvedWithoutDeduction: 0 };
  for (const d of dates) {
    if (d > today) continue;
    const dc = computeDay(ctx, emp, d, now);
    if (!dc.isShortfall) continue;
    shortfall.days++;
    shortfall.totalMin += dc.unapprovedShortfallMin;
    const r = dc.review;
    if (!r || r.status === 'Pending Review' || r.status === 'Correction Requested') shortfall.pending++;else
    if (r.status === 'Confirmed' || r.status === 'Adjusted') {
      if (r.finalDeduction === null || r.finalDeduction === undefined)
      issues.push(`Shortfall on ${fmtDate(d, 'd MMM')} is confirmed but has no final approved deduction.`);else
      shortfall.approvedDeduction += r.finalDeduction;
    } else shortfall.resolvedWithoutDeduction++;
  }
  if (shortfall.pending > 0) issues.push(`${shortfall.pending} working-hour shortfall(s) awaiting management review.`);

  const scheduledDays = scheduledDaysInMonth(emp, month, ctx.holidays, settings);
  if (!ss) {
    issues.push('No salary structure is configured for this employee.');
    return {
      employee: emp, month, salaryDays: dates.length - lopDays, lopDays, lopAmount: 0, scheduledDays,
      earnings: [], gross: 0, employerContribution: 0, deductions: [], totalDeduction: 0, takeHome: 0,
      shortfall, leave: { casual, emergency }, issues, ready: false
    };
  }
  const gross = grossOf(ss);
  let lopAmount = 0;
  if (lopDays > 0) {
    const basis = payrollBasisDays(settings, emp, month, ctx.holidays);
    if (!basis) issues.push('Leave/LOP calculation basis is not configured.');else
    lopAmount = roundAmount(gross / basis * lopDays, settings);
  }
  const { earnings, deductions, totalDeduction } = linesFromStructure(ss, lopAmount, shortfall.approvedDeduction);
  return {
    employee: emp,
    structure: ss,
    month,
    salaryDays: dates.length - lopDays,
    lopDays,
    lopAmount,
    scheduledDays,
    earnings,
    gross,
    employerContribution: ss.employerContribution,
    deductions,
    totalDeduction,
    takeHome: gross - totalDeduction,
    shortfall,
    leave: { casual, emergency },
    issues,
    ready: issues.length === 0
  };
}

export function buildPayslipData(rec: PayrollRecord, settings: Settings): PayslipData {
  const ss = rec.structure as SalaryStructure;
  return {
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    month: rec.month,
    employee: {
      name: rec.employee.name,
      code: rec.employee.code,
      designation: rec.employee.designation,
      joiningDate: rec.employee.joiningDate,
      bankName: rec.employee.bankName ?? '',
      accountMasked: maskAccount(rec.employee.bankAccountNumber ?? ''),
      uan: ss.uan,
      esi: ss.esiNumber
    },
    ctcAnnual: ss.ctcAnnual,
    salaryDays: rec.salaryDays,
    lopDays: rec.lopDays,
    earnings: rec.earnings,
    gross: rec.gross,
    employerContribution: rec.employerContribution,
    ctcMonthly: rec.gross + rec.employerContribution,
    deductions: rec.deductions,
    totalDeduction: rec.totalDeduction,
    takeHome: rec.takeHome,
    confidentialityNote: settings.confidentialityNote
  };
}

export function payslipBlocker(emp: {bankName?: string; bankAccountNumber?: string;} | undefined): string | null {
  if (!emp) return 'No employee record.';
  if (!emp.bankName || !emp.bankAccountNumber) return 'Bank details are missing from the employee record.';
  return null;
}

/**
 * Employees that belong in a payroll run for the given month: everyone currently active,
 * plus anyone who was active during the month and recorded time in it.
 */
export function payrollEmployees(state: AppState, month: string): Employee[] {
  const first = monthDates(month)[0];
  return state.employees.filter(
    (e) =>
      e.status === 'Active' ||
      (e.joiningDate <= first && state.sessions.some((s) => s.employeeId === e.id && s.date.startsWith(month)))
  );
}

/**
 * Authoritative payroll records for a month. The API server calculates these itself so a
 * payroll run can never be approved on numbers the browser supplied.
 */
export function buildPayrollRecords(state: AppState, month: string, now: number): PayrollRecord[] {
  const ctx = complianceCtx(state);
  return payrollEmployees(state, month).map((e) => computePayrollRecord(ctx, e, month, state.salary, now));
}