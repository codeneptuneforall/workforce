import { useCallback, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { CalendarDaysIcon, ClockIcon, FilterIcon, RefreshCwIcon, SearchIcon, UserIcon } from 'lucide-react';
import { api } from '../../api/client';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { fmtDate, fmtTime, fromDateKey, monthDates, todayKey } from '@shared/domain/time';
import type { Employee, WorkSession } from '@shared/types';

function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

function fmtDateShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function sumIntervalMinutes(ivs: { start: string; end?: string }[], now: number): number {
  let total = 0;
  for (const iv of ivs) {
    const st = +new Date(iv.start);
    const en = iv.end ? +new Date(iv.end) : now;
    if (en > st) total += en - st;
  }
  return Math.floor(total / 60_000);
}

export function MonthlyAttendanceListPage() {
  const { user } = useAuth();
  const { state, refresh } = useData();
  const isManager = user?.role === 'management';
  const callerEmpId = user?.employeeId ?? user?.id ?? '';
  const now = Date.now();

  const [month, setMonth] = useState(currentMonthKey());
  const [teamId, setTeamId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [loading, setLoading] = useState(false);

  const teams = state.teams;
  const employees = state.employees;
  const sessions = state.sessions;

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '—';

  // Build daily attendance rows from sessions
  const rows = useMemo(() => {
    const monthBounds = month ? { start: new Date(`${month}-01T00:00:00+05:30`), end: new Date(`${month}-01T00:00:00+05:30`) } : null;
    // Actually compute month bounds properly
    const start = startOfMonth(new Date(`${month}-01`));
    const end = endOfMonth(new Date(`${month}-01`));
    const allDays = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));

    // Filter sessions for the month
    const monthSessions = sessions.filter((s) => allDays.includes(s.date));

    // Group by employee + date
    const grouped = new Map<string, WorkSession[]>();
    for (const s of monthSessions) {
      const key = `${s.employeeId}|${s.date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }

    // Build rows
    const rows: any[] = [];
    for (const [key, sessionList] of grouped.entries()) {
      const [empId, date] = key.split('|');
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;
      if (teamId && emp.teamId !== teamId) continue;
      if (employeeSearch && !emp.name.toLowerCase().includes(employeeSearch.toLowerCase())) continue;

      // Combine all intervals across sessions for this day
      let firstStart: string | null = null;
      let lastEnd: string | null = null;
      let totalMinutes = 0;
      let hasWorking = false;
      let hasPaused = false;

      for (const s of sessionList) {
        if (s.status === 'Working') hasWorking = true;
        if (s.status === 'Paused') hasPaused = true;
        for (const iv of s.intervals) {
          if (!firstStart || iv.start < firstStart) firstStart = iv.start;
          if (iv.end && (!lastEnd || iv.end > lastEnd)) lastEnd = iv.end;
        }
      }

      // Total minutes from all intervals
      for (const s of sessionList) {
        totalMinutes += sumIntervalMinutes(s.intervals, now);
      }

      const status = hasWorking ? 'Working' : hasPaused ? 'Paused' : 'Completed';

      rows.push({
        employeeId: empId,
        employeeName: emp.name,
        date,
        firstStart,
        lastEnd,
        totalMinutes,
        status,
        teamId: emp.teamId
      });
    }

    // Sort by date then employee name
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.employeeName.localeCompare(b.employeeName);
    });

    return rows;
  }, [sessions, employees, month, teamId, employeeSearch, now]);

  // Summary stats
  const totalDays = rows.length;
  const totalHours = rows.reduce((a, r) => a + r.totalMinutes, 0);
  const workingNow = rows.filter((r) => r.status === 'Working').length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  const monthStart = startOfMonth(new Date(`${month}-01`));
  const monthLabel = format(monthStart, 'MMMM yyyy');
  const prevDisabled = month <= '2026-01';
  const nextDisabled = month >= currentMonthKey();

  const goPrev = () => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() - 1);
    setMonth(format(d, 'yyyy-MM'));
  };
  const goNext = () => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  return (
    <div>
      <PageHeader
        title="Monthly Attendance"
        description="Employee-wise daily login/logout times and worked hours for the selected month."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCwIcon} onClick={refetch} loading={loading} size="sm">Refresh</Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Total Work Days</p>
                <p className="text-2xl font-semibold tnum">{totalDays}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <CalendarDaysIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Days with time recorded in {monthLabel}</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Total Hours Worked</p>
                <p className="text-2xl font-semibold tnum">{Math.floor(totalHours / 60)}h {totalHours % 60}m</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-bg text-ok">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Sum of all session intervals</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Employees Working Now</p>
                <p className="text-2xl font-semibold tnum">{workingNow}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warn-bg text-warn">
                <UserIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Sessions with status Working</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Avg Hours / Day</p>
                <p className="text-2xl font-semibold tnum">
                  {totalDays ? Math.floor(totalHours / totalDays) : 0}h
                  {totalDays ? Math.round((totalHours % totalDays) / totalDays) : 0}m
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-bg text-info">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Average per recorded day</p>
          </div>
        </Panel>
      </div>

      {/* Filters */}
      <Panel flush className="mb-6">
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Month</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={goPrev} disabled={prevDisabled} className="h-10 w-10 rounded-lg border border-line text-ink-muted disabled:opacity-40 disabled:cursor-not-allowed">{monthStart.getMonth() === 0 ? '◀' : '◀'}</button>
                <span className="flex-1 text-sm font-medium text-ink text-center">{monthLabel}</span>
                <button type="button" onClick={goNext} disabled={nextDisabled} className="h-10 w-10 rounded-lg border border-line text-ink-muted disabled:opacity-40 disabled:cursor-not-allowed">{monthStart.getMonth() === 11 ? '▶' : '▶'}</button>
              </div>
            </div>

            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Team / Department</label>
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">All teams</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>

            <div className="min-w-[260px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Employee Search</label>
              <Select value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)}>
                <option value="">All employees</option>
                {employees.filter((e) => e.status === 'Active').map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
              </Select>
            </div>

            {(teamId || employeeSearch) && (
              <button type="button" onClick={() => { setTeamId(''); setEmployeeSearch(''); }} className="self-end rounded-lg border border-line px-3 py-2 text-sm text-ink-muted hover:text-ink">Clear filters</button>
            )}
          </div>
        </div>
      </Panel>

      {/* List table */}
      <Panel flush>
        <div className="p-5">
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>Employee</Th>
                <Th>Team</Th>
                <Th align="right">Sign In</Th>
                <Th align="right">Sign Out</Th>
                <Th align="right">Hours</Th>
                <Th>Status</Th>
              </Tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <Tr><Td colSpan={7} className="py-10 text-center text-ink-muted">No attendance records found for the selected period.</Td></Tr>
              )}
              {rows.map((r) => (
                <Tr key={`${r.employeeId}|${r.date}`}>
                  <Td className="font-medium whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td className="font-medium">{r.employeeName}</Td>
                  <Td className="text-ink-muted">{teamName(r.teamId)}</Td>
                  <Td align="right" className="text-ink-muted whitespace-nowrap">{r.firstStart ? fmtTime(r.firstStart) : '—'}</Td>
                  <Td align="right" className="text-ink-muted whitespace-nowrap">{r.lastEnd ? fmtTime(r.lastEnd) : '—'}</Td>
                  <Td align="right" className="font-semibold tnum">{Math.floor(r.totalMinutes / 60)}h {r.totalMinutes % 60}m</Td>
                  <Td><Badge tone={r.status === 'Working' ? 'warn' : r.status === 'Paused' ? 'info' : 'ok'}>{r.status}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}