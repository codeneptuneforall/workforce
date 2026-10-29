import mongoose from 'mongoose';
import { Schema } from 'mongoose';

/**
 * One Mongoose collection per aggregate in the domain model.
 *
 * Every collection uses the domain id as `_id` so records keep a stable identity
 * across restarts and can be upserted without an extra lookup.
 */

const opts = { _id: false, versionKey: false, minimize: false, strict: false } as const;
const Mixed = Schema.Types.Mixed;

const LateLoginSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    reason: { type: String, required: true },
    at: { type: Date, required: true }
  },
  opts
);

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['management', 'employee'] },
    title: { type: String, default: '' },
    employeeId: { type: String },
    canManagePayroll: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    lateLoginReason: { type: String },
    lateLoginAt: { type: Date }
  },
  { _id: false, versionKey: false, minimize: false }
);

const EmployeeSchema = new Schema(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    designation: String,
    teamId: String,
    joiningDate: String,
    dateOfBirth: String,
    photoUrl: String,
    bloodGroup: String,
    emergencyNumber: String,
    address: String,
    beneficiaryName: String,
    bankName: String,
    bankAccountNumber: String,
    ifscCode: String,
    branchName: String,
    managerId: String,
    status: { type: String, default: 'Active' },
    schedule: String,
    dailyTargetMinutes: { type: Number, default: 480 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }
  },
  opts
);
EmployeeSchema.index({ code: 1 });
EmployeeSchema.index({ teamId: 1 });

const TeamSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    leadId: String,
    status: { type: String, default: 'Active' }
  },
  opts
);

const ProjectSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    client: String,
    teamIds: { type: [String], default: [] },
    employeeIds: { type: [String], default: [] },
    startDate: String,
    endDate: String,
    estimatedHours: Number,
    status: { type: String, default: 'Active' },
    availableToAll: { type: Boolean, default: true },
    kind: { type: String, default: 'Work' },
    notes: String
  },
  opts
);
ProjectSchema.index({ code: 1 });

const TaskSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    projectId: String,
    assigneeId: String,
    priority: String,
    dueDate: String,
    status: { type: String, default: 'To Do' },
    kind: { type: String, default: 'Work' }
  },
  opts
);
TaskSchema.index({ assigneeId: 1 });
TaskSchema.index({ projectId: 1 });

const SessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    taskId: String,
    date: { type: String, required: true },
    intervals: { type: [Mixed], default: [] },
    status: { type: String, default: 'Completed' }
  },
  opts
);
SessionSchema.index({ employeeId: 1, date: 1 });
SessionSchema.index({ status: 1 });

const TimesheetSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    weekStart: { type: String, required: true },
    status: { type: String, default: 'Draft' },
    submittedAt: String,
    history: { type: [Mixed], default: [] }
  },
  opts
);
TimesheetSchema.index({ employeeId: 1, weekStart: 1 });

const ReviewSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, default: 'Pending Review' },
    category: String,
    reason: String,
    adjustedPayableMinutes: Number,
    proposedDeduction: Number,
    finalDeduction: Number,
    reviewedBy: String,
    reviewedAt: String,
    history: { type: [Mixed], default: [] }
  },
  opts
);
ReviewSchema.index({ employeeId: 1, date: 1 });

const LeaveSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    type: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, default: 0 },
    contact: String,
    attachmentName: String,
    status: { type: String, default: 'Pending Approval' },
    retrospective: { type: Boolean, default: false },
    decidedBy: String,
    decidedAt: String,
    rejectionReason: String
  },
  opts
);
LeaveSchema.index({ employeeId: 1, startDate: 1 });
LeaveSchema.index({ status: 1 });

const HolidaySchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    type: { type: String, default: 'Company' },
    status: { type: String, default: 'Draft' }
  },
  opts
);
HolidaySchema.index({ date: 1 });

const SalarySchema = new Schema(
  {
    _id: { type: String, required: true },
    effectiveFrom: String,
    ctcAnnual: { type: Number, default: 0 },
    uan: String,
    esiNumber: String,
    dailyPayableAmount: Number,
    earnings: { type: Mixed, default: {} },
    deductions: { type: Mixed, default: {} },
    employerContribution: { type: Number, default: 0 }
  },
  opts
);

const PayrollRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    month: { type: String, required: true },
    status: { type: String, default: 'Draft' },
    calculatedAt: String,
    approvedBy: String,
    approvedAt: String,
    creditDate: String,
    creditReference: String,
    creditedBy: String,
    generatedAt: String,
    releasedAt: String,
    failedEmployeeIds: { type: [String], default: [] },
    history: { type: [Mixed], default: [] }
  },
  opts
);
PayrollRunSchema.index({ month: 1 }, { unique: true });

const PayslipSchema = new Schema(
  {
    _id: { type: String, required: true },
    employeeId: { type: String, required: true },
    month: { type: String, required: true },
    version: { type: Number, default: 1 },
    status: { type: String, default: 'Generated' },
    revisionReason: String,
    data: { type: Mixed, default: {} }
  },
  opts
);
PayslipSchema.index({ employeeId: 1, month: 1 });

const NotificationSchema = new Schema(
  {
    _id: { type: String, required: true },
    audience: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    link: String,
    createdAt: String,
    read: { type: Boolean, default: false },
    tone: { type: String, default: 'info' }
  },
  opts
);
NotificationSchema.index({ audience: 1 });

const AuditSchema = new Schema(
  {
    _id: { type: String, required: true },
    actor: String,
    action: String,
    entity: String,
    entityId: String,
    at: String,
    previous: String,
    next: String,
  },
  opts
);
AuditSchema.index({ at: -1 });

const SettingsSchema = new Schema(
  {
    _id: { type: String, default: 'app' },
    version: { type: Number, default: 1 },
    settings: { type: Mixed, default: {} }
  },
  { _id: false, versionKey: false, minimize: false }
);

const PasswordResetSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date
  },
  { _id: false, versionKey: false, minimize: false }
);
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserModel = mongoose.model('User', UserSchema);
export const EmployeeModel = mongoose.model('Employee', EmployeeSchema);
export const TeamModel = mongoose.model('Team', TeamSchema);
export const ProjectModel = mongoose.model('Project', ProjectSchema);
export const TaskModel = mongoose.model('Task', TaskSchema);
export const SessionModel = mongoose.model('WorkSession', SessionSchema);
export const TimesheetModel = mongoose.model('Timesheet', TimesheetSchema);
export const ReviewModel = mongoose.model('ShortfallReview', ReviewSchema);
export const LeaveModel = mongoose.model('Leave', LeaveSchema);
export const HolidayModel = mongoose.model('Holiday', HolidaySchema);
export const SalaryModel = mongoose.model('SalaryStructure', SalarySchema);
export const PayrollRunModel = mongoose.model('PayrollRun', PayrollRunSchema);
export const PayslipModel = mongoose.model('Payslip', PayslipSchema);
export const NotificationModel = mongoose.model('Notification', NotificationSchema);
export const AuditModel = mongoose.model('AuditEntry', AuditSchema);
export const SettingsModel = mongoose.model('AppSettings', SettingsSchema);
export const PasswordResetModel = mongoose.model('PasswordReset', PasswordResetSchema);
export const LateLoginModel = mongoose.model('LateLogin', LateLoginSchema);
