import React from 'react';
import { ArrowUpRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bugTrackerRoutes } from '../../data/navigation';
import type { IssueMetrics } from '../../utils/issueMetrics';

interface MetricOverviewProps {
  metrics: IssueMetrics;
}

export function MetricOverview({ metrics }: MetricOverviewProps) {
  const link = (preset: string) => `${bugTrackerRoutes.issues}?preset=${preset}`;
  const secondary: {label: string;value: number;to: string;tone?: 'danger' | 'warning';}[] = [
  { label: 'In progress', value: metrics.inProgress, to: link('in-progress') },
  { label: 'Critical & high', value: metrics.criticalHigh, to: link('critical-high'), tone: metrics.criticalHigh ? 'danger' : undefined },
  { label: 'Awaiting QA', value: metrics.awaitingQa, to: link('awaiting-qa'), tone: metrics.awaitingQa ? 'warning' : undefined },
  { label: 'Overdue', value: metrics.overdue, to: link('overdue'), tone: metrics.overdue ? 'danger' : undefined },
  { label: 'Resolved & closed', value: metrics.resolved, to: link('resolved') },
  { label: 'Assigned to me', value: metrics.assignedToMe, to: link('mine') }];

  const openShare = metrics.total ? Math.round(metrics.open / metrics.total * 100) : 0;

  return (
    <section aria-label="Issue summary" className="grid overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:grid-cols-[minmax(240px,1fr)_3fr]">
      <Link to={link('open')} className="group flex flex-col justify-between gap-4 border-b border-line p-5 transition-colors duration-150 hover:bg-canvas lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-muted">Open issues</span>
          <ArrowUpRightIcon className="h-4 w-4 text-ink-faint transition-colors duration-150 group-hover:text-accent" aria-hidden="true" />
        </div>
        <div>
          <p className="text-4xl font-semibold tracking-tight text-ink tabular-nums">{metrics.open}</p>
          <p className="mt-1 text-[13px] text-ink-subtle">
            of {metrics.total} total issues · {openShare}% still open
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${openShare}%` }} />
          </div>
        </div>
      </Link>
      <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-6">
        {secondary.map((m) =>
        <li key={m.label} className="bg-surface">
            <Link to={m.to} className="flex h-full flex-col justify-between gap-3 p-4 transition-colors duration-150 hover:bg-canvas">
              <span className="text-[13px] text-ink-muted">{m.label}</span>
              <span className={`text-2xl font-semibold tabular-nums ${m.tone === 'danger' ? 'text-danger-ink' : m.tone === 'warning' ? 'text-warning-ink' : 'text-ink'}`}>{m.value}</span>
            </Link>
          </li>
        )}
      </ul>
    </section>);

}