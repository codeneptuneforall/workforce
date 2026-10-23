export type Role = 'management' | 'employee';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  employeeId?: string;
  canManagePayroll: boolean;
  mustChangePassword?: boolean;
  active?: boolean;
}

/** The safe, client-facing shape of the signed-in account. Never carries secrets. */
export type AuthUser = Omit<UserAccount, 'active'>;

export type EmployeeStatus = 'Active' | 'Inactive';

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  teamId: string;
  joiningDate: string;
  /** Birthday as YYYY-MM-DD. Only the month and day are used, for the greeting. */
  dateOfBirth?: string;
  /** Optional profile photo (URL or data URI) shown in birthday greetings and people lists. */
  photoUrl?: string;
  managerId?: string;
  status: EmployeeStatus;
  schedule: string;
  dailyTargetMinutes: number;
  workingDays: number[];
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leadId: string;
  status: 'Active' | 'Inactive';
}

export type ProjectStatus = 'Planned' | 'Active' | 'On Hold' | 'Completed' | 'Archived';

/**
 * `Learning` projects are the company-wide spaces where anyone can log self-directed
 * learning work. `Work` projects are ordinary delivery projects.
 */
export type ProjectKind = 'Work' | 'Learning';

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  client?: string;
  managerId: string;
  teamIds: string[];
  employeeIds: string[];
  startDate: string;
  endDate: string;
  estimatedHours?: number;
  status: ProjectStatus;
  /**
   * Whether every employee may record time on this project.
   * Left undefined it means "available to everyone" — the default for management projects.
   */
  availableToAll?: boolean;
  /** Learning projects are shared company-wide; work projects are ordinary projects. */
  kind?: ProjectKind;
  notes?: string;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High';

/**
 * `Learning` tasks are self-created, unassigned and shared with every employee.
 * `Work` tasks are ordinary delivery tasks with an owner.
 */
export type TaskKind = 'Work' | 'Learning';

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId?: string;
  teamId?: string;
  priority?: TaskPriority;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  /** Learning tasks are available to everyone; work tasks belong to their assignee. */
  kind?: TaskKind;
}

export interface Interval {
  start: string;
  end?: string;
}

export type SessionStatus = 'Working' | 'Paused' | 'Completed' | 'Interrupted';

export interface WorkSession {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string;
  description: string;
  notes?: string;
  date: string;
  intervals: Interval[];
  status: SessionStatus;
}

export type TimesheetStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Changes Requested';

export interface HistoryItem {
  action: string;
  by: string;
  at: string;
  note?: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  weekStart: string;
  status: TimesheetStatus;
  submittedAt?: string;
  history: HistoryItem[];
}

export type ReviewStatus =
'Pending Review' |
'Confirmed' |
'Correction Requested' |
'Approved Exception' |
'Adjusted' |
'Waived';

export type AdjustmentCategory =
'Approved exception' |
'Incorrect/missing time log' |
'Management-approved waiver' |
'Approved schedule change' |
'Other';

export interface ReviewChange {
  at: string;
  by: string;
  from: string;
  to: string;
  reason: string;
  previousDeduction?: number | null;
  newDeduction?: number | null;
}

export interface ShortfallReview {
  id: string;
  employeeId: string;
  date: string;
  status: ReviewStatus;
  category?: AdjustmentCategory;
  reason?: string;
  adjustedPayableMinutes?: number;
  proposedDeduction?: number | null;
  finalDeduction?: number | null;
  reviewedBy?: string;
  reviewedAt?: string;
  history: ReviewChange[];
}

export type LeaveType = 'Casual' | 'Emergency';
export type LeaveStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Cancelled';

export interface Leave {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  contact?: string;
  attachmentName?: string;
  status: LeaveStatus;
  submittedAt: string;
  retrospective: boolean;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
}

export type HolidayType = 'Government' | 'Company' | 'Optional';

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  description?: string;
  status: 'Published' | 'Draft';
}

export interface SalaryStructure {
  employeeId: string;
  effectiveFrom: string;
  ctcAnnual: number;
  bankName: string;
  accountNumber: string;
  uan?: string;
  esiNumber?: string;
  dailyPayableAmount?: number | null;
  earnings: {
    basic: number;
    hra: number;
    conveyance: number;
    otherAllowances: number;
    incentives: number;
  };
  deductions: {
    epf: number;
    esi: number;
    professionalTax: number;
    insurance: number;
    tds: number;
    other: number;
  };
  employerContribution: number;
}

