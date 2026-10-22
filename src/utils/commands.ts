import type {
  Employee,
  Holiday,
  Project,
  ProjectStatus,
  SalaryStructure,
  Settings,
  Task,
  TaskKind,
  TaskStatus,
  Team } from '@shared/types';
import type { LeaveForm } from '@shared/domain/leave';

/**
 * A single write request. The API server resolves the operation, enforces permissions
 * and applies the business rules before saving to MongoDB.
 */
export interface Command {
  op: string;
  args?: Record<string, any>;
}

export const cmd = {
  /* employees */
  saveEmployee: (employee: Employee): Command => ({ op: 'employee.save', args: { employee } }),
  setEmployeeStatus: (id: string, status: Employee['status'], reason: string): Command => ({
    op: 'employee.setStatus',
    args: { id, status, reason }
  }),
  resetEmployeePassword: (employeeId: string): Command => ({ op: 'employee.resetPassword', args: { employeeId } }),

  /* teams */
  saveTeam: (team: Team, memberIds: string[]): Command => ({ op: 'team.save', args: { team, memberIds } }),

  /* projects */
  saveProject: (project: Project): Command => ({ op: 'project.save', args: { project } }),
  setProjectStatus: (id: string, status: ProjectStatus): Command => ({ op: 'project.setStatus', args: { id, status } }),

  /* tasks */
  saveTask: (task: Task): Command => ({ op: 'task.save', args: { task } }),
  setTaskStatus: (id: string, status: TaskStatus): Command => ({ op: 'task.setStatus', args: { id, status } }),

  /* holidays */
  saveHoliday: (holiday: Holiday): Command => ({ op: 'holiday.save', args: { holiday } }),
  deleteHoliday: (id: string): Command => ({ op: 'holiday.delete', args: { id } }),
  copyHolidayYear: (from: number, to: number): Command => ({ op: 'holiday.copyYear', args: { from, to } }),
  publishHolidayYear: (year: number): Command => ({ op: 'holiday.publishYear', args: { year } }),

  /* settings */
  updateSettings: (patch: Partial<Settings>, section: string): Command => ({
    op: 'settings.update',
    args: { patch, section }
  }),

  /* salary */
  saveSalary: (structure: SalaryStructure, reason: string): Command => ({
    op: 'salary.save',
    args: { structure, reason }
  }),

  /* timers */
  startTimer: (input: {
    projectId: string;
    taskId: string;
    description: string;
    mode?: 'existing' | 'new';
    kind?: TaskKind;
  }): Command => ({
    op: 'timer.start',
    args: { input }
  }),
  pauseTimer: (sessionId: string): Command => ({ op: 'timer.pause', args: { sessionId } }),
  resumeTimer: (sessionId: string): Command => ({ op: 'timer.resume', args: { sessionId } }),
  endTimer: (sessionId: string, notes: string): Command => ({ op: 'timer.end', args: { sessionId, notes } }),
  flagSession: (sessionId: string): Command => ({ op: 'timer.flag', args: { sessionId } }),
  switchTimer: (
    sessionId: string,
    mode: 'pause' | 'end',
    input: { projectId: string; taskId: string; description: string; mode?: 'existing' | 'new'; kind?: TaskKind; }
  ): Command => ({ op: 'timer.switch', args: { sessionId, mode, input } }),

  /* timesheets */
  submitTimesheet: (weekStart: string): Command => ({ op: 'timesheet.submit', args: { weekStart } }),
  reviewTimesheet: (timesheetId: string, decision: 'Approved' | 'Changes Requested' | 'Under Review', note: string): Command => ({
    op: 'timesheet.review',
    args: { timesheetId, decision, note }
  }),

  /* shortfalls */
  reviewShortfall: (employeeId: string, date: string, decision: Record<string, unknown>): Command => ({
    op: 'shortfall.review',
    args: { employeeId, date, decision }
  }),
  requestDayCorrection: (date: string, note: string): Command => ({
    op: 'correction.request',
    args: { date, note }
  }),

  /* leaves */
  applyLeave: (form: LeaveForm, attachmentName?: string): Command => ({
    op: 'leave.apply',
    args: { form, attachmentName }
  }),
  decideLeave: (leaveId: string, approve: boolean, reason: string): Command => ({
    op: 'leave.decide',
    args: { leaveId, approve, reason }
  }),
  cancelLeave: (leaveId: string): Command => ({ op: 'leave.cancel', args: { leaveId } }),

  /* payroll */
  calculatePayroll: (month: string): Command => ({ op: 'payroll.calculate', args: { month } }),
  approvePayroll: (month: string): Command => ({ op: 'payroll.approve', args: { month } }),
  confirmCredit: (month: string, date: string, reference: string): Command => ({
    op: 'payroll.credit',
    args: { month, date, reference }
  }),
  generatePayslips: (month: string, onlyFailed = false): Command => ({
    op: 'payroll.generatePayslips',
    args: { month, onlyFailed }
  }),
  releasePayslips: (month: string): Command => ({ op: 'payroll.releasePayslips', args: { month } }),
  reopenPayroll: (month: string, reason: string): Command => ({ op: 'payroll.reopen', args: { month, reason } }),
  revisePayslip: (payslipId: string, reason: string): Command => ({
    op: 'payslip.revise',
    args: { payslipId, reason }
  }),
  releaseSinglePayslip: (payslipId: string): Command => ({ op: 'payslip.release', args: { payslipId } }),

  /* notifications */
  markNotificationsRead: (ids: string[]): Command => ({ op: 'notification.read', args: { ids } })
};
