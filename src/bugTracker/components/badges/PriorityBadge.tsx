import React from 'react';
import { ChevronDownIcon, ChevronsUpIcon, ChevronUpIcon, EqualIcon } from 'lucide-react';
import type { Priority } from '../../types/bugTracker';
import { priorityStyles } from '../../utils/issueStyles';

const icons = { Urgent: ChevronsUpIcon, High: ChevronUpIcon, Normal: EqualIcon, Low: ChevronDownIcon };

export function PriorityBadge({ priority, iconOnly = false }: {priority: Priority;iconOnly?: boolean;}) {
  const Icon = icons[priority];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-ink-muted" title={`${priority} priority`}>
      <Icon className={`h-4 w-4 ${priorityStyles[priority].text}`} aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{priority} priority</span> : priority}
    </span>);

}