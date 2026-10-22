import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanbanIcon, PlusIcon } from 'lucide-react';
import { ProjectFormDrawer, blankProject, projectStatuses } from '../../components/workforce/ProjectFormDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { EmptyState, PageHeader, Panel, ProgressBar } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import type { Project, WorkSession } from '@shared/types';
import { fmtDate, sessionActiveMs, MINUTE } from '@shared/domain/time';

export function projectMinutes(sessions: WorkSession[], id: string, now: number): number {
  return sessions.filter((s) => s.projectId === id).reduce((a, s) => a + Math.floor(sessionActiveMs(s, now) / MINUTE), 0);
}

export function ProjectsPage() {
  const { state, personName } = useData();
  const navigate = useNavigate();
  const [status, setStatus] = useState('current');
  const [editing, setEditing] = useState<Project | null>(null);
  const now = Date.now();
  const rows = state.projects.filter((p) => status === 'current' ? p.status !== 'Archived' : !status || p.status === status);
  return (
    <div>
      <PageHeader title="Projects" description="Archived projects keep their full time history." actions={<Button icon={PlusIcon} onClick={() => setEditing(blankProject())}>Create project</Button>} />
      <div className="mb-4 w-full sm:w-56">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="current">All except archived</option><option value="">All projects</option>{projectStatuses.map((s) => <option key={s}>{s}</option>)}</Select>
      </div>
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={FolderKanbanIcon} title="No projects found" /> :
        <Table>
            <thead><tr><Th>Project</Th><Th>Client</Th><Th>Manager</Th><Th>Teams</Th><Th>Hours vs estimate</Th><Th>Target end</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((p) => {
              const hours = projectMinutes(state.sessions, p.id, now) / 60;
              return (
                <Tr key={p.id} onClick={() => navigate(`/management/projects/${p.id}`)}>
                    <Td><p className="font-medium">{p.name}</p><p className="text-xs text-ink-muted">{p.code}</p></Td>
                    <Td className="text-ink-muted">{p.client ?? 'Internal'}</Td>
                    <Td className="whitespace-nowrap">{personName(p.managerId)}</Td>
                    <Td className="text-xs text-ink-muted">{p.teamIds.map((t) => state.teams.find((x) => x.id === t)?.name).join(', ') || '—'}</Td>
                    <Td className="min-w-[180px]">
                      {p.estimatedHours ?
                    <div className="flex items-center gap-2"><ProgressBar value={hours / p.estimatedHours * 100} tone={hours > p.estimatedHours ? 'bad' : 'brand'} label="Hours against estimate" /><span className="whitespace-nowrap text-xs text-ink-muted tnum">{Math.round(hours)} / {p.estimatedHours}h</span></div> :
                    <span className="text-xs text-ink-muted tnum">{Math.round(hours)}h · no estimate</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">{fmtDate(p.endDate, 'd MMM yyyy')}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </Tr>);

            })}
            </tbody>
          </Table>
        }
      </Panel>
      <ProjectFormDrawer project={editing} onClose={() => setEditing(null)} />
    </div>);

}