import React from 'react';
import type { Severity } from '../../types/bugTracker';
import { severityStyles } from '../../utils/issueStyles';

export function SeverityBadge({ severity }: {severity: string;}) {
  const style = (severityStyles as Record<string, {badge: string;hex: string}>)[severity] || { badge: 'bg-neutral-soft text-neutral-ink', hex: '#98A2B3' };
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.badge}`}>
      {severity}
    </span>);

}