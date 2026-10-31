import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon, ClipboardCheckIcon, XCircleIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from '../../components/badges/SeverityBadge';
import { QAVerificationPanel } from '../../components/qa/QAVerificationPanel';
import { AccessRestricted } from '../../components/ui/AccessRestricted';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { formatShortDate } from '../../utils/dates';
import { severityRank } from '../../utils/issueStyles';
import { QA_STATUSES } from '../../utils/workflow';

type QueueFilter = 'all' | 'Fixed' | 'QA Testing';
const verificationLabel = { Fixed: 'Awaiting QA', 'QA Testing': 'In testing' } as Record<string, string>;

export function QAVerification() {
  const { permissions, scopedIssues, getEmployee, getProject } = useBugTracker();
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{type: 'passed' | 'failed';issue: Issue;} | null>(null);

  const queue = useMemo(
    () =>
    scopedIssues.
    filter((i) => QA_STATUSES.includes(i.status) && (filter === 'all' || i.status === filter)).
    sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || (a.submittedForQaAt ?? '').localeCompare(b.submittedForQaAt ?? '')),
    [scopedIssues, filter]
  );
  const recentlyVerified = useMemo(
    () =>
    scopedIssues.
    filter((i) => (i.qa.status === 'Passed' || i.qa.status === 'Failed') && i.qa.verifiedAt).
    sort((a, b) => (b.qa.verifiedAt ?? '').localeCompare(a.qa.verifiedAt ?? '')).
    slice(0, 4),
    [scopedIssues]
  );

  useEffect(() => {
    if (!outcome && (!selectedId || !queue.some((i) => i.id === selectedId))) setSelectedId(queue[0]?.id ?? null);
  }, [queue, selectedId, outcome]);

  if (!permissions.viewQAQueue) return <AccessRestricted area="QA Verification" />;

  const selected = queue.find((i) => i.id === selectedId);
  const allQueue = scopedIssues.filter((i) => QA_STATUSES.includes(i.status));
  const filters: {id: QueueFilter;label: string;count: number;}[] = [
  { id: 'all', label: 'All', count: allQueue.length },
  { id: 'Fixed', label: 'Awaiting QA', count: allQueue.filter((i) => i.status === 'Fixed').length },
  { id: 'QA Testing', label: 'In testing', count: allQueue.filter((i) => i.status === 'QA Testing').length }];


  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="QA verification" description="Fixes submitted by developers, most severe first." />

      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="Queue filter">
              {filters.map((f) =>
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 ${filter === f.id ? 'bg-accent-soft text-accent-ink' : 'text-ink-subtle hover:bg-canvas hover:text-ink'}`}>
                
                  {f.label} <span className="text-xs opacity-70">{f.count}</span>
                </button>
              )}
            </div>
            {queue.length === 0 ?
            <EmptyState icon={ClipboardCheckIcon} title="Queue is clear" description="No fixes are waiting for verification right now." /> :

            <ul className="divide-y divide-line">
                {queue.map((issue) => {
                const active = issue.id === selectedId && !outcome;
                const developer = getEmployee(issue.assigneeId);
                return (
                  <li key={issue.id}>
                      <button
                      type="button"
                      onClick={() => {
                        setOutcome(null);
                        setSelectedId(issue.id);
                      }}
                      aria-current={active ? 'true' : undefined}
                      className={`relative w-full px-4 py-3 text-left transition-colors duration-150 ${active ? 'bg-accent-soft' : 'hover:bg-canvas'}`}>
                      
                        {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden="true" />}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-ink-subtle">{issue.key}</span>
                          <span className={`text-xs font-medium ${issue.status === 'Fixed' ? 'text-teal-ink' : 'text-warning-ink'}`}>{verificationLabel[issue.status]}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-ink">{issue.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                          <SeverityBadge severity={issue.severity} />
                          <span>{getProject(issue.projectId)?.name}</span>
                          <span className="inline-flex items-center gap-1">
                            <Avatar employee={developer} size="xs" />
                            {developer?.name?.split(' ')[0]}
                          </span>
                          <span>Submitted {formatShortDate(issue.submittedForQaAt)}</span>
                        </div>
                      </button>
                    </li>);

              })}
              </ul>
            }
          </section>

          {recentlyVerified.length > 0 &&
          <section className="rounded-lg border border-line bg-surface shadow-card">
              <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Recently verified</h2>
              <ul className="divide-y divide-line">
                {recentlyVerified.map((issue) =>
              <li key={issue.id}>
                    <Link to={bugTrackerRoutes.issue(issue.key)} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 hover:bg-canvas">
                      {issue.qa.status === 'Passed' ?
                  <CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" aria-label="Passed" /> :

                  <XCircleIcon className="h-4 w-4 shrink-0 text-danger" aria-label="Failed" />
                  }
                      <span className="font-mono text-xs text-ink-subtle">{issue.key}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{issue.title}</span>
                    </Link>
                  </li>
              )}
              </ul>
            </section>
          }
        </div>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-card lg:self-start" aria-live="polite">
          {outcome ?
          <OutcomeState
            outcome={outcome.type}
            issue={outcome.issue}
            developerName={getEmployee(outcome.issue.assigneeId)?.name}
            hasNext={queue.length > 0}
            onNext={() => {
              setOutcome(null);
              setSelectedId(queue[0]?.id ?? null);
            }} /> :

          selected ?
          <QAVerificationPanel issue={selected} onOutcome={(type, issue) => setOutcome({ type, issue })} /> :

          <EmptyState icon={ClipboardCheckIcon} title="Select an issue to verify" description="Pick an item from the queue to see the fix summary and verification steps." />
          }
        </section>
      </div>
    </div>);

}

interface OutcomeStateProps {
  outcome: 'passed' | 'failed';
  issue: Issue;
  developerName?: string;
  hasNext: boolean;
  onNext: () => void;
}

function OutcomeState({ outcome, issue, developerName, hasNext, onNext }: OutcomeStateProps) {
  const passed = outcome === 'passed';
  const Icon = passed ? CheckCircle2Icon : XCircleIcon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className={`rounded-lg border p-6 text-center ${passed ? 'border-success-line bg-success-soft' : 'border-danger-line bg-danger-soft'}`}>
      
      <Icon className={`mx-auto h-8 w-8 ${passed ? 'text-success' : 'text-danger'}`} aria-hidden="true" />
      <h2 className={`mt-3 text-base font-semibold ${passed ? 'text-success-ink' : 'text-danger-ink'}`}>
        {passed ? `${issue.key} passed verification` : `${issue.key} failed verification`}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
        {passed ?
        'The issue is now Resolved. The reporter and developer have been notified, and a manager can close it.' :
        `The issue was reopened and returned to ${developerName ?? 'the developer'} with your reason.`}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to={bugTrackerRoutes.issue(issue.key)}
          className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-canvas">
          
          View issue
        </Link>
        {hasNext &&
        <Button variant="primary" onClick={onNext}>
            Next in queue
          </Button>
        }
      </div>
    </motion.div>);

}