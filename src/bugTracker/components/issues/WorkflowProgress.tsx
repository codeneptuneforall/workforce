import React from 'react';
import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import type { IssueStatus } from '../../types/bugTracker';
import { WORKFLOW_STATUSES } from '../../utils/workflow';

export function WorkflowProgress({ status }: {status: IssueStatus;}) {
  const reopened = status === 'Reopened';
  const currentIndex = reopened ? WORKFLOW_STATUSES.indexOf('In Progress') : WORKFLOW_STATUSES.indexOf(status);

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-[640px] items-center" aria-label="Workflow progress">
        {WORKFLOW_STATUSES.map((step, idx) => {
          const done = idx < currentIndex || !reopened && status === 'Closed' && idx === currentIndex;
          const current = idx === currentIndex && !(status === 'Closed');
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={current ? 'step' : undefined}>
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  done ? 'bg-accent text-white' : current ? reopened ? 'bg-danger text-white' : 'border-2 border-accent bg-surface text-accent' : 'border border-line-strong bg-surface text-ink-faint'}`
                  }>
                  
                  {done ? <CheckIcon className="h-3 w-3" aria-hidden="true" /> : current && reopened ? <RotateCcwIcon className="h-3 w-3" aria-hidden="true" /> : idx + 1}
                </span>
                <span className={`whitespace-nowrap text-xs ${current ? 'font-semibold text-ink' : done ? 'text-ink-muted' : 'text-ink-faint'}`}>
                  {current && reopened ? 'Reopened' : step}
                </span>
              </div>
              {idx < WORKFLOW_STATUSES.length - 1 && <span className={`mx-2 h-px flex-1 ${idx < currentIndex ? 'bg-accent' : 'bg-line-strong'}`} aria-hidden="true" />}
            </li>);

        })}
      </ol>
    </div>);

}