import { useData } from '../../contexts/DataContext';
import type { DayCompliance } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtMin, fmtTime, sessionActiveMs, MINUTE } from '@shared/domain/time';
import { StatusBadge } from '../ui/Badge';
import { Banner } from '../ui/Primitives';

export function CalcGrid({ items }: {items: {label: string;value: string;tone?: 'bad' | 'ok' | 'muted';}[];}) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line sm:grid-cols-4">
      {items.map((i, idx) =>
      <div key={i.label} className={cn('px-4 py-3', idx > 0 && 'border-l border-line', idx === 2 && 'border-l-0 border-t sm:border-l sm:border-t-0', idx === 3 && 'border-t sm:border-t-0')}>
          <dt className="text-xs text-ink-muted">{i.label}</dt>
          <dd className={cn('mt-0.5 text-base font-semibold tnum', i.tone === 'bad' ? 'text-bad' : i.tone === 'ok' ? 'text-ok' : i.tone === 'muted' ? 'text-ink-muted' : 'text-ink')}>{i.value}</dd>
        </div>
      )}
    </dl>);

}

export function DayBreakdown({ day }: {day: DayCompliance;}) {
  const { project, task } = useData();
  return (
    <div className="space-y-4">
      <CalcGrid
        items={[
        { label: 'Expected', value: fmtMin(day.expectedMin) },
        { label: 'Completed (valid active)', value: fmtMin(day.completedMin) },
        { label: day.dayEnded ? 'Shortfall' : 'Remaining', value: fmtMin(day.shortfallMin), tone: day.shortfallMin > 0 && day.dayEnded ? 'bad' : undefined },
        { label: 'Excess', value: fmtMin(day.excessMin), tone: 'muted' }]
        } />
      
      {day.holiday && <Banner tone="brand">{day.holiday.name} ({day.holiday.type} holiday) — no target applies.</Banner>}
      {day.leave && <Banner tone="info">Approved {day.leave.type} Leave — excluded from the daily target.</Banner>}
      {day.pendingLeave && <Banner tone="warn">A {day.pendingLeave.type} Leave request for this day is still pending. Pending leave is not treated as an exception.</Banner>}
      {day.hasIncomplete && <Banner tone="warn" title="Incomplete session">At least one session was never ended. Its open interval is excluded until corrected.</Banner>}
      {!day.dayEnded && day.expectedMin > 0 && <Banner tone="neutral">The day hasn’t ended yet. Remaining time is not yet a shortfall.</Banner>}

      <div>
        <p className="mb-2 text-xs font-medium text-ink-muted">Recorded sessions ({day.sessions.length})</p>
        {day.sessions.length === 0 ?
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No time was recorded on this day.</p> :

        <ul className="divide-y divide-line rounded-lg border border-line">
            {day.sessions.map((s) =>
          <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{task(s.taskId)?.title}</p>
                    <p className="text-xs text-ink-muted">{project(s.projectId)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tnum">{fmtMin(Math.floor(sessionActiveMs(s, Date.now()) / MINUTE))}</span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.intervals.map((iv, i) =>
              <span key={i} className={cn('rounded border px-1.5 py-0.5 text-xs tnum', iv.end ? 'border-line bg-canvas text-ink-2' : 'border-warn-line bg-warn-bg text-warn')}>
                      {fmtTime(iv.start)}–{iv.end ? fmtTime(iv.end) : s.status === 'Working' ? 'now' : 'no end'}
                    </span>
              )}
                </div>
                {s.notes && <p className="mt-2 text-xs text-ink-muted">{s.notes}</p>}
              </li>
          )}
          </ul>
        }
        <p className="mt-2 text-xs text-ink-faint">Completed = union of active intervals across all sessions. Paused gaps and overlaps are not counted; original timestamps are never rewritten.</p>
      </div>
    </div>);

}