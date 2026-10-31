export type IssueStatus =
'New' |
'Triaged' |
'Assigned' |
'In Progress' |
'Fixed' |
'QA Testing' |
'Resolved' |
'Closed' |
'Reopened';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';
export type IssueType =
'Bug' |
'UI/UX Issue' |
'Functional Issue' |
'Performance Issue' |
'Security Issue' |
'Enhancement' |
'Task';
export type Environment = 'Production' | 'Staging' | 'QA' | 'Development';
export type Role = 'admin' | 'manager' | 'developer' | 'qa' | 'reporter';
export type QAStatus = 'Not submitted' | 'Awaiting QA' | 'In testing' | 'Passed' | 'Failed';

export interface Project {
  id: string;
  name: string;
  code: string;
  leadId: string;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
}

export interface Employee {
  id: string;
  name: string;
  initials: string;
  title: string;
  email: string;
  teamId: string;
  role: Role;
  projectIds: string[];
  userId?: string;
}

export interface Attachment {
  id: string;
  name: string;
  sizeKb: number;
  kind: 'image' | 'document' | 'log';
  previewUrl?: string;
  uploadedById: string;
  uploadedAt: string;
}

export type CommentKind = 'comment' | 'test-note' | 'clarification' | 'qa-fail' | 'qa-pass' | 'reopen';

export interface IssueComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  kind: CommentKind;
}

export interface ActivityEntry {
  id: string;
  actorId: string;
  message: string;
  createdAt: string;
  toStatus?: IssueStatus;
}

export interface QAVerification {
  status: QAStatus;
  verifierId?: string;
  notes?: string;
  reason?: string;
  verifiedAt?: string;
}

export interface Resolution {
  summary: string;
  resolvedById: string;
  resolvedAt: string;
  verificationOutcome: string;
}

export interface Issue {
  id: string;
  key: string;
  title: string;
  description: string;
  projectId: string;
  type: IssueType;
  severity: Severity;
  priority: Priority;
  status: IssueStatus;
  assigneeId: string | null;
  reporterId: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  feature: string;
  environment: Environment;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  labels: string[];
  attachments: Attachment[];
  comments: IssueComment[];
  activity: ActivityEntry[];
  relatedIssueKeys: string[];
  blocked?: boolean;
  blockedReason?: string;
  submittedForQaAt?: string;
  fixSummary?: string;
  reopenReason?: string;
  qa: QAVerification;
  resolution?: Resolution;
}

export interface IssueDraft {
  title: string;
  description: string;
  projectId: string;
  type: IssueType | '';
  severity: Severity | '';
  priority: Priority | '';
  feature: string;
  environment: Environment | '';
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  labels: string[];
  assigneeId: string;
  dueDate: string;
  attachments: Attachment[];
}

export type IssueEditablePatch = Partial<
  Pick<Issue, 'title' | 'description' | 'type' | 'severity' | 'priority' | 'dueDate' | 'feature' | 'environment' | 'labels' | 'assigneeId' | 'status'>>;


export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  issueKey?: string;
  createdAt: string;
  read: boolean;
}

export type IssuePreset = '' | 'open' | 'overdue' | 'awaiting-qa' | 'critical-high' | 'resolved' | 'in-progress' | 'mine';

export interface IssueFilterState {
  search: string;
  projectId: string;
  status: string;
  severity: string;
  priority: string;
  type: string;
  assigneeId: string;
  reporterId: string;
  dateFrom: string;
  dateTo: string;
  preset: IssuePreset;
}

export type SortKey =
'key' |
'title' |
'project' |
'type' |
'severity' |
'priority' |
'status' |
'assignee' |
'reporter' |
'createdAt' |
'dueDate';

export interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export interface RolePermissions {
  manageSettings: boolean;
  triage: boolean;
  assign: boolean;
  setPriority: boolean;
  viewTeam: boolean;
  viewQAQueue: boolean;
  verifyQA: boolean;
  viewReports: boolean;
  editAnyIssue: boolean;
}