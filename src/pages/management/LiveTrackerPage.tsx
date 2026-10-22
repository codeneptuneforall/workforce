import { useState } from 'react';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { Avatar, Banner, PageHeader, Panel, Segmented } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { computeDay } from '@shared/domain/compliance';
import { fmtClock, fmtMin, fmtTime, sessionActiveMs, todayKey } from '@shared/domain/time';

type Filter = 'all' | 'Working' | 'Paused' | 'Idle';

export function LiveTrackerPage() {
  const { state, ctx, project, task, team } = useData();
  const now = useNow(1000);
  const today = todayKey(now);
  const [filter, setFilter] = useState<Filter>('all');
  const [teamId, setTeamId] = useState('');
  const rows = state.employees.
  filter((e) => e.status === 'Active' && (!teamId || e.teamId === teamId)).
  map((e) => {
    const sessions = state.sessions.filter((s) => s.employeeId === e.id && s.date === today);
    const live = sessions.find((s) => s.status === 'Working') ?? sessions.find((s) => s.status === 'Paused');
    const status: Exclude<Filter, 'all'> = live ? live.status as 'Working' | 'Paused' : 'Idle';
    return { e, live, status, day: computeDay(ctx, e, today, now) };
  }).
  filter((r) => filter === 'all' || r.status === filter).
  sort((a, b) => ['Working', 'Paused', 'Idle'].indexOf(a.status) - ['Working', 'Paused', 'Idle'].indexOf(b.status));
  const count = (s: Filter) => state.employees.filter((e) => e.status === 'Active').filter((e) => {
    const ss = state.sessions.filter((x) => x.employeeId === e.id && x.date === today);
    const st = ss.some((x) => x.status === 'Working') ? 'Working' : ss.some((x) => x.status === 'Paused') ? 'Paused' : 'Idle';
    return s === 'all' || st === s;
  }).length;

  return (
    <div>
      <PageHeader title="Live Time Tracker" description="Who is tracking time right now. Updates every second from saved timestamps." />
      <Banner tone="neutral" className="mb-4">A running timer records work sessions — it doesn’t prove continuous presence. Use it alongside attendance and timesheets.</Banner>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Status" value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${count('all')})` }, { value: 'Working', label: `Working (${count('Working')})` }, { value: 'Paused', label: `Paused (${count('Paused')})` }, { value: 'Idle', label: `Idle (${count('Idle')})` }]} />
        <Select aria-label="Team" className="h-9 w-48" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">All teams</option>
          {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <Panel flush>
        <Table>
          <thead><tr><Th>Employee</Th><Th>Status</Th><Th>Current task</Th><Th>Started</Th><Th align="right">Session time</Th><Th align="right">Today total</Th><Th align="right">Remaining</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={7} className="py-10 text-center text-ink-muted">No employees match this filter.</Td></tr>}
            {rows.map(({ e, live, status, day }) =>
            <Tr key={e.id}>
                <Td><div className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{team(e.teamId)?.name}</p></div></div></Td>
                <Td><StatusBadge status={day.expectedMin === 0 && !live ? day.status : status} /></Td>
                <Td>{live ? <><p className="font-medium">{task(live.taskId)?.title}</p><p className="text-xs text-ink-muted">{project(live.projectId)?.name}</p></> : <span className="text-ink-muted">—</span>}</Td>
                <Td className="tnum">{live ? fmtTime(live.intervals[0]?.start) : '—'}</Td>
                <Td align="right" className="font-mono font-medium">{live ? fmtClock(sessionActiveMs(live, now)) : '—'}</Td>
                <Td align="right" className="font-medium">{fmtMin(day.completedMin)}</Td>
                <Td align="right" className="text-ink-muted">{day.expectedMin ? fmtMin(day.remainingMin) : '—'}</Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </div>);

}