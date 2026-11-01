import React, { useMemo, useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CreatedResolvedChart } from '../../components/charts/CreatedResolvedChart';
import { IssuesByProjectChart } from '../../components/charts/IssuesByProjectChart';
import { TeamWorkloadChart } from '../../components/charts/TeamWorkloadChart';
import { AccessRestricted } from '../../components/ui/AccessRestricted';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/SelectField';
import { useBugTracker } from '../../contexts/BugTrackerContext';
// Sample trend/KPI data removed; values are now derived from real issues.
import { severities } from '../../data/trackerConfig';
import { isOverdue } from '../../utils/issueMetrics';
import { severityStyles } from '../../utils/issueStyles';
import { isOpenStatus } from '../../utils/workflow';

const rangeOptions = [
{ value: '4', label: 'Last 4 weeks' },
{ value: '8', label: 'Last 8 weeks' },
{ value: '12', label: 'Last 12 weeks' }];


export function Reports() {
  const { permissions, scopedIssues, accessibleProjects, projectScope, setProjectScope, employees, getProject } = useBugTracker();
  const [weeks, setWeeks] = useState('8');

  const open = scopedIssues.filter((i) => isOpenStatus(i.status));
  // Derive weekly created/resolved trend from real issues (no sample data).
  const trend = useMemo(() => {
    const buckets = new Map<string, { week: string; created: number; resolved: number }>();
    const weekKey = (iso: string) => {
      const d = new Date(iso);
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day - 1));
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    };
    for (const i of scopedIssues) {
      const wk = weekKey(i.createdAt);
      if (!buckets.has(wk)) buckets.set(wk, { week: wk.slice(5), created: 0, resolved: 0 });
      buckets.get(wk)!.created++;
      if (!isOpenStatus(i.status)) {
        const rwk = weekKey(i.updatedAt || i.createdAt);
        if (!buckets.has(rwk)) buckets.set(rwk, { week: rwk.slice(5), created: 0, resolved: 0 });
        buckets.get(rwk)!.resolved++;
      }
    }
    const sorted = [...buckets.values()].sort((a, b) => a.week.localeCompare(b.week));
    return sorted.slice(-Number(weeks));
  }, [scopedIssues, weeks]);

  const severityData = severities.map((s) => ({ name: s, value: open.filter((i) => i.severity === s).length, fill: severityStyles[s].hex }));
  const projectData = useMemo(
    () =>
    accessibleProjects.
    filter((p) => projectScope === 'all' || p.id === projectScope).
    map((p) => {
      const list = scopedIssues.filter((i) => i.projectId === p.id);
      return { project: p.name, open: list.filter((i) => isOpenStatus(i.status)).length, resolved: list.filter((i) => !isOpenStatus(i.status)).length };
    }),
    [accessibleProjects, projectScope, scopedIssues]
  );
  const workloadData = employees.
  filter((e) => e.role === 'developer').
  map((e) => {
    const mine = open.filter((i) => i.assigneeId === e.id);
    return {
      name: e.name.split(' ')[0],
      toStart: mine.filter((i) => i.status === 'Assigned').length,
      inProgress: mine.filter((i) => i.status === 'In Progress').length,
      reopened: mine.filter((i) => i.status === 'Reopened').length,
      withQa: mine.filter((i) => i.status === 'Fixed' || i.status === 'QA Testing').length
    };
  });
  const overdueList = open.filter(isOverdue);

  if (!permissions.viewReports) return <AccessRestricted area="Reports & Analytics" />;

  const resolvedIssues = scopedIssues.filter((i) => !isOpenStatus(i.status));
  const reopenedCount = scopedIssues.filter((i) => i.status === 'Reopened').length;
  const avgResolutionDays = resolvedIssues.length
    ? (resolvedIssues.reduce((acc, i) => {
        const created = new Date(i.createdAt).getTime();
        const resolved = new Date((i as any).resolution?.resolvedAt || i.updatedAt).getTime();
        return acc + Math.max(0, (resolved - created) / 86400000);
      }, 0) / resolvedIssues.length).toFixed(1)
    : '—';
  const reopenRate = resolvedIssues.length ? ((reopenedCount / resolvedIssues.length) * 100).toFixed(1) : '0.0';

  const kpis = [
  {
    label: 'Average resolution time',
    value: `${avgResolutionDays} days`,
    note: <span className="inline-flex items-center gap-1 text-success-ink">{resolvedIssues.length} resolved issues</span>
  },
  { label: 'Reopened issue rate', value: `${reopenRate}%`, note: `${reopenedCount} of ${resolvedIssues.length} resolved` },
  { label: 'Open issues', value: String(open.length), note: `${open.filter((i) => i.severity === 'Critical').length} critical` },
  { label: 'Overdue issues', value: String(overdueList.length), note: overdueList.length ? overdueList.map((i) => i.key).join(', ') : 'None overdue', danger: overdueList.length > 0 }];


  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Reports & analytics"
        description="Throughput, quality and workload across your projects."
        actions={
        <>
            <SelectField
            id="reports-project"
            compact
            ariaLabel="Project"
            placeholder="All projects"
            value={projectScope === 'all' ? '' : projectScope}
            onChange={(v) => setProjectScope(v || 'all')}
            options={accessibleProjects.map((p) => ({ value: p.id, label: p.name }))}
            className="w-44" />
          
            <SelectField id="reports-range" compact ariaLabel="Date range" value={weeks} onChange={setWeeks} options={rangeOptions} className="w-40" />
          </>
        } />
      

      <p className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-subtle">
        <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        All metrics, trends and workload reflect the current issues{projectScope !== 'all' ? ` in ${getProject(projectScope)?.name}` : ''}.
      </p>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) =>
        <div key={k.label} className="bg-surface px-5 py-4">
            <dt className="text-[13px] text-ink-muted">{k.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${k.danger ? 'text-danger-ink' : 'text-ink'}`}>{k.value}</dd>
            <dd className="mt-1 truncate text-xs text-ink-subtle">{k.note}</dd>
          </div>
        )}
      </dl>

      <Panel title="Issues created vs resolved" description={`Weekly · ${rangeOptions.find((r) => r.value === weeks)?.label}`}>
        <CreatedResolvedChart data={trend} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Open issues by severity">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#EEF0F3" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#344054' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F5F6F8' }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} formatter={(v) => [v, 'Open issues']} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {severityData.map((d) =>
                  <Cell key={d.name} fill={d.fill} />
                  )}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#101828', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Issues by project">
          <IssuesByProjectChart data={projectData} />
        </Panel>
      </div>

      <Panel title="Team workload" description="Open issues per developer by stage">
        <TeamWorkloadChart data={workloadData} />
      </Panel>
    </div>);

}