import type { IssueStatus, Priority, Severity } from '../types/bugTracker';

export const statusStyles: Record<IssueStatus, {badge: string;dot: string;hex: string;}> = {
  New: { badge: 'bg-neutral-soft text-neutral-ink', dot: 'bg-neutral', hex: '#667085' },
  Triaged: { badge: 'bg-violet-soft text-violet-ink', dot: 'bg-violet', hex: '#7A5AF8' },
  Assigned: { badge: 'bg-info-soft text-info-ink', dot: 'bg-info', hex: '#1570EF' },
  'In Progress': { badge: 'bg-accent-soft text-accent-ink', dot: 'bg-accent', hex: '#2B59C3' },
  Fixed: { badge: 'bg-teal-soft text-teal-ink', dot: 'bg-teal', hex: '#0E9384' },
  'QA Testing': { badge: 'bg-warning-soft text-warning-ink', dot: 'bg-warning', hex: '#DC6803' },
  Resolved: { badge: 'bg-success-soft text-success-ink', dot: 'bg-success', hex: '#079455' },
  Closed: { badge: 'bg-neutral-soft text-ink-subtle', dot: 'bg-ink-faint', hex: '#98A2B3' },
  Reopened: { badge: 'bg-danger-soft text-danger-ink', dot: 'bg-danger', hex: '#D92D20' }
};

export const severityStyles: Record<Severity, {badge: string;hex: string;}> = {
  Critical: { badge: 'bg-danger text-white', hex: '#D92D20' },
  High: { badge: 'bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning-line', hex: '#DC6803' },
  Medium: { badge: 'bg-info-soft text-info-ink ring-1 ring-inset ring-info-line', hex: '#1570EF' },
  Low: { badge: 'bg-neutral-soft text-neutral-ink ring-1 ring-inset ring-line', hex: '#98A2B3' }
};

export const priorityStyles: Record<Priority, {text: string;}> = {
  Urgent: { text: 'text-danger' },
  High: { text: 'text-warning' },
  Normal: { text: 'text-info' },
  Low: { text: 'text-ink-faint' }
};

export const severityRank: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const priorityRank: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };