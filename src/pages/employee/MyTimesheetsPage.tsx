import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { SendIcon } from 'lucide-react';
import { DateStepper } from '../../components/shared/DateStepper';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Banner, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import { computeDay } from '@shared/domain/compliance';
import { fmtDate, fmtDateTime, fmtMin, fromDateKey, sessionActiveMs, toDateKey, todayKey, weekDates, weekStartKey, MINUTE } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

export function MyTimesheetsPage() {
  const emp = useCurrentEmployee();
  const { state, ctx, project, task } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const [ws, setWs] = useState(() => toDateKey(addDays(fromDateKey(weekStartKey(today)), -7)));
  const { mutate, pending, error } = useMutation();
  const dates = weekDates(ws);
  const days = dates.map((d) => computeDay(ctx, emp, d, now));
  const ts = state.timesheets.find((t) => t.employeeId === emp.id && t.weekStart === ws);
  const status = ts?.status ?? 'Draft';
  const weekEnded = dates[6] < today;
  const incomplete = days.flatMap((d) => d.sessions.filter((s) => s.status === 'Interrupted' || (s.status === 'Working' || s.status === 'Paused') && s.date < today));
  const total = days.reduce((a, d) => a + d.completedMin, 0);
  const expected = days.reduce((a, d) => a + d.expectedMin, 0);
  const lastNote = ts ? [...ts.history].reverse().find((h) => h.note) : undefined;

  const breakdown = useMemo(() => {
    const map = new Map<string, {min: number;tasks: Map<string, number>;}>();
    for (const d of days)
    for (const s of d.sessions) {
      const m = Math.floor(sessionActiveMs(s, now) / MINUTE);
      const p = map.get(s.projectId) ?? { min: 0, tasks: new Map() };
      p.min += m;
      p.tasks.set(s.taskId, (p.tasks.get(s.taskId) ?? 0) + m);
      map.set(s.projectId, p);
    }
    return [...map.entries()].sort((a, b) => b[1].min - a[1].min);
  }, [days, now]);

  const canSubmit = weekEnded && !incomplete.length && (status === 'Draft' || status === 'Changes Requested');
  const blockReason = !weekEnded ? 'You can submit once the week has ended.' : incomplete.length ? 'Resolve incomplete sessions before submitting.' : null;

  return (
    <div>
      <PageHeader
        title="My Timesheets"
        description="Review your week and submit it for management approval."
        actions={canSubmit && <Button icon={SendIcon} loading={pending} onClick={() => mutate(cmd.submitTimesheet(ws), 'Timesheet submitted')}>{status === 'Changes Requested' ? 'Resubmit timesheet' : 'Submit timesheet'}</Button>} />
      
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateStepper label={`${fmtDate(ws, 'd MMM')} – ${fmtDate(dates[6], 'd MMM yyyy')}`} onPrev={() => setWs(toDateKey(addDays(fromDateKey(ws), -7)))} onNext={() => setWs(toDateKey(addDays(fromDateKey(ws), 7)))} nextDisabled={ws >= weekStartKey(today)} />
        <div className="flex items-center gap-2 text-sm"><span className="text-ink-muted">Status</span><StatusBadge status={status} /></div>
      </div>

      <div className="space-y-4">
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
        {status === 'Changes Requested' && lastNote && <Banner tone="warn" title="Changes requested">{lastNote.note} — {lastNote.by}</Banner>}
        {incomplete.length > 0 && <Banner tone="warn" title={`${incomplete.length} incomplete session(s)`}>Sessions without an end time are excluded from totals. Flag them from the Time Tracker or request a correction from My Attendance.</Banner>}
        {!canSubmit && blockReason && status === 'Draft' && <Banner tone="neutral">{blockReason}</Banner>}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Panel title="Daily hours" description={`${fmtMin(total)} completed of ${fmtMin(expected)} expected`} className="lg:col-span-2" flush>
          <Table>
            <thead><tr><Th>Day</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th>Status</Th></tr></thead>
            <tbody>
              {days.map((d) =>
              <Tr key={d.date}>
                  <Td className="whitespace-nowrap font-medium">{fmtDate(d.date, 'EEE d MMM')}</Td>
                  <Td align="right">{fmtMin(d.expectedMin)}</Td>
                  <Td align="right" className="font-medium">{fmtMin(d.completedMin)}</Td>
                  <Td align="right" className={d.isShortfall ? 'text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
                  <Td><StatusBadge status={d.status} /></Td>
                </Tr>
              )}
              <tr className="bg-canvas/60 font-semibold">
                <Td>Weekly total</Td><Td align="right">{fmtMin(expected)}</Td><Td align="right">{fmtMin(total)}</Td>
                <Td align="right" className="text-bad">{fmtMin(days.reduce((a, d) => a + (d.isShortfall ? d.shortfallMin : 0), 0))}</Td><Td />
              </tr>
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-6">
          <Panel title="Project & task breakdown">
            {breakdown.length === 0 ? <p className="text-sm text-ink-muted">No time recorded this week.</p> :
            <ul className="space-y-4">
                {breakdown.map(([pid, p]) =>
              <li key={pid}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{project(pid)?.name}</p>
                      <p className="text-sm font-semibold tnum">{fmtMin(p.min)}</p>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {[...p.tasks.entries()].map(([tid, m]) =>
                  <li key={tid} className="flex justify-between gap-2 text-xs text-ink-muted"><span className="truncate">{task(tid)?.title}</span><span className="tnum">{fmtMin(m)}</span></li>
                  )}
                    </ul>
                  </li>
              )}
              </ul>
            }
          </Panel>
          <Panel title="Submission history">
            {!ts?.history.length ? <p className="text-sm text-ink-muted">Not submitted yet.</p> :
            <ol className="space-y-3">
                {[...ts.history].reverse().map((h, i) =>
              <li key={i} className="text-sm">
                    <p className="font-medium">{h.action} <span className="font-normal text-ink-muted">by {h.by}</span></p>
                    <p className="text-xs text-ink-faint">{fmtDateTime(h.at)}</p>
                    {h.note && <p className="mt-0.5 text-xs text-ink-2">{h.note}</p>}
                  </li>
              )}
              </ol>
            }
          </Panel>
        </div>
      </div>
    </div>);

}