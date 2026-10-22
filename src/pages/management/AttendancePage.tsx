import { useMemo, useState } from 'react';
import { addDays, addMonths, format } from 'date-fns';
import { AlertTriangleIcon } from 'lucide-react';
import { DayDetailDrawer } from '../../components/compliance/DayDetailDrawer';
import { ShortfallDrawer } from '../../components/compliance/ShortfallDrawer';
import { DateStepper } from '../../components/shared/DateStepper';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { PageHeader, Panel, Segmented, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { isPendingReview, useShortfallDays } from '../../hooks/useShortfallDays';
import { adjustmentLabel, attendanceStatus, computeDay } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtDate, fmtMin, fmtTime, fromDateKey, monthDates, toDateKey, todayKey, weekDates, weekStartKey } from '@shared/domain/time';

type Period = 'daily' | 'weekly' | 'monthly';
type StatusFilter = 'all' | 'completed' | 'below' | 'pending' | 'exception' | 'adjusted';

const statusFilters: {value: StatusFilter;label: string;}[] = [
{ value: 'all', label: 'All statuses' },
{ value: 'completed', label: 'Completed target' },
{ value: 'below', label: 'Below target' },
{ value: 'pending', label: 'Pending review' },
{ value: 'exception', label: 'Approved exception' },
{ value: 'adjusted', label: 'Manually adjusted' }];


function matches(d: DayCompliance, f: StatusFilter) {
  switch (f) {
    case 'completed':return d.status === 'Target Completed';
    case 'below':return d.isShortfall;
    case 'pending':return d.isShortfall && isPendingReview(d);
    case 'exception':return d.status === 'Approved Exception' || d.review?.status === 'Waived';
    case 'adjusted':return d.review?.status === 'Adjusted';
    default:return true;
  }
}

