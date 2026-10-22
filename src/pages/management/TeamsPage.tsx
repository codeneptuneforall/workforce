import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import { TeamFormDrawer, blankTeam } from '../../components/workforce/TeamFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel, ProgressBar } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { Team } from '@shared/types';
import { computeDay } from '@shared/domain/compliance';
import { fmtMin, monthDates, todayKey } from '@shared/domain/time';

export function TeamsPage() {
  const { state, ctx, personName } = useData();
  const navigate = useNavigate();
  const now = useNow(60000);
  const today = todayKey(now);
  const [editing, setEditing] = useState<Team | null>(null);
  const monthSoFar = monthDates(today.slice(0, 7)).filter((d) => d <= today);

  return (
    <div>
      <PageHeader title="Teams" description="Team membership, leads and working-hour summaries." actions={<Button icon={PlusIcon} onClick={() => setEditing(blankTeam())}>Create team</Button>} />
      <Panel flush>
        <Table>
          <thead><tr><Th>Team</Th><Th>Lead</Th><Th align="right">Members</Th><Th>Today</Th><Th align="right">Month completed</Th><Th align="right">Month shortfall</Th><Th>Status</Th></tr></thead>
          <tbody>
            {state.teams.map((t) => {
              const members = state.employees.filter((e) => e.teamId === t.id && e.status === 'Active');
              const todayDays = members.map((e) => computeDay(ctx, e, today, now));
              const expectedToday = todayDays.filter((d) => d.expectedMin > 0);
              const met = expectedToday.filter((d) => d.status === 'Target Completed').length;
              const monthDays = members.flatMap((e) => monthSoFar.map((d) => computeDay(ctx, e, d, now)));
              return (
                <Tr key={t.id} onClick={() => navigate(`/management/teams/${t.id}`)}>
                  <Td><p className="font-medium">{t.name}</p><p className="max-w-xs truncate text-xs text-ink-muted">{t.description}</p></Td>
                  <Td>{personName(t.leadId)}</Td>
                  <Td align="right">{members.length}</Td>
                  <Td className="min-w-[160px]"><div className="flex items-center gap-2"><ProgressBar value={expectedToday.length ? met / expectedToday.length * 100 : 0} tone="ok" label="Target completed today" /><span className="whitespace-nowrap text-xs text-ink-muted tnum">{met}/{expectedToday.length}</span></div></Td>
                  <Td align="right">{fmtMin(monthDays.reduce((a, d) => a + d.completedMin, 0))}</Td>
                  <Td align="right" className="text-bad">{fmtMin(monthDays.reduce((a, d) => a + (d.isShortfall ? d.shortfallMin : 0), 0))}</Td>
                  <Td><StatusBadge status={t.status} /></Td>
                </Tr>);

            })}
          </tbody>
        </Table>
      </Panel>
      <TeamFormDrawer team={editing} onClose={() => setEditing(null)} />
    </div>);

}