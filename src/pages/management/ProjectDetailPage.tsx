import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ArchiveIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { SessionsTable } from '../../components/shared/SessionsTable';
import { ProjectFormDrawer } from '../../components/workforce/ProjectFormDrawer';
import { ProjectStatsPanel } from '../../components/workforce/ProjectStatsPanel';
import { TaskFormDrawer, blankTask } from '../../components/workforce/TaskFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Banner, KeyValue, PageHeader, Panel, ProgressBar, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Project, Task } from '@shared/types';
import { cmd } from '../../utils/commands';
import { fmtDate, fmtDateTime, fmtMin, sessionActiveMs, MINUTE } from '@shared/domain/time';

type Tab = 'overview' | 'tasks' | 'team' | 'logs' | 'stats' | 'activity';

export function ProjectDetailPage() {
  const { id } = useParams();
  const { state } = useData();
  const p = state.projects.find((x) => x.id === id);
  if (!p) return <Navigate to="/management/projects" replace />;
  return <ProjectDetail p={p} />;
}

function ProjectDetail({ p }: {p: Project;}) {
  const { state, personName } = useData();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<Project | null>(null);
  const [taskEdit, setTaskEdit] = useState<Task | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { mutate, pending, error, setError } = useMutation();
  const now = Date.now();
  const sessions = state.sessions.filter((s) => s.projectId === p.id);
  const tasks = state.tasks.filter((t) => t.projectId === p.id);
  const mins = (arr: typeof sessions) => arr.reduce((a, s) => a + Math.floor(sessionActiveMs(s, now) / MINUTE), 0);
  const total = mins(sessions);
  const byEmployee = [...new Set(sessions.map((s) => s.employeeId))].map((id) => ({ id, m: mins(sessions.filter((s) => s.employeeId === id)) })).sort((a, b) => b.m - a.m);
  const byTask = tasks.map((t) => ({ t, m: mins(sessions.filter((s) => s.taskId === t.id)) })).sort((a, b) => b.m - a.m);
  const activity = state.audit.filter((a) => a.entityId.includes(p.name) || tasks.some((t) => a.entityId === t.title));
  const archived = p.status === 'Archived';

  return (
    <div>
      <PageHeader title={p.name} back={{ to: '/management/projects', label: 'Projects' }} description={<span className="flex items-center gap-2">{p.code} · {p.client ?? 'Internal'} <StatusBadge status={p.status} /></span>}
      actions={<>{!archived && <Button variant="secondary" icon={ArchiveIcon} onClick={() => {setError(null);setArchiveOpen(true);}}>Archive</Button>}<Button icon={PencilIcon} onClick={() => setEditing(p)}>Edit</Button></>} />
      {archived && <Banner tone="neutral" className="mb-4">This project is archived. It can’t be selected for new time, and all historical records are preserved.</Banner>}
      <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'stats', label: 'Stats' }, { id: 'tasks', label: 'Tasks', count: tasks.length }, { id: 'team', label: 'Team' }, { id: 'logs', label: 'Time Logs' }, { id: 'activity', label: 'Activity' }]} /></div>

      {tab === 'overview' &&
      <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Summary" className="lg:col-span-2">
            <div className="flex items-end justify-between"><div><p className="text-3xl font-semibold tnum">{fmtMin(total)}</p><p className="text-sm text-ink-muted">logged{p.estimatedHours ? ` of ${p.estimatedHours}h estimated` : ''}</p></div></div>
            {p.estimatedHours && <ProgressBar className="mt-3" value={total / 60 / p.estimatedHours * 100} label="Hours against estimate" />}
            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
              <KeyValue label="Project manager" value={personName(p.managerId)} />
              <KeyValue label="Start" value={fmtDate(p.startDate)} />
              <KeyValue label="Target end" value={fmtDate(p.endDate)} />
            </dl>
            <p className="mt-5 text-sm text-ink-2">{p.description}</p>
            {p.notes && <p className="mt-2 text-sm text-ink-muted">{p.notes}</p>}
          </Panel>
          <Panel title="Contributions">
            {byEmployee.length === 0 ? <p className="text-sm text-ink-muted">No time logged yet.</p> :
          <ul className="space-y-3">{byEmployee.map((r) => <li key={r.id}><div className="flex justify-between text-sm"><span>{personName(r.id)}</span><span className="font-medium tnum">{fmtMin(r.m)}</span></div><ProgressBar className="mt-1 h-1.5" value={r.m / Math.max(total, 1) * 100} /></li>)}</ul>
          }
          </Panel>
        </div>
      }
      {tab === 'tasks' &&
      <Panel flush actions={!archived && <Button size="sm" icon={PlusIcon} onClick={() => setTaskEdit(blankTask(p.id))}>Add task</Button>} title="Tasks">
          <Table>
            <thead><tr><Th>Task</Th><Th>Assignee</Th><Th>Due</Th><Th align="right">Logged</Th><Th>Status</Th></tr></thead>
            <tbody>{byTask.map(({ t, m }) => <Tr key={t.id} onClick={() => setTaskEdit(t)}><Td className="font-medium">{t.title}</Td><Td>{t.assigneeId ? personName(t.assigneeId) : state.teams.find((x) => x.id === t.teamId)?.name}</Td><Td className="whitespace-nowrap">{fmtDate(t.dueDate, 'd MMM')}</Td><Td align="right">{fmtMin(m)}</Td><Td><StatusBadge status={t.status} /></Td></Tr>)}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'team' &&
      <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Teams"><ul className="space-y-2">{p.teamIds.map((t) => <li key={t} className="text-sm">{state.teams.find((x) => x.id === t)?.name}</li>)}{!p.teamIds.length && <li className="text-sm text-ink-muted">None</li>}</ul></Panel>
          <Panel title="Employees"><ul className="space-y-2">{p.employeeIds.map((e) => <li key={e} className="text-sm">{personName(e)}</li>)}{!p.employeeIds.length && <li className="text-sm text-ink-muted">None</li>}</ul></Panel>
        </div>
      }
      {tab === 'logs' && <Panel flush><SessionsTable sessions={sessions.slice(-200)} showDate showEmployee /></Panel>}
      {tab === 'stats' && <ProjectStatsPanel project={p} />}
      {tab === 'activity' &&
      <Panel flush>{activity.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-muted">No recorded activity yet.</p> : <ul className="divide-y divide-line">{activity.map((a) => <li key={a.id} className="px-5 py-3"><p className="text-sm"><span className="font-medium">{a.action}</span> · {a.entityId}</p><p className="text-xs text-ink-muted">{a.actor} · {fmtDateTime(a.at)}</p></li>)}</ul>}</Panel>
      }

      <ProjectFormDrawer project={editing} onClose={() => setEditing(null)} />
      <TaskFormDrawer task={taskEdit} onClose={() => setTaskEdit(null)} />
      <ConfirmDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} title={`Archive ${p.name}?`} confirmLabel="Archive project" pending={pending} error={error}
      body="Archived projects can’t receive new time. Historical sessions, reports and payroll records are kept — nothing is deleted."
      onConfirm={async () => {if (await mutate(cmd.setProjectStatus(p.id, 'Archived'), 'Project archived')) setArchiveOpen(false);}} />
    </div>);

}