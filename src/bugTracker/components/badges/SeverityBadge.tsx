import React from 'react';
import type { Severity } from '../../types/bugTracker';
import { severityStyles } from '../../utils/issueStyles';

export function SeverityBadge({ severity }: {severity: Severity;}) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${severityStyles[severity].badge}`}>
      {severity}
    </span>);

}