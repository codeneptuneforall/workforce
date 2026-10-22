import { FolderKanbanIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { Banner, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { TaskStatus } from '@shared/types';
import { cmd } from '../../utils/commands';
import { fmtDate, fmtMin, sessionActiveMs, todayKey, MINUTE } from '@shared/domain/time';

const statuses: TaskStatus[] = ['To Do', 'In Progress', 'Blocked', 'Completed'];

export function MyProjectsPage() {
  const emp = useCurrentEmployee();
  const { state, personName } = useData();
  const now = useNow(60000);
  const month = todayKey(now).slice(0, 7);
  const { mutate, error } = useMutation();
  // Every project of the company is listed here — only archived ones are hidden.
  const projects = state.projects.filter((p) => p.status !== 'Archived');

  return (
    <div>
      <PageHeader title="My Projects" description="Every project of the company — you can record time on any of them, assigned or not." />
      {error && <Banner tone="bad" title="Not saved" className="mb-4">{error}</Banner>}
      {projects.length === 0 ?
      <Panel><EmptyState icon={FolderKanbanIcon} title="No projects assigned" body="Your manager will assign you to projects and tasks." /></Panel> :

      <div className="grid gap-6 lg:grid-cols-2">
          {projects.map((p) => {
          const tasks = state.tasks.filter((t) => t.projectId === p.id && (t.assigneeId === emp.id || t.kind === 'Learning'));
          const minutes = state.sessions.filter((s) => s.employeeId === emp.id && s.projectId === p.id && s.date.startsWith(month)).reduce((a, s) => a + Math.floor(sessionActiveMs(s, now) / MINUTE), 0);
          const shared = !p.employeeIds.includes(emp.id);
          return (
            <Panel key={p.id} title={<span className="flex items-center gap-2">{p.name} <span className="font-normal text-ink-muted">{p.code}</span></span>} actions={<StatusBadge status={p.status} />} className="flex flex-col">
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div><dt className="text-xs text-ink-muted">My hours this month</dt><dd className="mt-0.5 font-semibold tnum">{fmtMin(minutes)}</dd></div>
                  <div><dt className="text-xs text-ink-muted">Project manager</dt><dd className="mt-0.5 font-medium">{p.managerId ? personName(p.managerId) : '—'}</dd></div>
                  <div><dt className="text-xs text-ink-muted">Target end</dt><dd className="mt-0.5 font-medium">{fmtDate(p.endDate, 'd MMM yyyy')}</dd></div>
                </dl>
                {p.client && <p className="mt-3 text-xs text-ink-muted">Client: {p.client}</p>}
                {shared && <p className="mt-2 text-xs text-ink-muted">Open to everyone — you can record time on this project even if you are not assigned to it.</p>}
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-2 text-xs font-medium text-ink-muted">{tasks.some((t) => t.kind === 'Learning') ? 'My tasks & shared learning tasks' : 'My tasks'}</p>
                  {tasks.length === 0 ? <p className="text-sm text-ink-muted">No tasks assigned on this project.</p> :
                <ul className="space-y-3">
                      {tasks.map((t) =>
                  <li key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{t.title}{t.kind === 'Learning' && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Learning</span>}</p>
                            <p className="text-xs text-ink-muted">Due {fmtDate(t.dueDate, 'd MMM')}{t.priority && ` · ${t.priority} priority`}</p>
                          </div>
                          <Select aria-label={`Status for ${t.title}`} className="h-9 sm:w-40" value={t.status} onChange={(e) => mutate(cmd.setTaskStatus(t.id, e.target.value as TaskStatus), 'Task status updated')}>
                            {statuses.map((s) => <option key={s}>{s}</option>)}
                          </Select>
                        </li>
                  )}
                    </ul>
                }
                </div>
              </Panel>);

        })}
        </div>
      }
    </div>);

}
