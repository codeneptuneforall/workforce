/**
 * Database seeding.
 *
 *   npm run seed          → clean install: master data, accounts and settings only
 *   npm run seed -- --demo → additionally loads a synthetic activity history
 *   npm run db:reset      → removes every document from the domain collections
 */
import type { AppState } from '../shared/types';
import { buildEmptyState, buildInitialState, STATE_VERSION } from '../shared/seed/build';
import { employees } from '../shared/seed/employees';
import { users } from '../shared/seed/users';
import { hashPassword } from './auth';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './db';
import { toDocument } from './store';
import {
  AuditModel,
  EmployeeModel,
  HolidayModel,
  LeaveModel,
  NotificationModel,
  PayslipModel,
  PayrollRunModel,
  ProjectModel,
  ReviewModel,
  SalaryModel,
  SessionModel,
  SettingsModel,
  TaskModel,
  TeamModel,
  TimesheetModel,
  UserModel
} from './models';

const withDemo = process.argv.includes('--demo');
const resetOnly = process.argv.includes('--reset');

async function wipe(): Promise<void> {
  await Promise.all([
    EmployeeModel.deleteMany({}),
    TeamModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TaskModel.deleteMany({}),
    SessionModel.deleteMany({}),
    TimesheetModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    LeaveModel.deleteMany({}),
    HolidayModel.deleteMany({}),
    SalaryModel.deleteMany({}),
    PayrollRunModel.deleteMany({}),
    PayslipModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    AuditModel.deleteMany({}),
    SettingsModel.deleteMany({})
  ]);
}

async function writeMaster(state: AppState): Promise<void> {
  await EmployeeModel.insertMany(state.employees.map((e) => toDocument(e.id, e)));
  await TeamModel.insertMany(state.teams.map((t) => toDocument(t.id, t)));
  await ProjectModel.insertMany(state.projects.map((p) => toDocument(p.id, p)));
  await TaskModel.insertMany(state.tasks.map((t) => toDocument(t.id, t)));
  await HolidayModel.insertMany(state.holidays.map((h) => toDocument(h.id, h)));
  await SalaryModel.insertMany(state.salary.map((s) => toDocument(s.employeeId, s)));
  await SettingsModel.updateOne(
    { _id: 'app' },
    { $set: { settings: state.settings, version: STATE_VERSION } },
    { upsert: true }
  );
}

async function writeActivity(state: ReturnType<typeof buildInitialState>): Promise<void> {
  await SessionModel.insertMany(state.sessions.map((s) => toDocument(s.id, s)));
  await TimesheetModel.insertMany(state.timesheets.map((t) => toDocument(t.id, t)));
  await ReviewModel.insertMany(Object.values(state.reviews).map((r) => toDocument(r.id, r)));
  await LeaveModel.insertMany(state.leaves.map((l) => toDocument(l.id, l)));
  await PayrollRunModel.insertMany(state.payrollRuns.map((r) => toDocument(r.month, r)));
  await PayslipModel.insertMany(state.payslips.map((p) => toDocument(p.id, p)));
  await NotificationModel.insertMany(state.notifications.map((n) => toDocument(n.id, n)));
  await AuditModel.insertMany(state.audit.map((a) => toDocument(a.id, a)));
}