export function AttendancePage() {
  const { state, ctx, team } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const [tab, setTab] = useState<'attendance' | 'compliance'>('attendance');
  const [period, setPeriod] = useState<Period>('daily');
  const [date, setDate] = useState(today);
  const [teamId, setTeamId] = useState('');
  const [empId, setEmpId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [detail, setDetail] = useState<DayCompliance | null>(null);
  const [review, setReview] = useState<DayCompliance | null>(null);
  const pending = useShortfallDays().filter(isPendingReview).length;

  const dates = period === 'daily' || tab === 'attendance' ? [date] : period === 'weekly' ? weekDates(weekStartKey(date)) : monthDates(date.slice(0, 7)).filter((d) => d <= today);
  const emps = state.employees.filter((e) => (e.status === 'Active' || state.sessions.some((s) => s.employeeId === e.id && dates.includes(s.date))) && (!teamId || e.teamId === teamId) && (!empId || e.id === empId));
  const filteredEmps = projectId ? emps.filter((e) => state.sessions.some((s) => s.employeeId === e.id && s.projectId === projectId && dates.includes(s.date))) : emps;

  const grid = useMemo(() => filteredEmps.map((e) => ({ e, days: dates.map((d) => computeDay(ctx, e, d, now)) })), [filteredEmps, dates, ctx, now]);
  const dailyRows = grid.map((g) => g.days[0]).filter((d) => matches(d, statusF));
  const aggRows = grid.
  map(({ e, days }) => {
    const sched = days.filter((d) => d.expectedMin > 0);
    const ended = sched.filter((d) => d.dayEnded);
    return {
      e,
      days,
      scheduled: sched.length,
      expected: sched.reduce((a, d) => a + d.expectedMin, 0),
      completed: days.reduce((a, d) => a + d.completedMin, 0),
      shortfall: days.reduce((a, d) => a + (d.isShortfall ? d.shortfallMin : 0), 0),
      met: ended.filter((d) => d.status === 'Target Completed').length,
      below: days.filter((d) => d.isShortfall).length,
      exceptions: days.filter((d) => matches(d, 'exception')).length,
      adjusted: days.filter((d) => matches(d, 'adjusted')).length,
      ended: ended.length
    };
  }).
  filter((r) => statusF === 'all' || r.days.some((d) => matches(d, statusF)));

  const step = (n: number) => {
    if (tab === 'attendance' || period === 'daily') setDate((d) => toDateKey(addDays(fromDateKey(d), n)));else
    if (period === 'weekly') setDate((d) => toDateKey(addDays(fromDateKey(d), 7 * n)));else
    setDate((d) => toDateKey(addMonths(fromDateKey(d), n)));
  };
  const label = tab === 'attendance' || period === 'daily' ? fmtDate(date, 'EEE, d MMM yyyy') : period === 'weekly' ? `${fmtDate(weekStartKey(date), 'd MMM')} – ${fmtDate(weekDates(weekStartKey(date))[6], 'd MMM yyyy')}` : format(fromDateKey(date), 'MMMM yyyy');
  const atEnd = tab === 'attendance' || period === 'daily' ? date >= today : period === 'weekly' ? weekDates(weekStartKey(date))[6] >= today : date.slice(0, 7) >= today.slice(0, 7);

  return (
    <div>
      <PageHeader title="Attendance & Working Hours" description="Attendance is evaluated against each employee’s schedule, holidays and approved leave — never from a timer alone."
      actions={<ButtonLink to="/management/attendance/shortfalls" variant={pending ? 'primary' : 'secondary'} icon={AlertTriangleIcon}>Shortfall review {pending > 0 && `(${pending})`}</ButtonLink>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'attendance', label: 'Daily attendance' }, { id: 'compliance', label: 'Working-hour compliance' }]} /></div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {tab === 'compliance' && <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />}
        <DateStepper label={label} onPrev={() => step(-1)} onNext={() => step(1)} nextDisabled={atEnd} onToday={date !== today ? () => setDate(today) : undefined} />
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">All employees</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select aria-label="Status" value={statusF} onChange={(e) => setStatusF(e.target.value as StatusFilter)}>{statusFilters.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
      </div>

      <Panel flush>
        {tab === 'attendance' || period === 'daily' ?
        <Table>
            <thead>
              <tr>
                <Th>Employee</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th>
                {tab === 'attendance' ? <><Th>First start</Th><Th>Last end</Th><Th>Attendance</Th><Th>Leave / holiday</Th><Th>Adjustment</Th></> : <><Th align="right">Remaining</Th><Th>Compliance</Th><Th>Review</Th></>}
              </tr>
            </thead>
            <tbody>
              {dailyRows.length === 0 && <tr><Td colSpan={9} className="py-10 text-center text-ink-muted">No records match these filters.</Td></tr>}
              {dailyRows.map((d) => {
              const e = state.employees.find((x) => x.id === d.employeeId)!;
              return (
                <Tr key={d.employeeId} onClick={() => setDetail(d)}>
                    <Td><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{team(e.teamId)?.name}</p></Td>
                    <Td align="right">{fmtMin(d.expectedMin)}</Td>
                    <Td align="right" className="font-medium">{fmtMin(d.completedMin)}</Td>
                    <Td align="right" className={d.isShortfall ? 'text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
                    {tab === 'attendance' ?
                  <>
                        <Td className="tnum">{d.firstStart ? fmtTime(new Date(d.firstStart).toISOString()) : '—'}</Td>
                        <Td className="tnum">{d.lastEnd ? fmtTime(new Date(d.lastEnd).toISOString()) : '—'}</Td>
                        <Td><StatusBadge status={attendanceStatus(d, state.settings)} /></Td>
                        <Td className="text-xs">{d.holiday ? d.holiday.name : d.leave ? `${d.leave.type} Leave (approved)` : d.pendingLeave ? <span className="text-warn">Leave pending</span> : '—'}</Td>
                        <Td>{adjustmentLabel(d) === '—' ? <span className="text-ink-muted">—</span> : <StatusBadge status={adjustmentLabel(d)} />}</Td>
                      </> :

                  <>
                        <Td align="right">{d.dayEnded ? '—' : fmtMin(d.remainingMin)}</Td>
                        <Td><StatusBadge status={d.status} /></Td>
                        <Td>{d.isShortfall ? <StatusBadge status={adjustmentLabel(d)} /> : <span className="text-ink-muted">—</span>}</Td>
                      </>
                  }
                  </Tr>);

            })}
            </tbody>
          </Table> :

        <Table>
            <thead><tr><Th>Employee</Th><Th align="right">Scheduled days</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th align="right">Days met</Th><Th align="right">Days below</Th><Th align="right">Exceptions</Th><Th align="right">Adjusted</Th><Th align="right">Completion rate</Th></tr></thead>
            <tbody>
              {aggRows.length === 0 && <tr><Td colSpan={10} className="py-10 text-center text-ink-muted">No records match these filters.</Td></tr>}
              {aggRows.map((r) =>
            <Tr key={r.e.id}>
                  <Td><p className="font-medium">{r.e.name}</p><p className="text-xs text-ink-muted">{team(r.e.teamId)?.name}</p></Td>
                  <Td align="right">{r.scheduled}</Td>
                  <Td align="right">{fmtMin(r.expected)}</Td>
                  <Td align="right" className="font-medium">{fmtMin(r.completed)}</Td>
                  <Td align="right" className={r.shortfall ? 'text-bad' : 'text-ink-muted'}>{r.shortfall ? fmtMin(r.shortfall) : '—'}</Td>
                  <Td align="right">{r.met}</Td>
                  <Td align="right" className={r.below ? 'text-bad' : ''}>{r.below}</Td>
                  <Td align="right">{r.exceptions}</Td>
                  <Td align="right">{r.adjusted}</Td>
                  <Td align="right" className="font-medium">{r.ended ? `${Math.round(r.met / r.ended * 100)}%` : '—'}</Td>
                </Tr>
            )}
            </tbody>
          </Table>
        }
      </Panel>

      <DayDetailDrawer day={detail} onClose={() => setDetail(null)} onReview={(d) => {setDetail(null);setReview(d);}} />
      <ShortfallDrawer day={review} onClose={() => setReview(null)} />
    </div>);

}