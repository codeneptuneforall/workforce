import { useMemo, useState } from 'react';
import { addDays, format, startOfMonth, subMonths } from 'date-fns';
import { DownloadIcon, LockIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Banner, PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { usePayrollRecords } from '../../hooks/usePayrollRecords';
import { computeDay, holidayOn, isScheduled } from '@shared/domain/compliance';
import { downloadCsv } from '../../utils/csv';
import { fmtINR } from '@shared/domain/currency';
import { monthLabel } from '@shared/domain/payroll';
import { getRun } from '@shared/domain/payrollMutations';
import { eachDateKey, fmtDate, fmtMin, fromDateKey, monthDates, sessionActiveMs, toDateKey, todayKey, MINUTE } from '@shared/domain/time';

type Tab = 'time' | 'attendance' | 'payroll';

export function ReportsPage() {
  const { user } = useAuth();
  const { state, ctx, team, project, task, personName } = useData();
  const now = Date.now();
  const today = todayKey(now);
  const months = [0, 1, 2, 3].map((n) => format(startOfMonth(subMonths(fromDateKey(today), n)), 'yyyy-MM'));
  const [tab, setTab] = useState<Tab>('time');
  const [month, setMonth] = useState(months[0]);
  const [teamId, setTeamId] = useState('');
  const [empId, setEmpId] = useState('');
  const [projectId, setProjectId] = useState('');
  const canPay = !!user?.canManagePayroll;
  const dates = monthDates(month).filter((d) => d <= today);
  const emps = state.employees.filter((e) => (!teamId || e.teamId === teamId) && (!empId || e.id === empId) && (e.status === 'Active' || state.sessions.some((s) => s.employeeId === e.id && s.date.startsWith(month))));
  const payroll = usePayrollRecords(month);

  const timeRows = useMemo(() => emps.map((e) => {
    const days = dates.map((d) => computeDay(ctx, e, d, now));
    const ended = days.filter((d) => d.expectedMin > 0 && d.dayEnded);
    const met = ended.filter((d) => d.status === 'Target Completed').length;
    const latestTs = state.timesheets.filter((t) => t.employeeId === e.id).sort((a, b) => a.weekStart < b.weekStart ? 1 : -1)[0];
    return {
      e, expected: days.reduce((a, d) => a + d.expectedMin, 0), completed: days.reduce((a, d) => a + d.completedMin, 0),
      shortfall: days.reduce((a, d) => a + (d.isShortfall ? d.shortfallMin : 0), 0),
      exceptions: days.filter((d) => d.review?.status === 'Approved Exception' || d.review?.status === 'Waived').length,
      adjusted: days.filter((d) => d.review?.status === 'Adjusted').length,
      adjustedMin: days.reduce((a, d) => a + (d.review?.status === 'Adjusted' && d.review.adjustedPayableMinutes !== undefined ? d.review.adjustedPayableMinutes - d.completedMin : 0), 0),
      rate: ended.length ? Math.round(met / ended.length * 100) : null, ts: latestTs?.status ?? 'Draft',
      present: days.filter((d) => d.completedMin > 0).length, below: days.filter((d) => d.isShortfall).length,
      notRecorded: days.filter((d) => d.status === 'Not Recorded').length, leave: days.filter((d) => d.status === 'Approved Leave').length
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [emps, dates, ctx]);

  const projectBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    state.sessions.filter((s) => s.date.startsWith(month) && emps.some((e) => e.id === s.employeeId) && (!projectId || s.projectId === projectId)).
    forEach((s) => map.set(`${s.projectId}|${s.taskId}`, (map.get(`${s.projectId}|${s.taskId}`) ?? 0) + Math.floor(sessionActiveMs(s, now) / MINUTE)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions, month, emps, projectId]);

  const leaveRows = emps.map((e) => {
    const mine = state.leaves.filter((l) => l.employeeId === e.id);
    const count = (type: string) => mine.filter((l) => l.type === type && l.status === 'Approved').flatMap((l) => eachDateKey(l.startDate, l.endDate)).filter((d) => d.startsWith(month) && isScheduled(e, d, state.settings) && !holidayOn(d, state.holidays)).length;
    return { e, casual: count('Casual'), emergency: count('Emergency'), retro: mine.filter((l) => l.retrospective && l.submittedAt.startsWith(month)).length, pending: mine.filter((l) => l.status === 'Pending Approval').length };
  });
  const next14 = eachDateKey(today, toDateKey(addDays(fromDateKey(today), 13)));
  const away = state.leaves.filter((l) => l.status === 'Approved' && l.endDate >= today && l.startDate <= next14[13] && emps.some((e) => e.id === l.employeeId));
  const upcomingHolidays = state.holidays.filter((h) => h.status === 'Published' && h.date >= today).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 5);
  const run = getRun(state, month);
  const payRows = payroll.filter((r) => emps.some((e) => e.id === r.employee.id)).map((r) => {
    const slip = state.payslips.filter((p) => p.employeeId === r.employee.id && p.month === month && p.status !== 'Superseded').sort((a, b) => b.version - a.version)[0];
    const d = slip?.data;
    const shortfallDed = d ? d.deductions.find((x) => x.label === 'Working-Hour Shortfall Deduction')?.amount ?? 0 : r.shortfall.approvedDeduction;
    const lop = d ? d.deductions.find((x) => x.label === 'Leave / LOP')?.amount ?? 0 : r.lopAmount;
    const overrides = Object.values(state.reviews).filter((v) => v.employeeId === r.employee.id && v.date.startsWith(month) && ['Adjusted', 'Waived', 'Approved Exception'].includes(v.status)).length;
    return { r, gross: d?.gross ?? r.gross, ded: d?.totalDeduction ?? r.totalDeduction, shortfallDed, lop, overrides, take: d?.takeHome ?? r.takeHome, slip };
  });

  const exportTime = () => downloadCsv(`time-compliance-${month}.csv`, [['Employee', 'Team', 'Expected (h)', 'Completed (h)', 'Shortfall (h)', 'Approved exceptions', 'Manually adjusted days', 'Target completion %', 'Latest timesheet'], ...timeRows.map((t) => [t.e.name, team(t.e.teamId)?.name, (t.expected / 60).toFixed(2), (t.completed / 60).toFixed(2), (t.shortfall / 60).toFixed(2), t.exceptions, t.adjusted, t.rate ?? '', t.ts])]);
  const exportLeave = () => downloadCsv(`attendance-leave-${month}.csv`, [['Employee', 'Days present', 'Target completed %', 'Days below target', 'Not recorded', 'Approved leave days', 'Casual Leave', 'Emergency Leave', 'Retrospective requests'], ...timeRows.map((t, i) => [t.e.name, t.present, t.rate ?? '', t.below, t.notRecorded, t.leave, leaveRows[i]?.casual, leaveRows[i]?.emergency, leaveRows[i]?.retro])]);
  const exportPay = () => downloadCsv(`payroll-${month}.csv`, [['Employee', 'Code', 'Gross', 'Total deductions', 'Shortfall deduction', 'Leave/LOP', 'Management overrides', 'Take-home', 'Salary credit', 'Payslip'], ...payRows.map((p) => [p.r.employee.name, p.r.employee.code, p.gross, p.ded, p.shortfallDed, p.lop, p.overrides, p.take, run.creditDate ? `Credited ${run.creditDate}` : 'Not credited', p.slip?.status ?? 'Not generated'])]);

  return (
    <div>
      <PageHeader title="Reports" description="Filter, review and export. Exports download as CSV, which opens in Excel." />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'time', label: 'Time & compliance' }, { id: 'attendance', label: 'Attendance & leave' }, { id: 'payroll', label: 'Payroll' }]} /></div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">All employees</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>

      {tab === 'time' &&
      <div className="space-y-6">
          <Panel title="Expected vs completed hours" flush actions={<Button size="sm" variant="secondary" icon={DownloadIcon} onClick={exportTime}>Export CSV</Button>}>
            <Table>
              <thead><tr><Th>Employee</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th align="right">Exceptions</Th><Th align="right">Adjusted</Th><Th align="right">Completion rate</Th><Th>Latest timesheet</Th></tr></thead>
              <tbody>{timeRows.map((t) =>
              <Tr key={t.e.id}><Td><p className="font-medium">{t.e.name}</p><p className="text-xs text-ink-muted">{team(t.e.teamId)?.name}</p></Td><Td align="right">{fmtMin(t.expected)}</Td><Td align="right" className="font-medium">{fmtMin(t.completed)}</Td><Td align="right" className={t.shortfall ? 'text-bad' : 'text-ink-muted'}>{fmtMin(t.shortfall)}</Td><Td align="right">{t.exceptions}</Td><Td align="right">{t.adjusted}{t.adjustedMin > 0 && <span className="text-xs text-ink-muted"> (+{fmtMin(t.adjustedMin)})</span>}</Td><Td align="right" className="font-medium">{t.rate === null ? '—' : `${t.rate}%`}</Td><Td><StatusBadge status={t.ts} /></Td></Tr>
              )}</tbody>
            </Table>
          </Panel>
          <Panel title="Project & task breakdown" flush>
            <Table>
              <thead><tr><Th>Project</Th><Th>Task</Th><Th align="right">Hours</Th></tr></thead>
              <tbody>{projectBreakdown.length === 0 && <tr><Td colSpan={3} className="py-8 text-center text-ink-muted">No time logged for these filters.</Td></tr>}{projectBreakdown.map(([k, m]) => {const [pid, tid] = k.split('|');return <Tr key={k}><Td>{project(pid)?.name}</Td><Td>{task(tid)?.title}</Td><Td align="right" className="font-medium">{fmtMin(m)}</Td></Tr>;})}</tbody>
            </Table>
          </Panel>
        </div>
      }

      {tab === 'attendance' &&
      <div className="space-y-6">
          <Panel title="Attendance & leave summary" flush actions={<Button size="sm" variant="secondary" icon={DownloadIcon} onClick={exportLeave}>Export CSV</Button>}>
            <Table>
              <thead><tr><Th>Employee</Th><Th align="right">Days present</Th><Th align="right">Below target</Th><Th align="right">Not recorded</Th><Th align="right">Casual Leave</Th><Th align="right">Emergency Leave</Th><Th align="right">Retrospective</Th><Th align="right">Pending</Th></tr></thead>
              <tbody>{timeRows.map((t, i) =>
              <Tr key={t.e.id}><Td className="font-medium">{t.e.name}</Td><Td align="right">{t.present}</Td><Td align="right" className={t.below ? 'text-bad' : ''}>{t.below}</Td><Td align="right">{t.notRecorded}</Td><Td align="right">{leaveRows[i]?.casual}</Td><Td align="right">{leaveRows[i]?.emergency}</Td><Td align="right" className={leaveRows[i]?.retro ? 'text-warn' : ''}>{leaveRows[i]?.retro}</Td><Td align="right">{leaveRows[i]?.pending}</Td></Tr>
              )}</tbody>
            </Table>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Team availability · next 14 days">
              {away.length === 0 ? <p className="text-sm text-ink-muted">Everyone is available.</p> : <ul className="space-y-2">{away.map((l) => <li key={l.id} className="flex justify-between text-sm"><span>{personName(l.employeeId)}</span><span className="text-ink-muted">{l.type} · {fmtDate(l.startDate, 'd MMM')}–{fmtDate(l.endDate, 'd MMM')}</span></li>)}</ul>}
            </Panel>
            <Panel title="Upcoming holidays">
              <ul className="space-y-2">{upcomingHolidays.map((h) => <li key={h.id} className="flex justify-between text-sm"><span>{h.name}</span><span className="text-ink-muted">{fmtDate(h.date, 'EEE d MMM yyyy')}</span></li>)}</ul>
            </Panel>
          </div>
        </div>
      }

      {tab === 'payroll' && (!canPay ?
      <Banner tone="neutral" title="Restricted"><span className="flex items-center gap-1.5"><LockIcon className="h-3.5 w-3.5" /> Payroll reports are available only to authorised payroll managers.</span></Banner> :

      <Panel title={`Payroll · ${monthLabel(month)}`} description={`Payroll status: ${run.status}${run.creditDate ? ` · credited ${fmtDate(run.creditDate)}` : ''}`} flush actions={<Button size="sm" variant="secondary" icon={DownloadIcon} onClick={exportPay}>Export CSV</Button>}>
          <Table>
            <thead><tr><Th>Employee</Th><Th align="right">Gross</Th><Th align="right">Deductions</Th><Th align="right">Shortfall ded.</Th><Th align="right">Leave/LOP</Th><Th align="right">Overrides</Th><Th align="right">Take-home</Th><Th>Payslip</Th></tr></thead>
            <tbody>{payRows.map((p) =>
            <Tr key={p.r.employee.id}><Td className="font-medium">{p.r.employee.name}</Td><Td align="right">{fmtINR(p.gross)}</Td><Td align="right">{fmtINR(p.ded)}</Td><Td align="right" className={p.shortfallDed ? 'text-bad' : 'text-ink-muted'}>{fmtINR(p.shortfallDed)}</Td><Td align="right">{fmtINR(p.lop)}</Td><Td align="right">{p.overrides}</Td><Td align="right" className="font-semibold">{fmtINR(p.take)}</Td><Td><StatusBadge status={p.slip?.status ?? 'Draft'} /></Td></Tr>
            )}</tbody>
          </Table>
        </Panel>)
      }
    </div>);

}