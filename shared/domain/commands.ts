import type { AppState, AuthUser } from '../types';
import { canManagePayroll, isManager } from './access';
import { complianceCtx } from './compliance';
import { validateLeave } from './leave';
import type { LeaveForm } from './leave';
import { buildPayrollRecords } from './payroll';
import {
  approvePayroll,
  calculatePayroll,
  confirmCredit,
  generatePayslips,
  releasePayslips,
  releaseSinglePayslip,
  reopenPayroll,
  revisePayslip } from './payrollMutations';
import {
  saveEmployee,
  saveHoliday,
  saveProject,
  saveSalary,
  saveTask,
  saveTeam,
  setEmployeeStatus,
  setProjectStatus,
  setTaskStatus,
  copyHolidayYear,
  deleteHoliday,
  publishHolidayYear,
  updateSettings } from './recordMutations';
import { fail, withAudit } from './stateHelpers';
import type { Mutation } from './stateHelpers';
import { endTimer, flagSession, pauseTimer, resumeTimer, startTimer } from './timerMutations';
import {
  applyLeave,
  cancelLeave,
  decideLeave,
  requestDayCorrection,
  reviewShortfall,
  reviewTimesheet,
  submitTimesheet } from './workflowMutations';

/**
 * Every write in the product goes through this registry.
 *
 * The browser sends `{ op, args }`; the API server resolves the operation, checks the
 * caller's permissions, applies the same pure business rules the UI previews, and
 * persists the result to MongoDB. Nothing is written from the client.
 */

export interface CommandContext {
  state: AppState;
  user: AuthUser;
  actor: string;
  now: number;
}

export type CommandArgs = Record<string, any>;

export type CommandScope = 'employee' | 'management' | 'payroll';

export interface CommandDefinition {
  /** Minimum permission the signed-in account needs. */
  scope: CommandScope;
  handler: (ctx: CommandContext, args: CommandArgs) => Mutation;
}

