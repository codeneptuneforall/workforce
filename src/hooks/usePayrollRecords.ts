import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { computePayrollRecord } from '@shared/domain/payroll';
import type { PayrollRecord } from '@shared/domain/payroll';
import { monthDates } from '@shared/domain/time';

/** Payroll records for active employees, plus anyone who was active during the month and has a salary structure. */
export function usePayrollRecords(month: string): PayrollRecord[] {
  const { state, ctx } = useData();
  return useMemo(() => {
    const now = Date.now();
    const first = monthDates(month)[0];
    const emps = state.employees.filter(
      (e) => e.status === 'Active' || e.joiningDate <= first && state.sessions.some((s) => s.employeeId === e.id && s.date.startsWith(month))
    );
    return emps.map((e) => computePayrollRecord(ctx, e, month, state.salary, now));
  }, [state.employees, state.sessions, state.salary, ctx, month]);
}