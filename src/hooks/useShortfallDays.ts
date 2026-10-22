import { useMemo } from 'react';
import { startOfMonth, subMonths } from 'date-fns';
import { useData } from '../contexts/DataContext';
import { computeDay } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { eachDateKey, fromDateKey, toDateKey, todayKey } from '@shared/domain/time';
import { useNow } from './useNow';

/** All ended working days with a shortfall, from two months back through today. */
export function useShortfallDays(): DayCompliance[] {
  const { state, ctx } = useData();
  const minute = Math.floor(useNow(60000) / 60000);
  return useMemo(() => {
    const now = Date.now();
    const today = todayKey(now);
    const start = toDateKey(startOfMonth(subMonths(fromDateKey(today), 2)));
    const dates = eachDateKey(start, today);
    const out: DayCompliance[] = [];
    for (const emp of state.employees)
    for (const d of dates) {
      const dc = computeDay(ctx, emp, d, now);
      if (dc.isShortfall) out.push(dc);
    }
    return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.employeeId < b.employeeId ? -1 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, state.employees, minute]);
}

export const isPendingReview = (d: DayCompliance): boolean => !d.review || d.review.status === 'Pending Review' || d.review.status === 'Correction Requested';