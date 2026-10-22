import type * as React from 'react';
import type { Tone } from '@shared/types';
import { cn } from '../../utils/cn';

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-2 border-line',
  ok: 'bg-ok-bg text-ok border-ok-line',
  warn: 'bg-warn-bg text-warn border-warn-line',
  bad: 'bg-bad-bg text-bad border-bad-line',
  info: 'bg-info-bg text-info border-info-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200'
};

const dots: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  brand: 'bg-brand-600'
};

const statusTones: Record<string, Tone> = {
  'Target Completed': 'ok',
  Approved: 'ok',
  Completed: 'ok',
  Released: 'ok',
  'Salary Credited': 'ok',
  Active: 'ok',
  Present: 'ok',
  Published: 'ok',
  Working: 'ok',
  Calculated: 'info',
  'Payslips Generated': 'info',
  Generated: 'info',
  'Approved Leave': 'info',
  'Approved Exception': 'info',
  Adjusted: 'info',
  Waived: 'info',
  Confirmed: 'brand',
  Holiday: 'brand',
  'In Progress': 'info',
  'Pending Approval': 'warn',
  'Pending Review': 'warn',
  Paused: 'warn',
  Submitted: 'warn',
  'Under Review': 'warn',
  'Needs Review': 'warn',
  'On Hold': 'warn',
  'Correction Requested': 'warn',
  'Changes Requested': 'warn',
  'Below Target at Day End': 'bad',
  'Below Target': 'bad',
  Rejected: 'bad',
  Blocked: 'bad',
  Absent: 'bad',
  Interrupted: 'bad',
  'Not Recorded': 'neutral',
  'Not Started': 'neutral',
  Draft: 'neutral',
  Planned: 'neutral',
  Archived: 'neutral',
  Inactive: 'neutral',
  Cancelled: 'neutral',
  Superseded: 'neutral',
  'Non-working Day': 'neutral',
  'To Do': 'neutral',
  Idle: 'neutral',
  High: 'bad',
  Medium: 'warn',
  Low: 'neutral'
};

export function toneFor(status: string): Tone {
  return statusTones[status] ?? 'neutral';
}

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export function Badge({ tone = 'neutral', children, dot, pulse, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {dot &&
      <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dots[tone])} />}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dots[tone])} />
        </span>
      }
      {children}
    </span>);

}

export function StatusBadge({ status, className }: {status: string;className?: string;}) {
  const tone = toneFor(status);
  return (
    <Badge tone={tone} dot={status === 'Working' || status === 'Paused'} pulse={status === 'Working'} className={className}>
      {status}
    </Badge>);

}