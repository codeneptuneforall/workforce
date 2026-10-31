import React from 'react';
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import type { Issue } from '../../types/bugTracker';
import { formatDateTime } from '../../utils/dates';

export function ResolutionPanel({ issue }: {issue: Issue;}) {
  const { getEmployee } = useBugTracker();

  if (issue.resolution) {
    const resolver = getEmployee(issue.resolution.resolvedById);
    const verifier = getEmployee(issue.qa.verifierId);
    return (
      <section className="rounded-lg border border-success-line bg-success-soft p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 space-y-2 text-[13px]">
            <div>
              <h2 className="text-sm font-semibold text-success-ink">{issue.resolution.verificationOutcome}</h2>
              <p className="text-success-ink/80">
                Resolved {formatDateTime(issue.resolution.resolvedAt)} · fixed by {resolver?.name}
                {verifier && issue.qa.status === 'Passed' ? ` · verified by ${verifier.name}` : ''}
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">Resolution notes</p>
              <p className="text-ink-muted">{issue.resolution.summary}</p>
            </div>
            {issue.qa.notes &&
            <div>
                <p className="font-medium text-ink">Verification notes</p>
                <p className="text-ink-muted">{issue.qa.notes}</p>
              </div>
            }
          </div>
        </div>
      </section>);

  }

  if (issue.status === 'Reopened') {
    const failedByQa = issue.qa.status === 'Failed';
    const Icon = failedByQa ? XCircleIcon : RotateCcwIcon;
    return (
      <section className="rounded-lg border border-danger-line bg-danger-soft p-4">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="text-[13px]">
            <h2 className="text-sm font-semibold text-danger-ink">{failedByQa ? 'Failed QA verification' : 'Reopened'}</h2>
            <p className="mt-1 text-ink-muted">{issue.qa.reason ?? issue.reopenReason ?? 'No reason provided.'}</p>
            {failedByQa && issue.qa.verifiedAt &&
            <p className="mt-1 text-xs text-danger-ink/80">
                {getEmployee(issue.qa.verifierId)?.name} · {formatDateTime(issue.qa.verifiedAt)}
              </p>
            }
          </div>
        </div>
      </section>);

  }

  if (issue.fixSummary && (issue.status === 'Fixed' || issue.status === 'QA Testing')) {
    return (
      <section className="rounded-lg border border-teal-line bg-teal-soft p-4 text-[13px]">
        <h2 className="text-sm font-semibold text-teal-ink">Fix submitted for verification</h2>
        <p className="mt-1 text-ink-muted">{issue.fixSummary}</p>
      </section>);

  }

  return null;
}