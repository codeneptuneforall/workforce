import type { Issue } from '../types/bugTracker';
import { daysFromToday } from './dates';
import { isOpenStatus, QA_STATUSES } from './workflow';

export function isOverdue(issue: Issue): boolean {
  return Boolean(issue.dueDate) && isOpenStatus(issue.status) && daysFromToday(issue.dueDate as string) < 0;
}

export function dueLabel(issue: Issue): {text: string;tone: 'danger' | 'warning' | 'muted';} {
  if (!issue.dueDate) return { text: 'No due date', tone: 'muted' };
  if (!isOpenStatus(issue.status)) return { text: `Due ${issue.dueDate.slice(5).replace('-', '/')}`, tone: 'muted' };
  const days = daysFromToday(issue.dueDate);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'danger' };
  if (days === 0) return { text: 'Due today', tone: 'warning' };
  if (days <= 2) return { text: `Due in ${days}d`, tone: 'warning' };
  return { text: `Due in ${days}d`, tone: 'muted' };
}

export interface IssueMetrics {
  total: number;
  open: number;
  inProgress: number;
  criticalHigh: number;
  awaitingQa: number;
  overdue: number;
  resolved: number;
  assignedToMe: number;
}

export function computeIssueMetrics(list: Issue[], userId: string): IssueMetrics {
  return {
    total: list.length,
    open: list.filter((i) => isOpenStatus(i.status)).length,
    inProgress: list.filter((i) => i.status === 'In Progress').length,
    criticalHigh: list.filter((i) => isOpenStatus(i.status) && (i.severity === 'Critical' || i.severity === 'High')).length,
    awaitingQa: list.filter((i) => QA_STATUSES.includes(i.status)).length,
    overdue: list.filter(isOverdue).length,
    resolved: list.filter((i) => !isOpenStatus(i.status)).length,
    assignedToMe: list.filter((i) => i.assigneeId === userId && isOpenStatus(i.status)).length
  };
}