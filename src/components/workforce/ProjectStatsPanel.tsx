import { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { ClockIcon } from 'lucide-react';
import type { Project } from '@shared/types';
import { projectStats } from '@shared/domain/projectStats';
import { fmtDate, fmtMin, toDateKey, todayKey } from '@shared/domain/time';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Field';
import { Avatar, EmptyState, Panel, ProgressBar } from '../ui/Primitives';
import { Table, Td, Th, Tr } from '../ui/Table';

const periods = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'month', label: 'This month' }
];

/** A horizontal bar list — the label, the bar and the value on one line. */
function BarList({ items }: {items: { key: string; label: string; minutes: number; }[];}) {
  const max = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <ul className="space-y-2.5">
      {items.map((i) =>
      <li key={i.key} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-ink-muted">{i.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out" style={{ width: `${Math.max(i.minutes / max * 100, i.minutes > 0 ? 2 : 0)}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-medium tnum text-ink">{fmtMin(i.minutes)}</span>
        </li>)}
    </ul>);

}

/** A single headline number. */
function Stat({ label, value, hint }: {label: string;value: string;hint?: string;}) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tnum text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>);

}

/**
 * The statistics of a project: who worked on it, for how long, and which task took the
 * most time.
 */
export function ProjectStatsPanel({ project }: {project: Project;}) {
  const { state, personName } = useData();
  const [period, setPeriod] = useState('all');
  const now = useNow(30000);

  const since = useMemo(() => {
    if (period === 'all') return undefined;
    if (period === 'month') return `${todayKey(now).slice(0, 7)}-01`;
    return toDateKey(subDays(new Date(now), Number(period) - 1));
  }, [period, now]);

  const stats = useMemo(() => projectStats(state, project.id, since, now), [state, project.id, since, now]);

  const busiestDays = useMemo(() => [...stats.daily].sort((a, b) => b.minutes - a.minutes).slice(0, 7), [stats.daily]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {stats.sessionCount === 0 ? 'Nothing has been recorded on this project yet.' :
          `Based on ${stats.sessionCount} session${stats.sessionCount === 1 ? '' : 's'} recorded on this project.`}
        </p>
        <div className="w-full sm:w-52">
          <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
      </div>

      {stats.sessionCount === 0 ?
      <Panel>
        <EmptyState icon={ClockIcon} title="No time logged yet" body="As soon as somebody records time on this project, the breakdown by person and by task appears here." />
      </Panel> :
      <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total logged" value={fmtMin(stats.totalMinutes)} hint={`${stats.sessionCount} session${stats.sessionCount === 1 ? '' : 's'}`} />
          <Stat label="People" value={String(stats.contributorCount)} hint={stats.contributorCount === 1 ? 'worked on it' : 'worked on it'} />
          <Stat label="Tasks with time" value={String(stats.tasksTouched)} hint="on this project" />
          <Stat label="Average session" value={fmtMin(stats.averageSessionMinutes)} hint={`longest session ${fmtMin(stats.longestSessionMinutes)}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
          flush
          title="Who worked on this project"
          description="Every person who recorded time here, with their share of the total.">
            <Table>
              <thead><tr><Th>Person</Th><Th align="right">Sessions</Th><Th align="right">Total</Th><Th align="right">Avg session</Th><Th align="right">Longest</Th><Th>Share</Th></tr></thead>
              <tbody>
                {stats.contributors.map((c) =>
                <Tr key={c.employeeId}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={personName(c.employeeId)} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium">{personName(c.employeeId)}</p>
                          <p className="text-xs text-ink-muted">
                            {fmtDate(c.firstDate, 'd MMM')} – {fmtDate(c.lastDate, 'd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td align="right">{c.sessions}</Td>
                    <Td align="right" className="font-medium">{fmtMin(c.minutes)}</Td>
                    <Td align="right">{fmtMin(c.averageSessionMinutes)}</Td>
                    <Td align="right">{fmtMin(c.longestSessionMinutes)}</Td>
                    <Td className="min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={c.share * 100} className="h-1.5" label={`${personName(c.employeeId)} share of the project`} />
                        <span className="w-9 shrink-0 text-right text-xs tnum text-ink-muted">{Math.round(c.share * 100)}%</span>
                      </div>
                    </Td>
                  </Tr>)}
              </tbody>
            </Table>
          </Panel>

          <Panel
          flush
          title="Where the time went"
          description="The tasks of this project, ranked by logged time — the longest one is on top.">
            <Table>
              <thead><tr><Th>Task</Th><Th align="right">Sessions</Th><Th align="right">Total</Th><Th align="right">Avg</Th><Th>Share</Th></tr></thead>
              <tbody>
                {stats.tasks.map((t, i) =>
                <Tr key={t.taskId}>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.title}</span>
                        {i === 0 && stats.tasks.length > 1 && <Badge tone="brand">Longest task</Badge>}
                      </div>
                    </Td>
                    <Td align="right">{t.sessions}</Td>
                    <Td align="right" className="font-medium">{fmtMin(t.minutes)}</Td>
                    <Td align="right">{fmtMin(t.averageSessionMinutes)}</Td>
                    <Td className="min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={t.share * 100} className="h-1.5" label={`${t.title} share of the project`} />
                        <span className="w-9 shrink-0 text-right text-xs tnum text-ink-muted">{Math.round(t.share * 100)}%</span>
                      </div>
                    </Td>
                  </Tr>)}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Hours per week" description="How the project's time was spread over the weeks.">
            {stats.weekly.length === 0 ? <p className="text-sm text-ink-muted">No time recorded in this period.</p> :
            <BarList items={stats.weekly.map((w) => ({ key: w.week, label: `Week of ${fmtDate(w.week, 'd MMM yyyy')}`, minutes: w.minutes }))} />}
          </Panel>
          <Panel title="Busiest days" description="The days with the most time recorded on this project.">
            {busiestDays.length === 0 ? <p className="text-sm text-ink-muted">No time recorded in this period.</p> :
            <BarList items={busiestDays.map((d) => ({ key: d.date, label: fmtDate(d.date, 'EEE d MMM yyyy'), minutes: d.minutes }))} />}
          </Panel>
        </div>
      </>}
    </div>);

}
