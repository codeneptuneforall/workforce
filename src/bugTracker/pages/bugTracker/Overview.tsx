import React, { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { PlusIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeverityChart } from '../../components/charts/SeverityChart';
import { StatusChart } from '../../components/charts/StatusChart';
import { MetricOverview } from '../../components/dashboard/MetricOverview';
import { RecentActivity } from '../../components/dashboard/RecentActivity';
import { RecentIssues } from '../../components/dashboard/RecentIssues';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/SelectField';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { computeIssueMetrics } from '../../utils/issueMetrics';
import { isOpenStatus } from '../../utils/workflow';

const rangeOptions = [
{ value: 'all', label: 'All time' },
{ value: '7', label: 'Reported in last 7 days' },
{ value: '30', label: 'Reported in last 30 days' },
{ value: '90', label: 'Reported in last 90 days' }];


export function Overview() {
  const { scopedIssues, currentUser, accessibleProjects, projectScope, setProjectScope } = useBugTracker();
  const [range, setRange] = useState('all');

  const issues = useMemo(() => {
    if (range === 'all') return scopedIssues;
    const from = format(subDays(new Date(), Number(range)), 'yyyy-MM-dd');
    return scopedIssues.filter((i) => i.createdAt.slice(0, 10) >= from);
  }, [scopedIssues, range]);

  const metrics = computeIssueMetrics(issues, currentUser.id);
  const openIssues = issues.filter((i) => isOpenStatus(i.status));

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title={`Good morning, ${currentUser.name.split(' ')[0]}`}
        description="Here’s where issues stand across your Workforce projects."
        actions={
        <>
            <SelectField
            id="overview-project"
            compact
            ariaLabel="Project"
            value={projectScope === 'all' ? '' : projectScope}
            placeholder="All projects"
            onChange={(v) => setProjectScope(v || 'all')}
            options={accessibleProjects.map((p) => ({ value: p.id, label: p.name }))}
            className="w-44" />
          
            <SelectField id="overview-range" compact ariaLabel="Date range" value={range} onChange={setRange} options={rangeOptions} className="w-52" />
            <ButtonLink to={bugTrackerRoutes.report} variant="primary" icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
              Report a bug
            </ButtonLink>
          </>
        } />
      

      <MetricOverview metrics={metrics} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Issues by status" description="All issues in the selected period, in workflow order" className="lg:col-span-2">
          <StatusChart issues={issues} />
        </Panel>
        <Panel title="Open issues by severity" description="Resolved and closed issues excluded">
          <SeverityChart issues={openIssues} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Recently reported"
          className="lg:col-span-2"
          bodyClassName=""
          action={
          <Link to={bugTrackerRoutes.issues} className="text-xs font-medium text-accent hover:text-accent-hover">
              View all issues
            </Link>
          }>
          
          <RecentIssues issues={issues} />
        </Panel>
        <Panel title="Recent activity" bodyClassName="">
          <RecentActivity issues={issues} />
        </Panel>
      </div>
    </div>);

}