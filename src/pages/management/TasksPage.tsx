import { useState } from 'react';
import { ListChecksIcon, PlusIcon } from 'lucide-react';
import { TaskFormDrawer, blankTask, taskStatuses } from '../../components/workforce/TaskFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Banner, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Task, TaskStatus } from '@shared/types';
import { cmd } from '../../utils/commands';
import { fmtDate, todayKey } from '@shared/domain/time';

export function TasksPage() {
  const { state, project, personName } = useData();
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('open');
  const [assignee, setAssignee] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const { mutate, error } = useMutation();
  const today = todayKey();
  const rows = state.tasks.
  filter((t) => (!projectId || t.projectId === projectId) && (status === 'open' ? t.status !== 'Completed' : !status || t.status === status) && (!assignee || t.assigneeId === assignee)).
  sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
  return (
    <div>
      <PageHeader title="Tasks" description="Employees only see tasks assigned to them or their team — plus every learning task, which is shared with the whole company. Ending a timer never completes a task." actions={<Button icon={PlusIcon} onClick={() => setEditing(blankTask())}>Create task</Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open tasks</option><option value="">All statuses</option>{taskStatuses.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">All assignees</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
      </div>
      {error && <Banner tone="bad" title="Not saved" className="mb-4">{error}</Banner>}
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={ListChecksIcon} title="No tasks match" /> :
        <Table>
            <thead><tr><Th>Task</Th><Th>Project</Th><Th>Assigned to</Th><Th>Priority</Th><Th>Due</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((t) =>
            <Tr key={t.id} onClick={() => setEditing(t)}>
                  <Td><p className="font-medium">{t.title}</p><p className="max-w-xs truncate text-xs text-ink-muted">{t.description}</p></Td>
                  <Td className="whitespace-nowrap">{project(t.projectId)?.code} · {project(t.projectId)?.name}</Td>
                  <Td className="whitespace-nowrap">{t.assigneeId ? personName(t.assigneeId) : `${state.teams.find((x) => x.id === t.teamId)?.name ?? '—'} (team)`}</Td>
                  <Td>{t.priority ? <StatusBadge status={t.priority} /> : <span className="text-ink-muted">—</span>}</Td>
                  <Td className={`whitespace-nowrap ${t.dueDate < today && t.status !== 'Completed' ? 'font-medium text-bad' : ''}`}>{fmtDate(t.dueDate, 'd MMM yyyy')}</Td>
                  <Td>
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Select aria-label={`Status of ${t.title}`} className="h-8 w-36 text-xs" value={t.status} onChange={(e) => mutate(cmd.setTaskStatus(t.id, e.target.value as TaskStatus), 'Status updated')}>
                        {taskStatuses.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    </div>
                  </Td>
                </Tr>
            )}
            </tbody>
          </Table>
        }
      </Panel>
      <TaskFormDrawer task={editing} onClose={() => setEditing(null)} />
    </div>);

}