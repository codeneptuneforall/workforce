import React from 'react';
import type { IssueStatus } from '../../types/bugTracker';
import { statusStyles } from '../../utils/issueStyles';

export function IssueStatusBadge({ status }: {status: IssueStatus;}) {
  const style = statusStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {status}
    </span>);

}