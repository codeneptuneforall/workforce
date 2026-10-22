import { useState } from 'react';
import { addDays } from 'date-fns';
import { CalcGrid } from '../../components/shared/DayBreakdown';
import { DateStepper } from '../../components/shared/DateStepper';
import { SessionsTable } from '../../components/shared/SessionsTable';
import { StatusBadge } from '../../components/ui/Badge';
import { Banner, PageHeader, Panel, Segmented } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useNow } from '../../hooks/useNow';
import { computeDay } from '@shared/domain/compliance';
import { fmtDate, fmtMin, fromDateKey, sessionPausedMs, toDateKey, todayKey, weekDates, weekStartKey, MINUTE } from '@shared/domain/time';

export function WorkLogsPage() {
  const emp = useCurrentEmployee();
  const { ctx } = useData();
  const now = useNow(30000);
  const today = todayKey(now);
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [date, setDate] = useState(today);
  const shift = (n: number) => setDate((d) => toDateKey(addDays(fromDateKey(d), n)));
  const day = computeDay(ctx, emp, date, now);
  const ws = weekStartKey(date);
  const week = weekDates(ws).map((d) => computeDay(ctx, emp, d, now));
  const totals = week.reduce((a, d) => ({ c: a.c + d.completedMin, e: a.e + d.expectedMin, s: a.s + (d.isShortfall ? d.shortfallMin : 0) }), { c: 0, e: 0, s: 0 });

  return (
    <div>
      <PageHeader
        title="My Work Logs"
        description="Every session you’ve recorded, with active and paused time."
        actions={<Segmented label="View" value={view} onChange={setView} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />} />
      
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {view === 'daily' ?
        <DateStepper label={fmtDate(date, 'EEE, d MMM yyyy')} onPrev={() => shift(-1)} onNext={() => shift(1)} nextDisabled={date >= today} onToday={date !== today ? () => setDate(today) : undefined} /> :

        <DateStepper label={`${fmtDate(ws, 'd MMM')} – ${fmtDate(weekDates(ws)[6], 'd MMM yyyy')}`} onPrev={() => shift(-7)} onNext={() => shift(7)} nextDisabled={weekDates(ws)[6] >= today} />
        }
        {view === 'daily' && <StatusBadge status={day.status} />}
      </div>

      {view === 'daily' ?
      <div className="space-y-4">
          <CalcGrid items={[
        { label: 'Expected', value: fmtMin(day.expectedMin) },
        { label: 'Completed', value: fmtMin(day.completedMin) },
        { label: day.dayEnded ? 'Shortfall' : 'Remaining', value: fmtMin(day.shortfallMin), tone: day.isShortfall ? 'bad' : undefined },
        { label: 'Paused', value: fmtMin(day.sessions.reduce((a, s) => a + Math.floor(sessionPausedMs(s, now) / MINUTE), 0)), tone: 'muted' }]
        } />
          {day.isShortfall && <Banner tone="warn" title="This day is below target">If your time log is wrong or missing, request a correction from My Attendance. Management reviews every shortfall.</Banner>}
          <Panel flush>
            <SessionsTable sessions={day.sessions} emptyTitle="No sessions on this day" emptyBody={day.expectedMin === 0 ? 'No target applied on this day.' : undefined} />
          </Panel>
        </div> :

      <Panel flush>
          <Table>
            <thead>
              <tr><Th>Day</Th><Th align="right">Sessions</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {week.map((d) =>
            <Tr key={d.date} onClick={() => {setDate(d.date);setView('daily');}}>
                  <Td className="whitespace-nowrap font-medium">{fmtDate(d.date, 'EEE d MMM')}</Td>
                  <Td align="right">{d.sessions.length}</Td>
                  <Td align="right">{fmtMin(d.expectedMin)}</Td>
                  <Td align="right" className="font-medium">{fmtMin(d.completedMin)}</Td>
                  <Td align="right" className={d.isShortfall ? 'text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
                  <Td><StatusBadge status={d.status} /></Td>
                </Tr>
            )}
              <tr className="bg-canvas/60 font-semibold">
                <Td>Week total</Td><Td /><Td align="right">{fmtMin(totals.e)}</Td><Td align="right">{fmtMin(totals.c)}</Td><Td align="right" className={totals.s ? 'text-bad' : ''}>{totals.s ? fmtMin(totals.s) : '—'}</Td><Td />
              </tr>
            </tbody>
          </Table>
        </Panel>
      }
    </div>);

}