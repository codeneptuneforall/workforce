import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { EmployeeFormDrawer, blankEmployee } from '../../components/workforce/EmployeeFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Avatar, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { Employee } from '@shared/types';
import { computeDay } from '@shared/domain/compliance';
import { fmtDate, fmtMin, todayKey } from '@shared/domain/time';

export function EmployeesPage() {
  const { state, ctx, team } = useData();
  const navigate = useNavigate();
  const now = useNow(60000);
  const today = todayKey(now);
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState('Active');
  const [editing, setEditing] = useState<Employee | null>(null);
  const rows = state.employees.filter((e) => {
    const s = q.trim().toLowerCase();
    return (!s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || e.designation.toLowerCase().includes(s)) && (
    !teamId || e.teamId === teamId) && (!status || e.status === status);
  });

  return (
    <div>
      <PageHeader title="Employees" description={`${state.employees.filter((e) => e.status === 'Active').length} active · ${state.employees.filter((e) => e.status === 'Inactive').length} inactive`} actions={<Button icon={PlusIcon} onClick={() => setEditing(blankEmployee())}>Add employee</Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_160px]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input aria-label="Search employees" placeholder="Search name, code, email or role" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Active</option><option>Inactive</option></Select>
      </div>
      <Panel flush>
        {rows.length === 0 ?
        state.employees.length === 0 ?
        <EmptyState icon={UsersIcon} title="No employees yet" body={state.teams.length === 0 ? 'Create a team first, then add your first employee. Their sign-in account is created automatically.' : 'Add your first employee. Their sign-in account is created automatically.'} /> :
        <EmptyState icon={UsersIcon} title="No employees found" body="Try a different search or filter." /> :
        <Table>
            <thead><tr><Th>Employee</Th><Th>Designation</Th><Th>Team</Th><Th>Today</Th><Th align="right">Daily target</Th><Th>Joined</Th><Th>Account</Th></tr></thead>
            <tbody>
              {rows.map((e) => {
              const d = computeDay(ctx, e, today, now);
              return (
                <Tr key={e.id} onClick={() => navigate(`/management/employees/${e.id}`)}>
                    <Td><div className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{e.code} · {e.email}</p></div></div></Td>
                    <Td>{e.designation}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{team(e.teamId)?.name}</Td>
                    <Td>{e.status === 'Active' ? <span className="flex items-center gap-2"><StatusBadge status={d.status} /><span className="text-xs text-ink-muted tnum">{fmtMin(d.completedMin)}</span></span> : <span className="text-ink-muted">—</span>}</Td>
                    <Td align="right">{fmtMin(e.dailyTargetMinutes)}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{fmtDate(e.joiningDate, 'd MMM yyyy')}</Td>
                    <Td><StatusBadge status={e.status} /></Td>
                  </Tr>);

            })}
            </tbody>
          </Table>
        }
      </Panel>
      <EmployeeFormDrawer employee={editing} onClose={() => setEditing(null)} onSaved={(e) => navigate(`/management/employees/${e.id}`)} />
    </div>);

}