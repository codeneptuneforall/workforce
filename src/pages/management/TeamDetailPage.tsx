import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PencilIcon } from 'lucide-react';
import { TeamFormDrawer } from '../../components/workforce/TeamFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar, KeyValue, PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { Team } from '@shared/types';
import { computeDay } from '@shared/domain/compliance';
import { fmtDate, fmtDateTime, fmtMin, monthDates, todayKey, weekDates } from '@shared/domain/time';
import { LeaveRange } from '../employee/MyLeavesPage';

type Tab = 'overview' | 'members' | 'projects' | 'compliance' | 'timesheets' | 'leave' | 'activity';

export function TeamDetailPage() {
  const { id } = useParams();
  const { state } = useData();
  const team = state.teams.find((t) => t.id === id);
  if (!team) return <Navigate to="/management/teams" replace />;
  return <TeamDetail team={team} />;
}

function TeamDetail({ team }: {team: Team;}) {
  const { state, ctx, personName } = useData();
  const navigate = useNavigate();
  const now = useNow(60000);
  const today = todayKey(now);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<Team | null>(null);
  const members = state.employees.filter((e) => e.teamId === team.id);
  const active = members.filter((e) => e.status === 'Active');
  const todayDays = active.map((e) => computeDay(ctx, e, today, now));
  const monthDays = active.flatMap((e) => monthDates(today.slice(0, 7)).filter((d) => d <= today).map((d) => computeDay(ctx, e, d, now)));
  const projects = state.projects.filter((p) => p.teamIds.includes(team.id));
  const memberIds = members.map((m) => m.id);
  const timesheets = state.timesheets.filter((t) => memberIds.includes(t.employeeId)).sort((a, b) => a.weekStart < b.weekStart ? 1 : -1).slice(0, 20);
  const leaves = state.leaves.filter((l) => memberIds.includes(l.employeeId) && l.status !== 'Cancelled' && l.endDate >= today).sort((a, b) => a.startDate < b.startDate ? -1 : 1);
  const names = [team.name, ...members.map((m) => m.name)];
  const activity = state.audit.filter((a) => names.some((n) => a.entityId.includes(n))).slice(0, 30);
  const sum = (arr: typeof todayDays, f: (d: (typeof todayDays)[number]) => number) => arr.reduce((a, d) => a + f(d), 0);

  return (
    <div>
      <PageHeader title={team.name} back={{ to: '/management/teams', label: 'Teams' }} description={<span className="flex items-center gap-2">Lead: {personName(team.leadId)} · {active.length} active members <StatusBadge status={team.status} /></span>} actions={<Button icon={PencilIcon} onClick={() => setEditing(team)}>Edit team</Button>} />
      <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members' }, { id: 'projects', label: 'Projects' }, { id: 'compliance', label: 'Working-Hour Compliance' }, { id: 'timesheets', label: 'Timesheets' }, { id: 'leave', label: 'Leave Calendar' }, { id: 'activity', label: 'Activity' }]} /></div>

      {tab === 'overview' &&
      <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Today">
            <dl className="grid grid-cols-2 gap-5">
              <KeyValue label="Completed hours" value={fmtMin(sum(todayDays, (d) => d.completedMin))} />
              <KeyValue label="Expected hours" value={fmtMin(sum(todayDays, (d) => d.expectedMin))} />
              <KeyValue label="Target completed" value={`${todayDays.filter((d) => d.status === 'Target Completed').length} of ${todayDays.filter((d) => d.expectedMin > 0).length}`} />
              <KeyValue label="On leave / holiday" value={todayDays.filter((d) => d.expectedMin === 0).length} />
            </dl>
          </Panel>
          <Panel title="This month">
            <dl className="grid grid-cols-2 gap-5">
              <KeyValue label="Completed hours" value={fmtMin(sum(monthDays, (d) => d.completedMin))} />
              <KeyValue label="Expected hours" value={fmtMin(sum(monthDays, (d) => d.expectedMin))} />
              <KeyValue label="Shortfall" value={<span className="text-bad">{fmtMin(sum(monthDays, (d) => d.isShortfall ? d.shortfallMin : 0))}</span>} />
              <KeyValue label="Days below target" value={monthDays.filter((d) => d.isShortfall).length} />
            </dl>
          </Panel>
          <Panel title="About" className="lg:col-span-2"><p className="text-sm text-ink-2">{team.description || 'No description.'}</p></Panel>
        </div>
      }
      {tab === 'members' &&
      <Panel flush>
          <Table>
            <thead><tr><Th>Member</Th><Th>Designation</Th><Th>Role</Th><Th>Account</Th></tr></thead>
            <tbody>{members.map((m) =>
            <Tr key={m.id} onClick={() => navigate(`/management/employees/${m.id}`)}>
                <Td><div className="flex items-center gap-3"><Avatar name={m.name} size="sm" /><span className="font-medium">{m.name}</span></div></Td>
                <Td>{m.designation}</Td><Td>{m.id === team.leadId ? 'Team lead' : 'Member'}</Td><Td><StatusBadge status={m.status} /></Td>
              </Tr>
            )}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'projects' &&
      <Panel flush>
          <Table>
            <thead><tr><Th>Project</Th><Th>Manager</Th><Th>Target end</Th><Th>Status</Th></tr></thead>
            <tbody>{projects.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-ink-muted">No projects assigned to this team.</Td></tr>}{projects.map((p) =>
            <Tr key={p.id} onClick={() => navigate(`/management/projects/${p.id}`)}><Td><p className="font-medium">{p.name}</p><p className="text-xs text-ink-muted">{p.code}</p></Td><Td>{personName(p.managerId)}</Td><Td>{fmtDate(p.endDate)}</Td><Td><StatusBadge status={p.status} /></Td></Tr>
            )}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'compliance' &&
      <Panel flush title={`Today · ${fmtDate(today, 'EEE d MMM')}`}>
          <Table>
            <thead><tr><Th>Member</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Remaining / shortfall</Th><Th>Status</Th></tr></thead>
            <tbody>{todayDays.map((d) =>
            <Tr key={d.employeeId}><Td className="font-medium">{personName(d.employeeId)}</Td><Td align="right">{fmtMin(d.expectedMin)}</Td><Td align="right">{fmtMin(d.completedMin)}</Td><Td align="right" className={d.isShortfall ? 'text-bad' : ''}>{fmtMin(d.remainingMin)}</Td><Td><StatusBadge status={d.status} /></Td></Tr>
            )}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'timesheets' &&
      <Panel flush>
          <Table>
            <thead><tr><Th>Member</Th><Th>Week</Th><Th>Status</Th></tr></thead>
            <tbody>{timesheets.map((t) => <Tr key={t.id}><Td className="font-medium">{personName(t.employeeId)}</Td><Td>{fmtDate(t.weekStart, 'd MMM')} – {fmtDate(weekDates(t.weekStart)[6], 'd MMM yyyy')}</Td><Td><StatusBadge status={t.status} /></Td></Tr>)}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'leave' &&
      <Panel flush>
          <Table>
            <thead><tr><Th>Member</Th><Th>Type</Th><Th>Dates</Th><Th align="right">Days</Th><Th>Status</Th></tr></thead>
            <tbody>{leaves.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-ink-muted">No upcoming or pending leave.</Td></tr>}{leaves.map((l) => <Tr key={l.id}><Td className="font-medium">{personName(l.employeeId)}</Td><Td>{l.type}</Td><Td className="whitespace-nowrap"><LeaveRange l={l} /></Td><Td align="right">{l.days}</Td><Td><StatusBadge status={l.status} /></Td></Tr>)}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'activity' &&
      <Panel flush>
          {activity.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-muted">No recorded activity yet.</p> :
        <ul className="divide-y divide-line">{activity.map((a) => <li key={a.id} className="px-5 py-3"><p className="text-sm"><span className="font-medium">{a.action}</span> · {a.entityId}</p><p className="text-xs text-ink-muted">{a.actor} · {fmtDateTime(a.at)}{a.reason && ` · ${a.reason}`}</p></li>)}</ul>
        }
        </Panel>
      }
      <TeamFormDrawer team={editing} onClose={() => setEditing(null)} />
    </div>);

}