import type { Environment, IssueType, Priority, Role, Severity } from '../types/bugTracker';

export const issueTypes: IssueType[] = ['Bug', 'UI/UX Issue', 'Functional Issue', 'Performance Issue', 'Security Issue', 'Enhancement', 'Task'];
export const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
export const priorities: Priority[] = ['Urgent', 'High', 'Normal', 'Low'];
export const environments: Environment[] = ['Production', 'Staging', 'QA', 'Development'];

export const workloadCapacity = 5;

export const issueTypeDefinitions = [
{ name: 'Bug', description: 'Existing behavior is broken or incorrect', enabled: true },
{ name: 'UI/UX Issue', description: 'Visual, layout, copy or usability problem', enabled: true },
{ name: 'Functional Issue', description: 'A business rule or workflow behaves incorrectly', enabled: true },
{ name: 'Performance Issue', description: 'Slow responses, timeouts or high resource usage', enabled: true },
{ name: 'Security Issue', description: 'Access, data exposure or authentication weakness', enabled: true },
{ name: 'Enhancement', description: 'Improvement to an existing capability', enabled: true },
{ name: 'Task', description: 'Engineering or maintenance work item', enabled: true }];


export const severityDefinitions = [
{ name: 'Critical', description: 'Payroll, security or data loss impact with no workaround', target: 'Respond in 4 hours' },
{ name: 'High', description: 'Major feature broken for many employees; workaround is painful', target: 'Respond in 1 day' },
{ name: 'Medium', description: 'Feature partially broken; reasonable workaround exists', target: 'Respond in 3 days' },
{ name: 'Low', description: 'Cosmetic or minor inconvenience', target: 'Next planned release' }];


export const priorityDefinitions = [
{ name: 'Urgent', description: 'Interrupt planned work and fix in the current sprint', target: 'Due in 2 days' },
{ name: 'High', description: 'Schedule ahead of other planned work', target: 'Due in 5 days' },
{ name: 'Normal', description: 'Plan into an upcoming sprint', target: 'Due in 10 days' },
{ name: 'Low', description: 'Fix when capacity allows', target: 'Due in 20 days' }];


export const trackerLabels: string[] = [
'regression',
'payroll-impact',
'export',
'email',
'calendar',
'mobile',
'performance',
'security',
'accessibility',
'tax',
'integration',
'customer-reported'];


export const projectDefaults: {projectId: string;defaultAssigneeId: string;defaultPriority: Priority;dueInDays: number;requireQa: boolean;}[] = [
{ projectId: 'p1', defaultAssigneeId: 'e2', defaultPriority: 'Normal', dueInDays: 10, requireQa: true },
{ projectId: 'p1', defaultAssigneeId: 'e7', defaultPriority: 'Normal', dueInDays: 10, requireQa: true },
{ projectId: 'p1', defaultAssigneeId: 'e4', defaultPriority: 'High', dueInDays: 5, requireQa: true },
{ projectId: 'p1', defaultAssigneeId: 'e7', defaultPriority: 'Normal', dueInDays: 10, requireQa: false },
{ projectId: 'p2', defaultAssigneeId: 'e3', defaultPriority: 'Normal', dueInDays: 7, requireQa: true }];


export const permissionMatrix: {capability: string;roles: Role[];}[] = [
{ capability: 'Report issues', roles: ['admin', 'manager', 'developer', 'qa', 'reporter'] },
{ capability: 'View issues in assigned projects', roles: ['admin', 'manager', 'developer', 'qa'] },
{ capability: 'View own reported issues', roles: ['admin', 'manager', 'developer', 'qa', 'reporter'] },
{ capability: 'Comment and add clarifications', roles: ['admin', 'manager', 'developer', 'qa', 'reporter'] },
{ capability: 'Triage and assign developers', roles: ['admin', 'manager'] },
{ capability: 'Set priority and due dates', roles: ['admin', 'manager'] },
{ capability: 'Update assigned issues and submit fixes', roles: ['admin', 'manager', 'developer'] },
{ capability: 'Verify fixes (pass / fail)', roles: ['admin', 'qa'] },
{ capability: 'Reopen resolved issues', roles: ['admin', 'manager', 'qa', 'reporter'] },
{ capability: 'Monitor team workload', roles: ['admin', 'manager'] },
{ capability: 'View reports & analytics', roles: ['admin', 'manager', 'qa'] },
{ capability: 'Manage tracker settings', roles: ['admin'] }];