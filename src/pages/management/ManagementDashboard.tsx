import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, startOfMonth, subMonths } from 'date-fns';
import { ChevronRightIcon } from 'lucide-react';
import { DayDetailDrawer } from '../../components/compliance/DayDetailDrawer';
import { ShortfallDrawer } from '../../components/compliance/ShortfallDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Avatar, PageHeader, Panel, Segmented } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { isPendingReview, useShortfallDays } from '../../hooks/useShortfallDays';
import { computeDay } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { monthLabel } from '@shared/domain/payroll';
import { getRun } from '@shared/domain/payrollMutations';
import { fmtDate, fmtMin, fromDateKey, toDateKey, todayKey } from '@shared/domain/time';

export function ManagementDashboard() {
  const { user } = useAuth();
  const { state, ctx, team } = useData();
  const now = useNow(30000);
  const today = todayKey(now);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [detail, setDetail] = useState<DayCompliance | null>(null);
  const [review, setReview] = useState<DayCompliance | null>(null);
  const shortfalls = useShortfallDays();

  const active = state.employees.filter((e) => e.status === 'Active');
  const days = useMemo(() => active.map((e) => computeDay(ctx, e, today, now)), [active, ctx, today, now]);
  const liveSessions = state.sessions.filter((s) => s.date === today);
  const timerOf = (id: string) => liveSessions.find((s) => s.employeeId === id && s.status === 'Working') ? 'Working' : liveSessions.find((s) => s.employeeId === id && s.status === 'Paused') ? 'Paused' : 'Idle';

  const seg = {
    done: days.filter((d) => d.status === 'Target Completed').length,
    progress: days.filter((d) => d.status === 'In Progress').length,
    notStarted: days.filter((d) => d.status === 'Not Started').length,
    below: days.filter((d) => d.status === 'Below Target at Day End' || d.status === 'Not Recorded' || d.status === 'Needs Review').length,
    off: days.filter((d) => d.expectedMin === 0 || d.status === 'Approved Exception').length
  };
  const workingToday = days.filter((d) => d.sessions.length > 0).length;
  const activeTimers = liveSessions.filter((s) => s.status === 'Working').length;
  const pausedTimers = liveSessions.filter((s) => s.status === 'Paused').length;
  const pendingTs = state.timesheets.filter((t) => t.status === 'Submitted' || t.status === 'Under Review').length;
  const pendingLeave = state.leaves.filter((l) => l.status === 'Pending Approval').length;
  const in30 = toDateKey(addDays(fromDateKey(today), 30));
  const nextHolidays = state.holidays.filter((h) => h.status === 'Published' && h.date >= today && h.date <= in30).sort((a, b) => a.date < b.date ? -1 : 1);
  const pendingShortfalls = shortfalls.filter(isPendingReview);
  const correctionRequested = shortfalls.filter((d) => d.review?.status === 'Correction Requested').length;
  const prevMonth = format(startOfMonth(subMonths(fromDateKey(today), 1)), 'yyyy-MM');
  const run = getRun(state, prevMonth);
  const payrollReview = ['Draft', 'Needs Review', 'Calculated'].includes(run.status);
  const payslipsAwaiting = state.payslips.filter((p) => p.status === 'Generated').length + (run.status === 'Salary Credited' ? 1 : 0);
  const ended = days.some((d) => d.dayEnded);

  const rows = filter === 'all' ? days : days.filter((d) => d.status === 'Below Target at Day End' || d.status === 'Not Recorded' || d.status === 'Needs Review' || d.status === 'Not Started' && ended);
  const total = Math.max(active.length, 1);
  const bar = [
  { k: 'Target completed', n: seg.done, c: 'bg-ok' },
  { k: 'In progress', n: seg.progress, c: 'bg-brand-500' },
  { k: 'Not started', n: seg.notStarted, c: 'bg-line-strong' },
  { k: 'Below target at day end', n: seg.below, c: 'bg-bad' },
  { k: 'Leave / holiday / exception', n: seg.off, c: 'bg-info' }];


  const actions = [
  { label: 'Shortfalls awaiting review', n: pendingShortfalls.length, to: '/management/attendance/shortfalls', tone: 'bad' },
  { label: 'Time-log corrections pending', n: correctionRequested, to: '/management/attendance/shortfalls', tone: 'warn' },
  { label: 'Timesheets awaiting approval', n: pendingTs, to: '/management/timesheets', tone: 'warn' },
  { label: 'Leave requests awaiting approval', n: pendingLeave, to: '/management/leaves/requests', tone: 'warn' },
  { label: 'Late logins today (>10:15)', n: (( (state as any).users || []).filter((u:any)=>u.lateLoginAt && String(u.lateLoginAt).startsWith(today)).length + ((state as any).lateLogins || []).filter((l:any)=>l.lateLoginAt && String(l.lateLoginAt).startsWith(today)).length), to: '/management/attendance/live', tone: 'warn' },
  ...(user?.canManagePayroll ?
  [
  { label: `${monthLabel(prevMonth)} payroll · ${run.status}`, n: payrollReview ? 1 : 0, to: '/management/payroll', tone: 'warn' },
  { label: 'Payslips awaiting generation or release', n: payslipsAwaiting, to: '/management/payslips', tone: 'info' }] :

  [])];


  return (
    <div>
      <PageHeader title="Dashboard" description={`${fmtDate(today, 'EEEE, d MMMM yyyy')} · Day ends at ${state.settings.dayEndTime} (${state.settings.timezone}) · employees may work at any time of the day`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Today’s working hours" description={ended ? 'The day has ended — shortfalls below are final pending review.' : 'Shortfalls aren’t final until the day ends. Employees still working show as in progress.'} className="lg:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tracking-tight tnum">{seg.done}<span className="text-xl font-normal text-ink-muted"> / {active.length}</span></p>
              <p className="text-sm text-ink-muted">employees have completed the {fmtMin(state.settings.dailyTargetMinutes)} target</p>
            </div>
            <div className="text-right text-sm">
              <p><span className="font-semibold tnum">{workingToday}</span> <span className="text-ink-muted">working today</span></p>
              <p><span className="font-semibold tnum">{activeTimers}</span> <span className="text-ink-muted">active ·</span> <span className="font-semibold tnum">{pausedTimers}</span> <span className="text-ink-muted">paused timers</span></p>
            </div>
          </div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-canvas" aria-hidden>
            {bar.map((b) => b.n > 0 && <div key={b.k} className={b.c} style={{ width: `${b.n / total * 100}%` }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {bar.map((b) => <li key={b.k} className="flex items-center gap-1.5 text-xs text-ink-muted"><span className={cn('h-2 w-2 rounded-full', b.c)} />{b.k} <span className="font-semibold text-ink tnum">{b.n}</span></li>)}
          </ul>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-ink-muted">Total employees</dt><dd className="font-semibold tnum">{active.length}</dd></div>
            <div><dt className="text-xs text-ink-muted">Pending timesheets</dt><dd className="font-semibold tnum">{pendingTs}</dd></div>
            <div><dt className="text-xs text-ink-muted">Pending leave</dt><dd className="font-semibold tnum">{pendingLeave}</dd></div>
            <div><dt className="text-xs text-ink-muted">Holidays (next 30 days)</dt><dd className="truncate font-semibold">{nextHolidays.length ? `${nextHolidays[0].name} · ${fmtDate(nextHolidays[0].date, 'd MMM')}` : 'None'}</dd></div>
          </dl>
        </Panel>

        <Panel title="Action centre" flush className="self-start">
          <ul className="divide-y divide-line">
            {actions.map((a) =>
            <li key={a.label}>
                <Link to={a.to} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-canvas">
                  <span className={cn('text-sm', a.n ? 'font-medium text-ink' : 'text-ink-muted')}>{a.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn('min-w-[24px] rounded-full px-2 text-center text-xs font-semibold tnum', !a.n ? 'bg-canvas text-ink-muted' : a.tone === 'bad' ? 'bg-bad-bg text-bad' : a.tone === 'info' ? 'bg-info-bg text-info' : 'bg-warn-bg text-warn')}>{a.n}</span>
                    <ChevronRightIcon className="h-4 w-4 text-ink-faint" />
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Daily working-hours compliance" className="mt-6" flush
      actions={<Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'attention', label: 'Needs attention' }]} />}>
        <Table>
          <thead><tr><Th>Employee</Th><Th>Team</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Remaining</Th><Th align="right">Shortfall</Th><Th>Timer</Th><Th>Compliance</Th><Th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={9} className="py-10 text-center text-ink-muted">Nothing needs attention right now.</Td></tr>}
            {rows.map((d) => {
              const e = active.find((x) => x.id === d.employeeId)!;
              return (
                <Tr key={d.employeeId} onClick={() => setDetail(d)}>
                  <Td><div className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{e.designation}</p></div></div></Td>
                  <Td className="whitespace-nowrap text-ink-muted">{team(e.teamId)?.name}</Td>
                  <Td align="right">{fmtMin(d.expectedMin)}</Td>
                  <Td align="right" className="font-medium">{fmtMin(d.completedMin)}</Td>
                  <Td align="right">{d.dayEnded ? '—' : fmtMin(d.remainingMin)}</Td>
                  <Td align="right" className={d.isShortfall ? 'font-medium text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
                  <Td><StatusBadge status={timerOf(e.id)} /></Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td align="right"><span className="text-sm font-medium text-brand-700">View</span></Td>
                </Tr>);

            })}
          </tbody>
        </Table>
      </Panel>

      <DayDetailDrawer day={detail} onClose={() => setDetail(null)} onReview={(d) => {setDetail(null);setReview(d);}} />
      <ShortfallDrawer day={review} onClose={() => setReview(null)} />
    </div>);

}