export type PayrollStatus =
'Draft' |
'Calculated' |
'Needs Review' |
'Approved' |
'Salary Credited' |
'Payslips Generated' |
'Released';

export interface PayrollRun {
  month: string;
  status: PayrollStatus;
  calculatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  creditDate?: string;
  creditReference?: string;
  creditedBy?: string;
  generatedAt?: string;
  releasedAt?: string;
  failedEmployeeIds?: string[];
  history: HistoryItem[];
}

export interface PayslipLine {
  label: string;
  amount: number;
}

export interface PayslipData {
  companyName: string;
  companyAddress: string;
  month: string;
  employee: {
    name: string;
    code: string;
    designation: string;
    joiningDate: string;
    bankName: string;
    accountMasked: string;
    uan?: string;
    esi?: string;
  };
  ctcAnnual: number;
  salaryDays: number;
  lopDays: number;
  earnings: PayslipLine[];
  gross: number;
  employerContribution: number;
  ctcMonthly: number;
  deductions: PayslipLine[];
  totalDeduction: number;
  takeHome: number;
  confidentialityNote: string;
}

export type PayslipStatus = 'Generated' | 'Released' | 'Superseded';

export interface Payslip {
  id: string;
  employeeId: string;
  month: string;
  version: number;
  status: PayslipStatus;
  generatedAt: string;
  releasedAt?: string;
  revisionReason?: string;
  data: PayslipData;
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand';

export interface AppNotification {
  id: string;
  audience: string;
  title: string;
  body: string;
  link: string;
  createdAt: string;
  read: boolean;
  tone: Tone;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  at: string;
  previous?: string;
  next?: string;
  reason?: string;
}

export type DeductionMethod = 'not_configured' | 'daily_amount' | 'monthly_proration' | 'manual';
export type PayrollBasis = 'not_configured' | 'calendar_days' | 'scheduled_working_days' | 'fixed_days';
export type LeaveTreatment = 'not_configured' | 'paid' | 'unpaid';

export interface Settings {
  companyName: string;
  companyAddress: string;
  currency: string;
  timezone: string;
  confidentialityNote: string;
  dailyTargetMinutes: number;
  dayEndTime: string;
  workingDays: number[];
  /**
   * Which Saturdays of the month are working days, as ordinal positions (1 = first
   * Saturday, 2 = second, and so on). Company-wide: an empty list means no Saturdays.
   */
  workingSaturdays: number[];
  allowOverlap: boolean;
  requireTask: boolean;
  generalCategory: boolean;
  approachingWarningMinutes: number;
  timesheetApprovalRequired: boolean;
  correctionPolicy: string;
  absentPolicy: 'not_recorded' | 'mark_absent';
  deductionEnabled: boolean;
  deductionMethod: DeductionMethod;
  payrollBasis: PayrollBasis;
  fixedBasisDays: number | null;
  rounding: 'nearest_rupee' | 'two_decimals';
  showDeductionToEmployee: boolean;
  policyApprovedBy?: string;
  policyApprovedAt?: string;
  casualAdvanceDays: number;
  casualAllowance: number | null;
  emergencyRetrospective: boolean;
  leaveYearStartMonth: number;
  casualTreatment: LeaveTreatment;
  emergencyTreatment: LeaveTreatment;
  carryForward: string;
  cancellationPolicy: string;
  leaveApprover: string;
  attachmentsEnabled: boolean;
  releaseRequiresCredit: boolean;
}

export interface AppState {
  version: number;
  employees: Employee[];
  teams: Team[];
  projects: Project[];
  tasks: Task[];
  sessions: WorkSession[];
  timesheets: Timesheet[];
  reviews: Record<string, ShortfallReview>;
  leaves: Leave[];
  holidays: Holiday[];
  salary: SalaryStructure[];
  payrollRuns: PayrollRun[];
  payslips: Payslip[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  settings: Settings;
}

export interface Result {
  ok: boolean;
  error?: string;
  /** Set when the command generated a sign-in password that must be shown once. */
  credentials?: Credentials;
}

/**
 * A sign-in credential that is shown to management exactly once.
 *
 * Employee accounts are created with a randomly generated password; only the hash is
 * stored, so this is the only opportunity to copy the plaintext.
 */
export interface Credentials {
  email: string;
  password: string;
}