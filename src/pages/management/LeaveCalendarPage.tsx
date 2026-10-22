import { useState } from 'react';
import { addDays, addMonths, format, getDay } from 'date-fns';
import { LeaveRequestDrawer } from '../../components/leave/LeaveRequestDrawer';
import { LeaveSectionNav } from '../../components/leave/LeaveSectionNav';
import { DateStepper } from '../../components/shared/DateStepper';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { PageHeader, Panel, Segmented } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { Leave } from '@shared/types';
import { cn } from '../../utils/cn';
import { fmtDate, fromDateKey, monthDates, toDateKey, todayKey, weekDates, weekStartKey } from '@shared/domain/time';
import { LeaveRange } from '../employee/MyLeavesPage';

type View = 'month' | 'week' | 'list';

export function LeaveCalendarPage() {
  const { state, employee } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(today);
  const [empId, setEmpId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('active');
  const [openId, setOpenId] = useState<string | null>(null);

  const leaves = state.leaves.filter((l) => (status === 'active' ? l.status === 'Approved' || l.status === 'Pending Approval' : l.status === status) && (!empId || l.employeeId === empId) && (!teamId || employee(l.employeeId)?.teamId === teamId) && (!type || l.type === type));
  const holidays = state.holidays.filter((h) => h.status === 'Published');
  const on = (d: string) => leaves.filter((l) => d >= l.startDate && d <= l.endDate);
  const dates = view === 'week' ? weekDates(weekStartKey(anchor)) : monthDates(anchor.slice(0, 7));
  const lead = (getDay(fromDateKey(dates[0])) + 6) % 7;
  const step = (n: number) => setAnchor((a) => view === 'week' ? toDateKey(addDays(fromDateKey(a), 7 * n)) : toDateKey(addMonths(fromDateKey(a), n)));
  const label = view === 'week' ? `${fmtDate(dates[0], 'd MMM')} – ${fmtDate(dates[6], 'd MMM yyyy')}` : format(fromDateKey(anchor), 'MMMM yyyy');
  const listRows = leaves.filter((l) => l.endDate >= dates[0] && l.startDate <= dates[dates.length - 1]).sort((a, b) => a.startDate < b.startDate ? -1 : 1);

  const Chip = ({ l }: {l: Leave;}) =>
  <button onClick={() => setOpenId(l.id)} className={cn('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium', l.status === 'Approved' ? 'bg-info text-white' : 'border border-dashed border-warn bg-warn-bg text-warn')} title={`${employee(l.employeeId)?.name} · ${l.type} · ${l.status}`}>
      {employee(l.employeeId)?.name.split(' ')[0]} · {l.type[0]}L
    </button>;


  return (
    <div>
      <PageHeader title="Leave Management" description="Team leave alongside public and company holidays." />
      <LeaveSectionNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
          <DateStepper label={label} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setAnchor(today)} />
        </div>
        <ul className="flex flex-wrap gap-4 text-xs text-ink-muted">
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-info" /> Approved leave</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-warn bg-warn-bg" /> Pending request</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-700" /> Holiday</li>
        </ul>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">All employees</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Casual">Casual</option><option value="Emergency">Emergency</option></Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Approved & pending</option><option>Approved</option><option>Pending Approval</option><option>Rejected</option></Select>
      </div>

      {view === 'list' ?
      <Panel flush>
          <Table>
            <thead><tr><Th>Employee</Th><Th>Type</Th><Th>Dates</Th><Th align="right">Days</Th><Th>Status</Th></tr></thead>
            <tbody>
              {listRows.length === 0 && <tr><Td colSpan={5} className="py-10 text-center text-ink-muted">No leave in this period.</Td></tr>}
              {listRows.map((l) => <Tr key={l.id} onClick={() => setOpenId(l.id)}><Td className="font-medium">{employee(l.employeeId)?.name}</Td><Td>{l.type}</Td><Td className="whitespace-nowrap"><LeaveRange l={l} /></Td><Td align="right">{l.days}</Td><Td><StatusBadge status={l.status} /></Td></Tr>)}
            </tbody>
          </Table>
        </Panel> :

      <Panel>
          <div className="grid grid-cols-7 gap-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="pb-1 text-center text-xs text-ink-muted">{d}</div>)}
            {view === 'month' && Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
            {dates.map((d) => {
            const h = holidays.find((x) => x.date === d);
            const weekend = [0, 6].includes(fromDateKey(d).getDay());
            const items = on(d);
            return (
              <div key={d} className={cn('flex flex-col gap-1 rounded-lg border p-1.5', view === 'week' ? 'min-h-[180px]' : 'min-h-[92px]', weekend ? 'border-line bg-canvas' : 'border-line bg-white', d === today && 'ring-2 ring-brand-500')}>
                  <span className={cn('text-xs font-medium', d === today ? 'text-brand-700' : 'text-ink-2')}>{Number(d.slice(8))}</span>
                  {h && <span className="truncate rounded bg-brand-700 px-1.5 py-0.5 text-[11px] font-medium text-white" title={h.name}>{h.name}</span>}
                  {items.slice(0, view === 'week' ? 10 : 2).map((l) => <Chip key={l.id} l={l} />)}
                  {view === 'month' && items.length > 2 && <span className="text-[11px] text-ink-muted">+{items.length - 2} more</span>}
                </div>);

          })}
          </div>
        </Panel>
      }
      <LeaveRequestDrawer leave={state.leaves.find((l) => l.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>);

}