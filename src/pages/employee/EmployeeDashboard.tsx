import { Link } from 'react-router-dom';
import { BellIcon, ListChecksIcon } from 'lucide-react';
import { SessionsTable } from '../../components/shared/SessionsTable';
import { WeekBars } from '../../components/shared/WeekBars';
import { DailyTargetCard } from '../../components/time/DailyTargetCard';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, PageHeader, Panel, Avatar } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useNow } from '../../hooks/useNow';
import { attendanceStatus, computeDay, dayKey } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtDate, fmtDateTime, fmtMin, todayKey, weekDates, weekStartKey } from '@shared/domain/time';
import { addDays } from 'date-fns';
import { fromDateKey, toDateKey } from '@shared/domain/time';

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function EmployeeDashboard() {
  const emp = useCurrentEmployee();
  const { state, ctx, project } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const weekDays = weekDates(weekStartKey(today)).map((d) => computeDay(ctx, emp, d, now));
  const weekDone = weekDays.reduce((a, d) => a + d.completedMin, 0);
  const weekExpected = weekDays.reduce((a, d) => a + d.expectedMin, 0);
  const todayDay = computeDay(ctx, emp, today, now);
  const todaySessions = ctx.sessionsByKey.get(dayKey(emp.id, today)) ?? [];
  const openTasks = state.tasks.filter((t) => t.assigneeId === emp.id && t.status !== 'Completed');
  const mine = state.sessions.filter((s) => s.employeeId === emp.id).sort((a, b) => (a.intervals[0]?.start ?? '') < (b.intervals[0]?.start ?? '') ? 1 : -1);
  const live = mine.find((s) => (s.status === 'Working' || s.status === 'Paused') && s.date === today);
  const currentProject = project((live ?? mine[0])?.projectId);
  const lastWeek = toDateKey(addDays(fromDateKey(weekStartKey(today)), -7));
  const ts = state.timesheets.find((t) => t.employeeId === emp.id && t.weekStart === lastWeek);
  const holidays = state.holidays.filter((h) => h.status === 'Published' && h.date >= today).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 3);
  const leaves = state.leaves.filter((l) => l.employeeId === emp.id && l.status === 'Approved' && l.endDate >= today).sort((a, b) => a.startDate < b.startDate ? -1 : 1);
  const notes = state.notifications.filter((n) => n.audience === emp.id).slice(0, 4);

  return (
    <div>
      <PageHeader title={`${greeting(now)}, ${emp.name.split(' ')[0]}`} description={`${emp.designation} · ${emp.schedule}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={emp.name} size="lg" src={emp.photoUrl} />
              <div>
                <p className="text-lg font-semibold">{emp.name}</p>
                <p className="text-xs text-ink-muted">{emp.designation} · {emp.code}</p>
              </div>
            </div>
            <StatusBadge status={attendanceStatus(todayDay, state.settings)} />
          </div>
          <DailyTargetCard employee={emp} />
          <Panel title="Today’s work log" actions={<Link to="/employee/work-logs" className="text-sm font-medium text-brand-700">All logs</Link>} flush>
            <SessionsTable sessions={todaySessions} emptyTitle="Nothing logged yet today" emptyBody="Start the timer above when you begin working." />
          </Panel>
          <Panel title="This week" description={`${fmtMin(weekDone)} of ${fmtMin(weekExpected)} expected`}>
            <WeekBars days={weekDays} today={today} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <dl className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-ink-muted">Attendance today</dt>
                <dd><StatusBadge status={attendanceStatus(todayDay, state.settings)} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-ink-muted">Current project</dt>
                <dd className="truncate text-sm font-medium">{currentProject?.name ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-ink-muted">Last week’s timesheet</dt>
                <dd><Link to="/employee/timesheets"><StatusBadge status={ts?.status ?? 'Draft'} /></Link></dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Assigned tasks" actions={<Link to="/employee/projects" className="text-sm font-medium text-brand-700">My projects</Link>} flush>
            {openTasks.length === 0 ?
            <EmptyState icon={ListChecksIcon} title="No open tasks" /> :

            <ul className="divide-y divide-line">
                {openTasks.slice(0, 5).map((t) =>
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-ink-muted">{project(t.projectId)?.code} · due {fmtDate(t.dueDate, 'd MMM')}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
              )}
              </ul>
            }
          </Panel>

          <Panel title="Coming up">
            <ul className="space-y-3">
              {leaves.map((l) =>
              <li key={l.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" />
                  <div>
                    <p className="text-sm font-medium">{l.type} Leave · approved</p>
                    <p className="text-xs text-ink-muted">{fmtDate(l.startDate, 'EEE d MMM')}{l.endDate !== l.startDate && ` – ${fmtDate(l.endDate, 'EEE d MMM')}`}</p>
                  </div>
                </li>
              )}
              {holidays.map((h) =>
              <li key={h.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  <div>
                    <p className="text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-ink-muted">{fmtDate(h.date, 'EEE d MMM yyyy')} · {h.type}</p>
                  </div>
                </li>
              )}
              {!leaves.length && !holidays.length && <li className="text-sm text-ink-muted">No upcoming holidays or leave.</li>}
            </ul>
          </Panel>

          <Panel title="Notifications" actions={<Link to="/employee/notifications" className="text-sm font-medium text-brand-700">View all</Link>} flush>
            {notes.length === 0 ?
            <EmptyState icon={BellIcon} title="You’re all caught up" /> :

            <ul className="divide-y divide-line">
                {notes.map((n) =>
              <li key={n.id}>
                    <Link to={n.link} className="block px-5 py-3 hover:bg-canvas">
                      <p className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium text-ink-2')}>{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</p>
                      <p className="mt-1 text-[11px] text-ink-faint">{fmtDateTime(n.createdAt)}</p>
                    </Link>
                  </li>
              )}
              </ul>
            }
          </Panel>
        </div>
      </div>
    </div>);

}