async function writeUsers(withSampleStaff: boolean): Promise<void> {
  const adminHash = await hashPassword(config.seedAdminPassword);
  const managerHash = await hashPassword(config.seedManagerPassword);

  const admin = {
    _id: 'u-admin',
    name: 'System Administrator',
    email: config.seedAdminEmail.toLowerCase(),
    passwordHash: adminHash,
    role: 'management' as const,
    title: 'HR & Payroll Manager',
    canManagePayroll: true,
    mustChangePassword: false,
    active: true
  };

  // A named management login for the company inbox. It is deliberately not forced to
  // change its password: the credentials are chosen by the operator, not issued by us.
  const manager = {
    _id: 'u-info',
    name: 'CodeNeptune Management',
    email: config.seedManagerEmail.toLowerCase(),
    passwordHash: managerHash,
    role: 'management' as const,
    title: 'Management',
    canManagePayroll: true,
    mustChangePassword: false,
    active: true
  };

  const accounts: Record<string, unknown>[] = [admin];
  if (manager.email !== admin.email) accounts.push(manager);

  // Sample people and their logins exist only in demo mode. A clean install holds the
  // two management accounts and nothing else — the operator creates real staff in the UI.
  if (withSampleStaff) {
    const defaultHash = await hashPassword(config.seedDefaultPassword);
    const staff = users.map((u) => ({
      _id: u.id,
      name: u.name,
      email: u.email.toLowerCase(),
      passwordHash: defaultHash,
      role: u.role,
      title: u.title,
      employeeId: u.employeeId,
      canManagePayroll: u.canManagePayroll,
      mustChangePassword: true,
      active: true
    }));

    // Every employee in the directory gets an account so they can sign in.
    const existingEmployeeEmails = new Set(staff.map((u) => u.email));
    const employeeAccounts = employees
      .filter((e) => e.status === 'Active' && !existingEmployeeEmails.has(e.email.toLowerCase()))
      .map((e) => ({
        _id: `u-${e.id}`,
        name: e.name,
        email: e.email.toLowerCase(),
        passwordHash: defaultHash,
        role: 'employee' as const,
        title: e.designation,
        employeeId: e.id,
        canManagePayroll: false,
        mustChangePassword: true,
        active: true
      }));

    accounts.push(...staff, ...employeeAccounts);
  }

  await UserModel.insertMany(accounts);
}

async function main(): Promise<void> {
  await connectDatabase();

  if (resetOnly) {
    await wipe();
    await UserModel.deleteMany({});
    console.log('[seed] all domain data and accounts removed');
    await disconnectDatabase();
    return;
  }

  await wipe();
  await UserModel.deleteMany({});

  if (withDemo) {
    const demo = buildInitialState();
    await writeMaster(demo);
    await writeActivity(demo);
    await writeUsers(true);

    console.log('[seed] demo installation written:');
    console.log(`         ${demo.employees.length} employees, ${demo.teams.length} teams, ${demo.projects.length} projects, ${demo.tasks.length} tasks`);
    console.log(`         ${demo.holidays.length} holidays, ${demo.salary.length} salary structures`);
    console.log(`         ${demo.sessions.length} work sessions, ${demo.timesheets.length} timesheets, ${demo.leaves.length} leave requests`);
    console.log(`         ${demo.payrollRuns.length} payroll runs, ${demo.payslips.length} payslips, ${demo.audit.length} audit entries`);
    console.log('[seed] accounts:');
    console.log(`         ${config.seedAdminEmail} (administrator, payroll access)`);
    if (config.seedManagerEmail.toLowerCase() !== config.seedAdminEmail.toLowerCase()) {
      console.log(`         ${config.seedManagerEmail} (management, payroll access)`);
    }
    console.log(`         ${users.map((u) => u.email).join(', ')}`);
    console.log(`         every employee in the directory, password ${config.seedDefaultPassword} (must be changed on first sign-in)`);
  } else {
    const empty = buildEmptyState();
    await writeMaster(empty);
    await writeUsers(false);

    console.log('[seed] clean installation written: settings only, no sample people or work.');
    console.log('[seed] accounts:');
    console.log(`         ${config.seedAdminEmail} (administrator, payroll access)`);
    if (config.seedManagerEmail.toLowerCase() !== config.seedAdminEmail.toLowerCase()) {
      console.log(`         ${config.seedManagerEmail} (management, payroll access)`);
    }
    console.log('         Run "npm run seed -- --demo" for a populated sample installation.');
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await disconnectDatabase();
  process.exit(1);
});
