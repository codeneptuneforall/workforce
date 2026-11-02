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
  Blocker: { badge: 'bg-danger text-white', hex: '#D92D20' },
  Critical: { badge: 'bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning-line', hex: '#DC6803' },
  Major: { badge: 'bg-info-soft text-info-ink ring-1 ring-inset ring-info-line', hex: '#1570EF' },
  Minor: { badge: 'bg-neutral-soft text-neutral-ink ring-1 ring-inset ring-line', hex: '#98A2B3' }
};

export const priorityStyles: Record<Priority, {text: string;}> = {
  'P1 (High)': { text: 'text-danger' },
  'P2 (Medium)': { text: 'text-warning' },
  'P3 (Low)': { text: 'text-info' }
};

export const severityRank: Record<string, number> = { Blocker: 0, Critical: 1, Major: 2, Minor: 3 };
export const priorityRank: Record<string, number> = { 'P1 (High)': 0, 'P2 (Medium)': 1, 'P3 (Low)': 2 };

export function severityRankOf(severity: string): number {
  return severityRank[severity] ?? 99;
}
export function priorityRankOf(priority: string): number {
  return priorityRank[priority] ?? 99;
}