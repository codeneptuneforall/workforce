import type { AppState, AuthUser, Employee, Project, Role, Task } from '../types';

/**
 * Everything the API exposes to a signed-in account is filtered through this module.
 *
 * The browser never receives the full database: an employee can only see their own
 * records, and salary/payslip data is restricted to the employee it belongs to and to
 * management users who are allowed to run payroll.
 */

/** Management sees everything except other people's raw bank account numbers. */
const maskBankDetails = <T extends {bankName: string;accountNumber: string;}>(ss: T): T => ({
  ...ss,
  accountNumber: ss.accountNumber ? `XXXX XXXX ${ss.accountNumber.slice(-4)}` : ''
});

export function projectState(state: AppState, user: AuthUser): AppState {
  if (user.role === 'management') {
    const canSeePayroll = user.canManagePayroll;
    return {
      ...state,
      salary: canSeePayroll ? state.salary : state.salary.map(maskBankDetails),
      payslips: canSeePayroll ? state.payslips : state.payslips.filter((p) => p.employeeId === user.employeeId)
    };
  }

  const empId = user.employeeId;
  const own = empId ? { id: empId } : { id: '__none__' };
  const visibleEmployeeIds = new Set<string>(empId ? [empId] : []);

  return {
    ...state,
    employees: state.employees.filter((e) => visibleEmployeeIds.has(e.id)),
    teams: state.teams,
    projects: state.projects.map((p) => ({
      ...p,
      employeeIds: p.employeeIds.filter((id) => visibleEmployeeIds.has(id))
    })),
    tasks: state.tasks.filter((t) => !t.assigneeId || visibleEmployeeIds.has(t.assigneeId)),
    sessions: state.sessions.filter((s) => s.employeeId === own.id),
    timesheets: state.timesheets.filter((t) => t.employeeId === own.id),
    reviews: Object.fromEntries(Object.entries(state.reviews).filter(([, r]) => r.employeeId === own.id)),
    leaves: state.leaves.filter((l) => l.employeeId === own.id),
    holidays: state.holidays,
    salary: state.salary.filter((s) => s.employeeId === own.id),
    payrollRuns: state.payrollRuns.map((r) => ({ ...r, history: [] })),
    payslips: state.payslips.filter((p) => p.employeeId === own.id),
    notifications: state.notifications.filter((n) => n.audience === empId || n.audience === own.id),
    audit: []
  };
}

/** Can this account manage the whole workforce? */
export const isManager = (user: AuthUser): boolean => user.role === 'management';

/**
 * May this employee record time on this project?
 *
 * Every project in the company is open to every employee — the project list is not a
 * membership list. Only an archived project is closed for new time entries: its history
 * stays readable, but nobody records new work against it.
 */
export function canTrackProject(project: Project): boolean {
  return project.status !== 'Archived';
}

/**
 * May this employee work on this task?
 *
 * Learning tasks are shared with everyone. Work tasks belong to their assignee — or to
 * the whole team when they have no assignee.
 */
export function canWorkOnTask(task: Task, employee?: Employee): boolean {
  if (task.kind === 'Learning') return true;
  if (!employee) return false;
  if (task.assigneeId) return task.assigneeId === employee.id;
  return !!task.teamId && task.teamId === employee.teamId;
}

/** Can this account approve payroll, release payslips and confirm deductions? */
export const canManagePayroll = (user: AuthUser): boolean => user.role === 'management' && user.canManagePayroll;

/** Which role a portal path belongs to. */
export const roleForPath = (pathname: string): Role | null =>
  pathname.startsWith('/management') ? 'management' : pathname.startsWith('/employee') ? 'employee' : null;
