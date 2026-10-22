import type { DayCompliance } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtDate, fmtMin } from '@shared/domain/time';

export function WeekBars({ days, today }: {days: DayCompliance[];today: string;}) {
  const max = Math.max(600, ...days.map((d) => d.completedMin));
  const targetLine = days.find((d) => d.expectedMin > 0)?.expectedMin ?? 480;
  return (
    <div>
      <div className="relative flex h-40 items-end gap-2 sm:gap-3">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brand-300" style={{ bottom: `${targetLine / max * 100}%` }}>
          <span className="absolute -top-4 right-0 bg-white pl-1 text-[10px] text-brand-700">{fmtMin(targetLine)} target</span>
        </div>
        {days.map((d) => {
          const h = d.completedMin / max * 100;
          const met = d.expectedMin > 0 && d.completedMin >= d.expectedMin;
          const short = d.isShortfall;
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${fmtDate(d.date, 'EEE d MMM')}: ${fmtMin(d.completedMin)}`}>
              <div
                className={cn('w-full rounded-t-md', d.expectedMin === 0 ? 'bg-line' : met ? 'bg-ok/80' : short ? 'bg-bad/70' : 'bg-brand-400')}
                style={{ height: `${Math.max(h, d.completedMin > 0 ? 3 : 0)}%` }} />
              
            </div>);

        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {days.map((d) =>
        <div key={d.date} className="flex-1 text-center">
            <p className={cn('text-xs', d.date === today ? 'font-semibold text-brand-700' : 'text-ink-muted')}>{fmtDate(d.date, 'EEE')}</p>
            <p className="text-[11px] text-ink-2 tnum">{d.completedMin ? fmtMin(d.completedMin) : d.holiday ? 'Holiday' : d.leave ? 'Leave' : '—'}</p>
          </div>
        )}
      </div>
    </div>);

}