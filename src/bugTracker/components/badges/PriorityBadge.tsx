import React from 'react';
import { ChevronDownIcon, ChevronsUpIcon, ChevronUpIcon, EqualIcon } from 'lucide-react';
import type { Priority } from '../../types/bugTracker';
import { priorityStyles } from '../../utils/issueStyles';

const icons: Record<string, any> = { 'P1 (High)': ChevronsUpIcon, 'P2 (Medium)': ChevronUpIcon, 'P3 (Low)': EqualIcon };

export function PriorityBadge({ priority, iconOnly = false }: {priority: string;iconOnly?: boolean;}) {
  const Icon = icons[priority] || ChevronUpIcon;
  const style = (priorityStyles as Record<string, {text: string}>)[priority] || { text: 'text-ink-faint' };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-ink-muted" title={`${priority} priority`}>
      <Icon className={`h-4 w-4 ${style.text}`} aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{priority} priority</span> : priority}
    </span>);

}