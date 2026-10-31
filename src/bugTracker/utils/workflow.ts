import type { Issue, IssueStatus, Role } from '../types/bugTracker';

export const WORKFLOW_STATUSES: IssueStatus[] = ['New', 'Triaged', 'Assigned', 'In Progress', 'Fixed', 'QA Testing', 'Resolved', 'Closed'];
export const ALL_STATUSES: IssueStatus[] = ['New', 'Triaged', 'Assigned', 'In Progress', 'Reopened', 'Fixed', 'QA Testing', 'Resolved', 'Closed'];
export const DONE_STATUSES: IssueStatus[] = ['Resolved', 'Closed'];
export const QA_STATUSES: IssueStatus[] = ['Fixed', 'QA Testing'];

export function isOpenStatus(status: IssueStatus): boolean {
  return !DONE_STATUSES.includes(status);
}

export type TransitionId = 'triage' | 'assign' | 'start' | 'resume' | 'submit-qa' | 'start-testing' | 'pass-qa' | 'fail-qa' | 'close' | 'reopen';

export interface TransitionPrompt {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  required: boolean;
  confirmLabel: string;
}

export interface WorkflowTransition {
  id: TransitionId;
  label: string;
  from: IssueStatus[];
  to: IssueStatus;
  roles: Role[];
  activity: string;
  toast: string;
  tone: 'primary' | 'neutral' | 'danger' | 'success';
  assigneeOnly?: boolean;
  opensAssignment?: boolean;
  prompt?: TransitionPrompt;
}

export const transitions: WorkflowTransition[] = [
{ id: 'triage', label: 'Mark as triaged', from: ['New'], to: 'Triaged', roles: ['admin', 'manager'], activity: 'triaged the issue', toast: 'marked as triaged', tone: 'neutral' },
{ id: 'assign', label: 'Assign developer', from: ['New', 'Triaged'], to: 'Assigned', roles: ['admin', 'manager'], activity: 'assigned the issue', toast: 'assigned', tone: 'primary', opensAssignment: true },
{ id: 'start', label: 'Start progress', from: ['Assigned'], to: 'In Progress', roles: ['admin', 'manager', 'developer'], activity: 'started progress', toast: 'moved to In Progress', tone: 'primary', assigneeOnly: true },
{ id: 'resume', label: 'Resume work', from: ['Reopened'], to: 'In Progress', roles: ['admin', 'manager', 'developer'], activity: 'resumed work after reopen', toast: 'moved back to In Progress', tone: 'primary', assigneeOnly: true },
{
  id: 'submit-qa', label: 'Submit for QA', from: ['In Progress'], to: 'Fixed', roles: ['admin', 'manager', 'developer'], activity: 'submitted the fix for QA', toast: 'submitted for QA verification', tone: 'primary', assigneeOnly: true,
  prompt: { title: 'Submit fix for QA', description: 'QA will use this summary to verify the fix.', label: 'Fix summary', placeholder: 'What changed, and how should QA verify it?', required: true, confirmLabel: 'Submit for QA' }
},
{ id: 'start-testing', label: 'Start QA testing', from: ['Fixed'], to: 'QA Testing', roles: ['admin', 'qa'], activity: 'started QA testing', toast: 'moved to QA Testing', tone: 'primary' },
{
  id: 'pass-qa', label: 'Pass verification', from: ['QA Testing'], to: 'Resolved', roles: ['admin', 'qa'], activity: 'passed QA verification', toast: 'passed verification and is resolved', tone: 'success',
  prompt: { title: 'Pass verification', description: 'The issue will move to Resolved with your notes as the verification outcome.', label: 'Test notes', placeholder: 'Devices, data and scenarios you verified (optional)', required: false, confirmLabel: 'Pass verification' }
},
{
  id: 'fail-qa', label: 'Fail verification', from: ['QA Testing'], to: 'Reopened', roles: ['admin', 'qa'], activity: 'failed QA verification', toast: 'failed verification and was reopened', tone: 'danger',
  prompt: { title: 'Fail verification', description: 'The issue will be reopened and returned to the assigned developer.', label: 'Reason for failure', placeholder: 'What still fails, and how to reproduce it', required: true, confirmLabel: 'Fail and reopen' }
},
{
  id: 'close', label: 'Close issue', from: ['Resolved'], to: 'Closed', roles: ['admin', 'manager'], activity: 'closed the issue', toast: 'closed', tone: 'neutral',
  prompt: { title: 'Close this issue?', description: 'Closed issues leave active views. They can still be reopened if the problem returns.', label: 'Closing note', placeholder: 'Optional note for the record', required: false, confirmLabel: 'Close issue' }
},
{
  id: 'reopen', label: 'Reopen', from: ['Resolved', 'Closed'], to: 'Reopened', roles: ['admin', 'manager', 'qa', 'reporter'], activity: 'reopened the issue', toast: 'reopened', tone: 'danger',
  prompt: { title: 'Reopen this issue?', description: 'It will return to the assigned developer with your reason.', label: 'Reason for reopening', placeholder: 'What is still happening?', required: true, confirmLabel: 'Reopen issue' }
}];


export function getTransition(id: TransitionId): WorkflowTransition {
  const transition = transitions.find((t) => t.id === id);
  if (!transition) throw new Error(`Unknown transition ${id}`);
  return transition;
}

export function getAvailableTransitions(issue: Issue, role: Role, userId: string): WorkflowTransition[] {
  return transitions.filter((t) => {
    if (!t.from.includes(issue.status) || !t.roles.includes(role)) return false;
    if (role === 'developer' && t.assigneeOnly && issue.assigneeId !== userId) return false;
    if (role === 'reporter' && issue.reporterId !== userId) return false;
    if (t.id === 'start' && !issue.assigneeId) return false;
    return true;
  });
}

export function findTransitionTo(issue: Issue, target: IssueStatus, role: Role, userId: string): WorkflowTransition | undefined {
  return getAvailableTransitions(issue, role, userId).find((t) => t.to === target);
}