import type { Employee, Issue, Role, RolePermissions } from '../types/bugTracker';

// Prototype permission model used to preview role-dependent UI.
// Real authorization must come from Workforce — never rely on this client-side map.
export const rolePermissions: Record<Role, RolePermissions> = {
  admin: { manageSettings: true, triage: true, assign: true, setPriority: true, viewTeam: true, viewQAQueue: true, verifyQA: true, viewReports: true, editAnyIssue: true },
  manager: { manageSettings: false, triage: true, assign: true, setPriority: true, viewTeam: true, viewQAQueue: true, verifyQA: false, viewReports: true, editAnyIssue: true },
  developer: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: false, verifyQA: false, viewReports: false, editAnyIssue: false },
  qa: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: true, verifyQA: true, viewReports: true, editAnyIssue: false },
  reporter: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: false, verifyQA: false, viewReports: false, editAnyIssue: false }
};

export function canViewIssue(issue: Issue, user: Employee): boolean {
  if (user.role === 'admin' || user.role === 'qa') return true;
  if (user.role === 'reporter') return issue.reporterId === user.id;
  return user.projectIds.includes(issue.projectId) || issue.reporterId === user.id || issue.assigneeId === user.id;
}

export function canEditIssue(issue: Issue, user: Employee): boolean {
  if (rolePermissions[user.role].editAnyIssue) return true;
  if (issue.assigneeId === user.id) return true;
  return issue.reporterId === user.id && issue.status === 'New';
}