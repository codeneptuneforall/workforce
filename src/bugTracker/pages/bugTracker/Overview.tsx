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
import { bugTrackerRoutes, portalBase } from '../../data/navigation';
import { computeIssueMetrics } from '../../utils/issueMetrics';
import { isOpenStatus } from '../../utils/workflow';

const rangeOptions = [
{ value: 'all', label: 'All time' },
{ value: '7', label: 'Reported in last 7 days' },
{ value: '30', label: 'Reported in last 30 days' },
{ value: '90', label: 'Reported in last 90 days' }];


export function Overview() {
  const { scopedIssues, currentUser, accessibleProjects, projectScope, setProjectScope, loading } = useBugTracker();
  const [range, setRange] = useState('all');
  const base = portalBase();

  // Compute derived data unconditionally (hooks must be called unconditionally)
  const issues = useMemo(() => {
    if (range === 'all') return scopedIssues;
    const from = format(subDays(new Date(), Number(range)), 'yyyy-MM-dd');
    return scopedIssues.filter((i) => i.createdAt.slice(0, 10) >= from);
  }, [scopedIssues, range]);

  const metrics = computeIssueMetrics(issues, currentUser.id);
  const openIssues = issues.filter((i) => isOpenStatus(i.status));

  // Show loading skeleton while data is being fetched
  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
        <PageHeader
          title={`Good morning, ${currentUser?.name?.split(' ')[0] ?? '...'}`}
          description="Loading issue metrics..."
        />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-3 space-y-5">
            <div className="animate-pulse space-y-4">
              <div className="group flex flex-col justify-between gap-4 border-b border-line p-5 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-neutral-soft rounded animate-pulse" />
                  <div className="h-4 w-4 bg-neutral-soft rounded animate-pulse" />
                </div>
                <div className="h-8 w-32 bg-neutral-soft rounded animate-pulse" />
                <p className="mt-1 text-[13px] text-ink-subtle">
                  <span className="h-3 w-24 bg-neutral-soft rounded animate-pulse" />
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
                  <div className="h-full rounded-full bg-accent animate-pulse" style={{ width: '30%' }} />
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-6">
                {[1,2,3,4,5,6].map((i) => (
                  <li key={i} className="bg-surface animate-pulse">
                    <div className="flex h-full flex-col justify-between gap-3 p-4">
                      <div className="h-3 w-20 bg-neutral-soft rounded animate-pulse" />
                      <div className="h-8 w-16 bg-neutral-soft rounded animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-3 space-y-5">
            {[1,2,3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-5 w-48 bg-neutral-soft rounded mb-3 animate-pulse" />
                <div className="h-64 bg-neutral-soft rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title={`Good morning, ${currentUser.name.split(' ')[0]}`}
        description="Here's where issues stand across your Workforce projects."
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
            <ButtonLink to={`${base}/report`} variant="primary" className="bg-[#4c2e87] hover:bg-[#3a2266]" icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
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
          <Link to={`${base}/issues`} className="text-xs font-medium text-accent hover:text-accent-hover">
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