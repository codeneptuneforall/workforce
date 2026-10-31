import React from 'react';
import { CalendarIcon } from 'lucide-react';
import type { Issue } from '../../types/bugTracker';
import { formatShortDate } from '../../utils/dates';
import { dueLabel } from '../../utils/issueMetrics';

const toneClasses = { danger: 'text-danger-ink font-medium', warning: 'text-warning-ink font-medium', muted: 'text-ink-subtle' };

export function DueDateLabel({ issue, variant = 'date' }: {issue: Issue;variant?: 'date' | 'relative';}) {
  const label = dueLabel(issue);
  if (!issue.dueDate) return <span className="text-xs text-ink-faint">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${toneClasses[label.tone]}`} title={label.text}>
      <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {variant === 'relative' && label.tone !== 'muted' ? label.text : formatShortDate(issue.dueDate)}
    </span>);

}