const commands: Record<string, CommandDefinition> = {
  /* ---------------------------------------------------------------- employees */
  'employee.save': {
    scope: 'employee',
    handler: (ctx, args) => {
      // An employee may only save their own record; management may save any record.
      if (!isManager(ctx.user)) {
        const empId = ctx.user.employeeId;
        if (!empId || args.employee.id !== empId)
          return fail('You can only save your own profile.');
      }
      return saveEmployee(ctx.state, args.employee, ctx.actor, ctx.now);
    }
  },
  'employee.setStatus': {
    scope: 'management',
    handler: (ctx, args) => setEmployeeStatus(ctx.state, args.id, args.status, args.reason ?? '', ctx.actor, ctx.now)
  },
  'employee.resetPassword': {
    scope: 'management',
    handler: (ctx, args) => {
      const emp = ctx.state.employees.find((e) => e.id === args.employeeId);
      if (!emp) return fail('Employee not found.');
      if (!emp.email.trim()) return fail('This employee has no work email to sign in with.');
      return withAudit(ctx.state, ctx.now, {
        actor: ctx.actor,
        action: 'Sign-in password reset',
        entity: 'Employee account',
        entityId: `${emp.name} (${emp.code})`,
        reason: 'A new temporary password was generated and must be changed at next sign-in.'
      });
    }
  },

  /* -------------------------------------------------------------------- teams */
  'team.save': {
    scope: 'management',
    handler: (ctx, args) => saveTeam(ctx.state, args.team, args.memberIds ?? [], ctx.actor, ctx.now)
  },

  /* ----------------------------------------------------------------- projects */
  'project.save': {
    scope: 'management',
    handler: (ctx, args) => saveProject(ctx.state, args.project, ctx.actor, ctx.now)
  },
  'project.setStatus': {
    scope: 'management',
    handler: (ctx, args) => setProjectStatus(ctx.state, args.id, args.status, ctx.actor, ctx.now)
  },

  /* -------------------------------------------------------------------- tasks */
  'task.save': {
    scope: 'management',
    handler: (ctx, args) => saveTask(ctx.state, args.task, ctx.actor, ctx.now)
  },
  'task.setStatus': {
    scope: 'employee',
    handler: (ctx, args) => {
      const task = ctx.state.tasks.find((t) => t.id === args.id);
      if (!task) return fail('Task not found.');
      if (!isManager(ctx.user)) {
        const mine = ctx.user.employeeId && task.assigneeId === ctx.user.employeeId;
        const teamTask = !task.assigneeId && task.teamId === ctx.state.employees.find((e) => e.id === ctx.user.employeeId)?.teamId;
        // Learning tasks are shared with the whole company, so anyone may update them.
        const sharedLearning = task.kind === 'Learning';
        if (!mine && !teamTask && !sharedLearning) return fail('You can only change the status of tasks assigned to you.');
      }
      return setTaskStatus(ctx.state, task.id, args.status, ctx.actor, ctx.now);
    }
  },

  /* ----------------------------------------------------------------- holidays */
  'holiday.save': {
    scope: 'management',
    handler: (ctx, args) => saveHoliday(ctx.state, args.holiday, ctx.actor, ctx.now)
  },
  'holiday.delete': {
    scope: 'management',
    handler: (ctx, args) => deleteHoliday(ctx.state, args.id, ctx.actor, ctx.now)
  },
  'holiday.copyYear': {
    scope: 'management',
    handler: (ctx, args) => copyHolidayYear(ctx.state, Number(args.from), Number(args.to), ctx.actor, ctx.now)
  },
  'holiday.publishYear': {
    scope: 'management',
    handler: (ctx, args) => publishHolidayYear(ctx.state, Number(args.year), ctx.actor, ctx.now)
  },

  /* ----------------------------------------------------------------- settings */
  'settings.update': {
    scope: 'management',
    handler: (ctx, args) => updateSettings(ctx.state, args.patch ?? {}, args.section ?? 'General', ctx.actor, ctx.now)
  },

  /* ------------------------------------------------------------------- salary */
  'salary.save': {
    scope: 'payroll',
    handler: (ctx, args) => saveSalary(ctx.state, args.structure, args.reason ?? '', ctx.actor, ctx.now)
  },

  /* ------------------------------------------------------------------- timers */
  'timer.start': {
    scope: 'employee',
    handler: (ctx, args) => {
      const employeeId = ctx.user.employeeId;
      if (!employeeId) return fail('Your account is not linked to an employee record.');
      return startTimer(ctx.state, employeeId, args.input ?? {}, ctx.now);
    }
  },
  'timer.pause': {
    scope: 'employee',
    handler: (ctx, args) => {
      const owned = ownsSession(ctx, args.sessionId);
      if (owned !== true) return fail(owned);
      return pauseTimer(ctx.state, args.sessionId, ctx.now);
    }
  },
  'timer.resume': {
    scope: 'employee',
    handler: (ctx, args) => {
      const owned = ownsSession(ctx, args.sessionId);
      if (owned !== true) return fail(owned);
      return resumeTimer(ctx.state, args.sessionId, ctx.now);
    }
  },
  'timer.end': {
    scope: 'employee',
    handler: (ctx, args) => {
      const owned = ownsSession(ctx, args.sessionId);
      if (owned !== true) return fail(owned);
      return endTimer(ctx.state, args.sessionId, args.notes ?? '', ctx.now);
    }
  },
  'timer.flag': {
    scope: 'employee',
    handler: (ctx, args) => {
      const owned = ownsSession(ctx, args.sessionId);
      if (owned !== true) return fail(owned);
      return flagSession(ctx.state, args.sessionId, ctx.actor, ctx.now);
    }
  },
  'timer.switch': {
    scope: 'employee',
    handler: (ctx, args) => {
      const employeeId = ctx.user.employeeId;
      if (!employeeId) return fail('Your account is not linked to an employee record.');
      const owned = ownsSession(ctx, args.sessionId);
      if (owned !== true) return fail(owned);
      const mode = args.mode === 'end' ? 'end' : 'pause';
      const current = ctx.state.sessions.find((x) => x.id === args.sessionId);
      if (!current) return fail('Session not found.');
      // A paused session is simply left paused when the employee asks to "pause and switch";
      // only a running session is paused or ended.
      let first: Mutation = ctx.state;
      if (mode === 'end') {
        first = endTimer(ctx.state, args.sessionId, '', ctx.now);
      } else if (current.status === 'Working') {
        first = pauseTimer(ctx.state, args.sessionId, ctx.now);
      }
      if ('error' in first) return first;
      return startTimer(first, employeeId, args.input ?? {}, ctx.now);
    }
  },

  /* --------------------------------------------------------------- timesheets */
  'timesheet.submit': {
    scope: 'employee',
    handler: (ctx, args) => {
      const employeeId = ctx.user.employeeId;
      if (!employeeId) return fail('Your account is not linked to an employee record.');
      return submitTimesheet(ctx.state, employeeId, args.weekStart, ctx.actor, ctx.now);
    }
  },
  'timesheet.review': {
    scope: 'management',
    handler: (ctx, args) => reviewTimesheet(ctx.state, args.timesheetId, args.decision, args.note ?? '', ctx.actor, ctx.now)
  },

  /* -------------------------------------------------------------- shortfalls */
  'shortfall.review': {
    scope: 'payroll',
    handler: (ctx, args) => {
      const decision = args.decision ?? {};
      return reviewShortfall(
        ctx.state,
        args.employeeId,
        args.date,
        {
          ...decision,
          canManagePayroll: canManagePayroll(ctx.user),
          reason: decision.reason ?? '',
          proposedDeduction: decision.proposedDeduction ?? null
        },
        ctx.actor,
        ctx.now
      );
    }
  },
  'correction.request': {
    scope: 'employee',
    handler: (ctx, args) => {
      const employeeId = ctx.user.employeeId;
      if (!employeeId) return fail('Your account is not linked to an employee record.');
      return requestDayCorrection(ctx.state, employeeId, args.date, args.note ?? '', ctx.actor, ctx.now);
    }
  },

  /* ------------------------------------------------------------------- leaves */
  'leave.apply': {
    scope: 'employee',
    handler: (ctx, args) => {
      const employeeId = ctx.user.employeeId;
      if (!employeeId) return fail('Your account is not linked to an employee record.');
      const emp = ctx.state.employees.find((e) => e.id === employeeId);
      if (!emp) return fail('Employee record not found.');
      const form: LeaveForm = args.form ?? { type: 'Casual', startDate: '', endDate: '', reason: '', contact: '' };
      // The validation is always recalculated on the server — never trusted from the browser.
      const validation = validateLeave(form, emp, ctx.state.leaves, ctx.state.holidays, ctx.state.settings, ctx.now);
      return applyLeave(ctx.state, employeeId, form, validation, args.attachmentName, ctx.actor, ctx.now);
    }
  },
  'leave.decide': {
    scope: 'management',
    handler: (ctx, args) => decideLeave(ctx.state, args.leaveId, !!args.approve, args.reason ?? '', ctx.actor, ctx.now)
  },
  'leave.cancel': {
    scope: 'employee',
    handler: (ctx, args) => {
      const leave = ctx.state.leaves.find((l) => l.id === args.leaveId);
      if (!leave) return fail('Leave request not found.');
      if (leave.employeeId !== ctx.user.employeeId && !isManager(ctx.user))
        return fail('You can only cancel your own leave requests.');
      return cancelLeave(ctx.state, args.leaveId, ctx.actor, ctx.now);
    }
  },

  /* ------------------------------------------------------------------ payroll */
  'payroll.calculate': {
    scope: 'payroll',
    handler: (ctx, args) => {
      const records = buildPayrollRecords(ctx.state, args.month, ctx.now);
      return calculatePayroll(ctx.state, args.month, records, ctx.actor, ctx.now);
    }
  },
  'payroll.approve': {
    scope: 'payroll',
    handler: (ctx, args) => {
      const records = buildPayrollRecords(ctx.state, args.month, ctx.now);
      return approvePayroll(ctx.state, args.month, records, ctx.actor, ctx.now);
    }
  },
  'payroll.credit': {
    scope: 'payroll',
    handler: (ctx, args) => confirmCredit(ctx.state, args.month, args.date, args.reference ?? '', ctx.actor, ctx.now)
  },
  'payroll.generatePayslips': {
    scope: 'payroll',
    handler: (ctx, args) => {
      const records = buildPayrollRecords(ctx.state, args.month, ctx.now);
      return generatePayslips(ctx.state, args.month, records, ctx.actor, ctx.now, !!args.onlyFailed);
    }
  },
  'payroll.releasePayslips': {
    scope: 'payroll',
    handler: (ctx, args) => releasePayslips(ctx.state, args.month, ctx.actor, ctx.now)
  },
  'payroll.reopen': {
    scope: 'payroll',
    handler: (ctx, args) => reopenPayroll(ctx.state, args.month, args.reason ?? '', ctx.actor, ctx.now)
  },
  'payslip.revise': {
    scope: 'payroll',
    handler: (ctx, args) => {
      const original = ctx.state.payslips.find((p) => p.id === args.payslipId);
      if (!original) return fail('Payslip not found.');
      const records = buildPayrollRecords(ctx.state, original.month, ctx.now);
      const record = records.find((r) => r.employee.id === original.employeeId);
      if (!record) return fail('No payroll record is available for this employee.');
      return revisePayslip(ctx.state, args.payslipId, args.reason ?? '', record, ctx.actor, ctx.now);
    }
  },
  'payslip.release': {
    scope: 'payroll',
    handler: (ctx, args) => releaseSinglePayslip(ctx.state, args.payslipId, ctx.actor, ctx.now)
  },

  /* ------------------------------------------------------------ notifications */
  'notification.read': {
    scope: 'employee',
    handler: (ctx, args) => {
      const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
      const audience = ctx.user.role === 'management' ? 'management' : ctx.user.employeeId ?? '';
      const own = new Set(ctx.state.notifications.filter((n) => n.audience === audience).map((n) => n.id));
      const target = ids.filter((id) => own.has(id));
      if (!target.length) return ctx.state;
      return {
        ...ctx.state,
        notifications: ctx.state.notifications.map((n) => (target.includes(n.id) ? { ...n, read: true } : n))
      };
    }
  }
};

function ownsSession(ctx: CommandContext, sessionId: string): true | string {
  const session = ctx.state.sessions.find((s) => s.id === sessionId);
  if (!session) return 'Session not found.';
  if (session.employeeId !== ctx.user.employeeId && !isManager(ctx.user))
    return 'You can only change your own work sessions.';
  return true;
}

/** Can this account run the given command? */
export function isAllowed(user: AuthUser, op: string): boolean {
  const def = commands[op];
  if (!def) return false;
  if (def.scope === 'payroll') return canManagePayroll(user);
  if (def.scope === 'management') return isManager(user);
  return true;
}

export function commandNames(): string[] {
  return Object.keys(commands);
}

export function runCommand(op: string, ctx: CommandContext, args: CommandArgs): Mutation {
  const def = commands[op];
  if (!def) return fail('Unknown operation.');
  if (!isAllowed(ctx.user, op)) return fail('You do not have permission to perform this action.');
  const result = def.handler(ctx, args ?? {});
  return result;
}

/** Re-exported so the API can build the same compliance context as the UI. */
export { complianceCtx };
