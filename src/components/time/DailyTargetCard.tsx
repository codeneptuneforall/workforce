import { CheckCircle2Icon } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { Employee } from '@shared/types';
import { computeDay } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtDate, fmtMin, todayKey } from '@shared/domain/time';
import { StatusBadge } from '../ui/Badge';
import { ProgressBar } from '../ui/Primitives';
import { TimerPanel } from './TimerPanel';

export function DailyTargetCard({ employee, showTimer = true }: {employee: Employee;showTimer?: boolean;}) {
  const { ctx } = useData();
  const now = useNow(1000);
  const today = todayKey(now);
  const day = computeDay(ctx, employee, today, now);
  const target = employee.dailyTargetMinutes;
  const pct = day.expectedMin > 0 ? day.completedMin / day.expectedMin * 100 : 0;
  const pctLabel = `${Number(Math.min(pct, 999).toFixed(2))}%`;
  const done = day.expectedMin > 0 && day.completedMin >= day.expectedMin;
  const exempt = day.expectedMin === 0;
  const approaching = !done && !exempt && day.remainingMin <= ctx.settings.approachingWarningMinutes && day.completedMin > 0;

  return (
    <section className="rounded-xl border border-line bg-white shadow-card" aria-labelledby="daily-target-heading">
      <div className={cn('rounded-t-xl px-5 pb-5 pt-4', done && 'bg-ok-bg/60')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="daily-target-heading" className="text-sm font-medium text-ink-muted">{fmtDate(today, 'EEEE, d MMMM yyyy')}</h2>
          <StatusBadge status={day.status} />
        </div>

        {exempt ?
        <div className="mt-4">
            <p className="text-2xl font-semibold text-ink">
              {day.holiday ? day.holiday.name : day.leave ? `${day.leave.type} Leave` : 'Non-working day'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              No working-hour target applies today{day.holiday ? ' — it’s a recognised holiday' : day.leave ? ' — your leave is approved' : ' under your schedule'}.
              {day.completedMin > 0 && ` You’ve logged ${fmtMin(day.completedMin)}.`}
            </p>
          </div> :

        <>
            <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-ink-muted">Completed</p>
                <p className="text-4xl font-semibold tracking-tight text-ink tnum">{fmtMin(day.completedMin)}</p>
              </div>
              <div className="flex gap-8 pb-1">
                <div>
                  <p className="text-xs text-ink-muted">Daily target</p>
                  <p className="text-lg font-semibold text-ink-2 tnum">{fmtMin(target)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Remaining</p>
                  <p className={cn('text-lg font-semibold tnum', done ? 'text-ok' : 'text-ink-2')}>{fmtMin(day.remainingMin)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={pct} tone={done ? 'ok' : day.dayEnded ? 'bad' : approaching ? 'warn' : 'brand'} label="Progress toward daily target" />
              <span className="w-16 shrink-0 text-right text-sm font-medium text-ink-2 tnum">{pctLabel}</span>
            </div>
            <p className={cn('mt-3 flex items-center gap-1.5 text-sm', done ? 'font-medium text-ok' : day.dayEnded ? 'text-bad' : approaching ? 'text-warn' : 'text-ink-muted')}>
              {done ?
            <><CheckCircle2Icon className="h-4 w-4" /> Daily Target Completed{day.excessMin > 0 && ` · ${fmtMin(day.excessMin)} over`}</> :
            day.dayEnded ?
            <>The day has ended {fmtMin(day.shortfallMin)} below target. Management will review this day.</> :
            approaching ?
            <>Almost there — {fmtMin(day.remainingMin)} to go.</> :

            <>{fmtMin(day.remainingMin)} to go. You can work at any time of the day — paused time isn’t counted, and the target must be met before the day ends ({ctx.settings.dayEndTime}).</>
            }
            </p>
            {day.pendingLeave && <p className="mt-2 text-xs text-warn">You have a pending leave request for today. It doesn’t change today’s target until approved.</p>}
          </>
        }
      </div>
      {showTimer &&
      <div className="border-t border-line px-5 py-5">
          <TimerPanel employee={employee} />
        </div>
      }
    </section>);

}