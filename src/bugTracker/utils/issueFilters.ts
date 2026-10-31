import type { Issue, IssueFilterState, IssuePreset, SortState } from '../types/bugTracker';
import { isOverdue } from './issueMetrics';
import { priorityRank, severityRank } from './issueStyles';
import { ALL_STATUSES, isOpenStatus, QA_STATUSES } from './workflow';

export const emptyFilters: IssueFilterState = {
  search: '',
  projectId: '',
  status: '',
  severity: '',
  priority: '',
  type: '',
  assigneeId: '',
  reporterId: '',
  dateFrom: '',
  dateTo: '',
  preset: ''
};

export const presetLabels: Record<Exclude<IssuePreset, ''>, string> = {
  open: 'Open issues',
  overdue: 'Overdue',
  'awaiting-qa': 'Awaiting QA',
  'critical-high': 'Open critical & high',
  resolved: 'Resolved & closed',
  'in-progress': 'In progress',
  mine: 'Assigned to me'
};

function matchesPreset(issue: Issue, preset: IssuePreset, userId: string): boolean {
  switch (preset) {
    case 'open':
      return isOpenStatus(issue.status);
    case 'overdue':
      return isOverdue(issue);
    case 'awaiting-qa':
      return QA_STATUSES.includes(issue.status);
    case 'critical-high':
      return isOpenStatus(issue.status) && (issue.severity === 'Critical' || issue.severity === 'High');
    case 'resolved':
      return !isOpenStatus(issue.status);
    case 'in-progress':
      return issue.status === 'In Progress';
    case 'mine':
      return issue.assigneeId === userId && isOpenStatus(issue.status);
    default:
      return true;
  }
}

export function filterIssues(list: Issue[], f: IssueFilterState, userId: string): Issue[] {
  const query = f.search.trim().toLowerCase();
  return list.filter((issue) => {
    if (query) {
      const haystack = `${issue.key} ${issue.title} ${issue.feature} ${issue.labels.join(' ')}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (f.projectId && issue.projectId !== f.projectId) return false;
    if (f.status && issue.status !== f.status) return false;
    if (f.severity && issue.severity !== f.severity) return false;
    if (f.priority && issue.priority !== f.priority) return false;
    if (f.type && issue.type !== f.type) return false;
    if (f.assigneeId === 'unassigned' && issue.assigneeId) return false;
    if (f.assigneeId && f.assigneeId !== 'unassigned' && issue.assigneeId !== f.assigneeId) return false;
    if (f.reporterId && issue.reporterId !== f.reporterId) return false;
    const created = issue.createdAt.slice(0, 10);
    if (f.dateFrom && created < f.dateFrom) return false;
    if (f.dateTo && created > f.dateTo) return false;
    if (f.preset && !matchesPreset(issue, f.preset, userId)) return false;
    return true;
  });
}

interface SortLookups {
  employeeName: (id: string | null) => string;
  projectName: (id: string) => string;
}

export function sortIssues(list: Issue[], sort: SortState, lookups: SortLookups): Issue[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const value = (issue: Issue): string | number => {
    switch (sort.key) {
      case 'key':
        return parseInt(issue.key.replace(/\D/g, ''), 10);
      case 'title':
        return issue.title.toLowerCase();
      case 'project':
        return lookups.projectName(issue.projectId);
      case 'type':
        return issue.type;
      case 'severity':
        return severityRank[issue.severity];
      case 'priority':
        return priorityRank[issue.priority];
      case 'status':
        return ALL_STATUSES.indexOf(issue.status);
      case 'assignee':
        return issue.assigneeId ? lookups.employeeName(issue.assigneeId) : '\uffff';
      case 'reporter':
        return lookups.employeeName(issue.reporterId);
      case 'createdAt':
        return issue.createdAt;
      case 'dueDate':
        return issue.dueDate ?? (dir === 1 ? '9999' : '0000');
      default:
        return 0;
    }
  };
  return [...list].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}