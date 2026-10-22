import { useState } from 'react';
import { PlaneIcon } from 'lucide-react';
import { LeaveRequestDrawer } from '../../components/leave/LeaveRequestDrawer';
import { LeaveSectionNav } from '../../components/leave/LeaveSectionNav';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { fmtDateTime } from '@shared/domain/time';
import { LeaveRange } from '../employee/MyLeavesPage';

export function LeaveRequestsPage() {
  const { state, team, employee } = useData();
  const [status, setStatus] = useState('Pending Approval');
  const [type, setType] = useState('');
  const [teamId, setTeamId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = state.leaves.
  filter((l) => (!status || l.status === status) && (!type || l.type === type) && (!teamId || employee(l.employeeId)?.teamId === teamId)).
  sort((a, b) => a.submittedAt < b.submittedAt ? 1 : -1);
  return (
    <div>
      <PageHeader title="Leave Management" description="Every request starts as Pending Approval. Only approved leave affects attendance and payroll." />
      <LeaveSectionNav />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Pending Approval</option><option>Approved</option><option>Rejected</option><option>Cancelled</option></Select>
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Casual">Casual Leave</option><option value="Emergency">Emergency Leave</option></Select>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
      </div>
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={PlaneIcon} title={status === 'Pending Approval' ? 'No requests awaiting approval' : 'No requests match'} /> :
        <Table>
            <thead><tr><Th>Employee</Th><Th>Type</Th><Th>Dates</Th><Th align="right">Days</Th><Th>Submitted</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((l) => {
              const e = employee(l.employeeId);
              return (
                <Tr key={l.id} onClick={() => setOpenId(l.id)}>
                    <Td><p className="font-medium">{e?.name}</p><p className="text-xs text-ink-muted">{team(e?.teamId)?.name}</p></Td>
                    <Td><p>{l.type}</p>{l.retrospective && <p className="text-xs font-medium text-warn">Retrospective</p>}</Td>
                    <Td className="whitespace-nowrap"><LeaveRange l={l} /></Td>
                    <Td align="right">{l.days}</Td>
                    <Td className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(l.submittedAt)}</Td>
                    <Td><StatusBadge status={l.status} /></Td>
                  </Tr>);

            })}
            </tbody>
          </Table>
        }
      </Panel>
      <LeaveRequestDrawer leave={state.leaves.find((l) => l.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>);

}