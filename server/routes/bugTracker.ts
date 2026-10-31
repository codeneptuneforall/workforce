import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../auth';
import type { AuthUser } from '../../shared/types';
import {
  AuditModel,
  BugTrackerIssueModel,
  BugTrackerNotificationModel,
  EmployeeModel,
  NotificationModel,
  UserModel,
  ProjectModel,
  TeamModel
} from '../models';

/**
 * Safely logs a side-effect failure (audit/notification write) without blocking
 * the main user action. Logs are structured and intentionally omit stack traces,
 * tokens, credentials, and other sensitive data to avoid leaking secrets.
 */
function logBtSideEffectError(operation: string, error?: unknown): void {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
  // Sanitize: strip any potential token/credential-looking substrings from the message.
  const sanitized = message.replace(/[A-Za-z0-9-_]{20,}/g, '<redacted>');
  console.error(
    JSON.stringify({
      level: 'error',
      service: 'workforce-bug-tracker',
      operation,
      error: sanitized,
      at: new Date().toISOString(),
    })
  );
}

export const bugTrackerRouter = Router();

/** All Bug Tracker endpoints require a signed-in session. */
bugTrackerRouter.use(requireAuth);

/** Role resolution (fail closed) */

/**
 * Resolve the signed-in user's Bug Tracker context: role and the internal ID
 * used for issue ownership (assigneeId / reporterId).
 *
 * A linked BugTrackerEmployee record (via userId -> Workforce User._id) takes
 * precedence, because the tracker maintains its own five-role directory
 * (admin / manager / developer / qa / reporter).  The linked record's _id is
 * used as the bug tracker user ID so that assigneeId / reporterId values stay
 * in one ID space.
 *
 * When no linked record exists, identity is unresolved:
 *  - management + canManagePayroll -> admin (system administrators)
 *  - management -> manager
 *  - employee -> null (fail closed: no Bug Tracker directory record, no access)
 *
 * QA and reporter are only reachable through the tracker directory.  We never
 * silently grant Developer privileges to an employee without a linked record.
 */
interface BugTrackerContext {
  role: string;
  id: string;
}

/** Resolve a Bug Tracker identity (Workforce employee id or user id) to a Workforce user. */
async function workforceUserForBtId(id: string | null | undefined): Promise<any | null> {
  if (!id) return null;
  const u = await UserModel.findById(id).lean();
  if (u) return u;
  const emp = await EmployeeModel.findById(id).lean();
  if (!emp) return null;
  return await UserModel.findOne({ employeeId: id, active: true }).lean();
}

async function getBugTrackerContext(user: AuthUser): Promise<BugTrackerContext | null> {
  // Management users are authorized through their Workforce role. They act under
  // their own Workforce user id (no employee record required).
  if (user.role === 'management') {
    return { role: user.canManagePayroll ? 'admin' : 'manager', id: user.id };
  }

  // Employees resolve to their Workforce employee record. Bug Tracker identity is
  // the Workforce employee id; role is inferred from designation.
  const emp = user.employeeId ? await EmployeeModel.findById(user.employeeId).lean() : null;
  if (!emp || emp.status !== 'Active') return null;
  const designation = String(emp.designation || '').toLowerCase();
  let role = 'developer';
  if (designation.includes('qa') || designation.includes('quality')) role = 'qa';
  return { role, id: emp._id as string };
}

function mapWorkforceRoleToBt(role: string, canManagePayroll: boolean): string {
  if (role === 'management' && canManagePayroll) return 'admin';
  if (role === 'management') return 'manager';
  return 'developer';
}

const rolePermissions: Record<string, {
  manageSettings: boolean;
  triage: boolean;
  assign: boolean;
  setPriority: boolean;
  viewTeam: boolean;
  viewQAQueue: boolean;
  verifyQA: boolean;
  viewReports: boolean;
  editAnyIssue: boolean;
}> = {
  admin: { manageSettings: true, triage: true, assign: true, setPriority: true, viewTeam: true, viewQAQueue: true, verifyQA: true, viewReports: true, editAnyIssue: true },
  manager: { manageSettings: false, triage: true, assign: true, setPriority: true, viewTeam: true, viewQAQueue: true, verifyQA: false, viewReports: true, editAnyIssue: true },
  developer: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: false, verifyQA: false, viewReports: false, editAnyIssue: false },
  qa: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: true, verifyQA: true, viewReports: true, editAnyIssue: false },
  reporter: { manageSettings: false, triage: false, assign: false, setPriority: false, viewTeam: false, viewQAQueue: false, verifyQA: false, viewReports: false, editAnyIssue: false }
};

/** Whether the user can see a given issue. */
function canViewIssue(userRole: string, userId: string, issue: {projectId: string;assigneeId?: string | null | undefined;reporterId: string;status: string}): boolean {
  if (userRole === 'admin' || userRole === 'qa') return true;
  if (userRole === 'reporter') return issue.reporterId === userId;
  return issue.assigneeId === userId || issue.reporterId === userId;
}

/** Whether the user can edit a given issue. */
function canEditIssue(userRole: string, userId: string, issue: {assigneeId?: string | null | undefined;reporterId: string;status: string}): boolean {
  if (rolePermissions[userRole]?.editAnyIssue) return true;
  if (issue.assigneeId === userId) return true;
  return issue.reporterId === userId && issue.status === 'New';
}

/** Workflow validation (server-side mirror of src/bugTracker/utils/workflow.ts) */

const BT_TRANSITIONS: Record<string, {
  from: string[];
  to: string;
  roles: string[];
  assigneeOnly?: boolean;
}> = {
  triage: { from: ['New'], to: 'Triaged', roles: ['admin', 'manager'] },
  assign: { from: ['New', 'Triaged'], to: 'Assigned', roles: ['admin', 'manager'] },
  start: { from: ['Assigned'], to: 'In Progress', roles: ['admin', 'manager', 'developer'], assigneeOnly: true },
  resume: { from: ['Reopened'], to: 'In Progress', roles: ['admin', 'manager', 'developer'], assigneeOnly: true },
  'submit-qa': { from: ['In Progress'], to: 'Fixed', roles: ['admin', 'manager', 'developer'], assigneeOnly: true },
  'start-testing': { from: ['Fixed'], to: 'QA Testing', roles: ['admin', 'qa'] },
  'pass-qa': { from: ['QA Testing'], to: 'Resolved', roles: ['admin', 'qa'] },
  'fail-qa': { from: ['QA Testing'], to: 'Reopened', roles: ['admin', 'qa'] },
  close: { from: ['Resolved'], to: 'Closed', roles: ['admin', 'manager'] },
  reopen: { from: ['Resolved', 'Closed'], to: 'Reopened', roles: ['admin', 'manager', 'qa', 'reporter'] }
};

function validateTransition(userRole: string, userId: string, issue: {status: string;assigneeId?: string | null | undefined;reporterId: string}, transitionId: string): {ok: true;to: string} | {ok: false;error: string} {
  const t = BT_TRANSITIONS[transitionId];
  if (!t) return { ok: false, error: 'Unknown transition.' };
  if (!t.from.includes(issue.status)) return { ok: false, error: `Cannot transition from ${issue.status}.` };
  if (!t.roles.includes(userRole)) return { ok: false, error: `Your role cannot perform this transition.` };
  if (t.assigneeOnly && issue.assigneeId !== userId) return { ok: false, error: 'Only the assignee can perform this transition.' };
  if (transitionId === 'reopen' && userRole === 'reporter' && issue.reporterId !== userId) return { ok: false, error: 'Only the reporter can reopen this issue.' };
  return { ok: true, to: t.to };
}

/** Audit & notification helpers */

async function writeAuditEntry(user: AuthUser, action: string, entity: string, entityId: string, previous?: string, next?: string): Promise<void> {
  await new AuditModel({
    _id: `bt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    actor: user.name,
    action,
    entity,
    entityId,
    at: new Date().toISOString(),
    previous,
    next
  }).save();
}

async function createBtNotification(recipientId: string, title: string, body: string, issueKey?: string): Promise<void> {
  await new NotificationModel({
    _id: `bt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    audience: recipientId,
    title,
    body,
    link: issueKey ? `/bug-tracker/issues/${issueKey}` : undefined,
    createdAt: new Date().toISOString(),
    read: false,
    tone: 'info'
  }).save();
}

/** Attachment storage (not publicly served) */

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../");
const btUploadDir = path.resolve(root, "uploads/bug-tracker");
if (!fs.existsSync(btUploadDir)) fs.mkdirSync(btUploadDir, { recursive: true });

const btStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, btUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const id = (req as any).user?.id || "unknown";
    const name = `bt-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const btFileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv"];
  const allowedExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".txt", ".log", ".har", ".csv"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExt.includes(ext)) cb(null, true);
  else cb(new Error("Unsupported file type. Allowed: PNG, JPG, WebP, GIF, PDF, TXT, LOG, HAR, CSV."));
};

const btUpload = multer({ storage: btStorage, fileFilter: btFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

/** Resolve a stored attachment filename to a safe, absolute path within the upload directory.
 *  Prevents path traversal by ensuring the resolved path stays inside btUploadDir. */
function resolveAttachmentPath(filename: string): string | null {
  const safeName = path.basename(filename); // strip any directory components
  const resolved = path.resolve(btUploadDir, safeName);
  if (!resolved.startsWith(btUploadDir + path.sep) && resolved !== btUploadDir) return null;
  return resolved;
}

/** Rate limiting (reuse express-rate-limit, already a dependency) */
const issueLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many issue requests. Please slow down.' }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many comments. Please slow down.' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please slow down.' }
});

/** Normalize a Mongoose lean issue document into the frontend contract (id = _id). */
function toApiIssue(doc: any): any {
  if (!doc) return doc;
  const out = { ...doc };
  if (out._id !== undefined && out.id === undefined) out.id = out._id;
  return out;
}

/** Issue list with optional filters */

bugTrackerRouter.get('/issues', issueLimiter, async (_req, res) => {
  const { projectId, status, assigneeId, reporterId, search } = _req.query as Record<string, string> | undefined ?? {};
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity. Contact an administrator.' }); return; }
  const { role: userRole, id: btId } = context;
  const filter: Record<string, unknown> = {};
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;
  if (assigneeId) filter.assigneeId = assigneeId;
  if (reporterId) filter.reporterId = reporterId;
  if (search) filter.$text = { $search: search };

  const issues = await BugTrackerIssueModel.find(filter).sort({ updatedAt: -1 }).lean();

  let visible = issues;
  if (userRole !== 'admin' && userRole !== 'qa') {
    // Resolve project memberships from Workforce.
    let projectIds: string[] = [];
    if (_req.user!.role === 'employee' && _req.user!.employeeId) {
      const projects = await ProjectModel.find({ employeeIds: _req.user!.employeeId }).lean();
      projectIds = projects.map((p: any) => p._id);
    }
    visible = issues.filter((issue: any) =>
      issue.assigneeId === btId ||
      issue.reporterId === btId ||
      projectIds.includes(issue.projectId)
    );
  }

  res.json({ issues: visible.map(toApiIssue) });
});

/** Single issue by key � visibility checked server-side. */
bugTrackerRouter.get('/issues/:key', issueLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key }).lean();
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canViewIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to view this issue.' }); return;
  }
  res.json({ issue: toApiIssue(issue) });
});

/** Create a new issue � any authenticated user with directory access may report. */
bugTrackerRouter.post('/issues', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { id: btId } = context;
  const body = _req.body as Record<string, unknown>;
  const key = `WF-${String(Math.floor(Math.random() * 9000) + 1000).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const issue = new BugTrackerIssueModel({
    _id: `iss-${Date.now().toString(36)}`,
    key,
    title: String(body.title ?? ''),
    description: String(body.description ?? ''),
    projectId: String(body.projectId ?? ''),
    type: String(body.type ?? 'Bug'),
    severity: String(body.severity ?? 'Medium'),
    priority: String(body.priority ?? 'Normal'),
    status: 'New',
    assigneeId: body.assigneeId ?? null,
    reporterId: btId,
    createdAt: now,
    updatedAt: now,
    dueDate: body.dueDate ?? null,
    feature: String(body.feature ?? ''),
    environment: String(body.environment ?? 'Production'),
    stepsToReproduce: Array.isArray(body.stepsToReproduce) ? body.stepsToReproduce : [],
    expectedResult: String(body.expectedResult ?? ''),
    actualResult: String(body.actualResult ?? ''),
    labels: Array.isArray(body.labels) ? body.labels : [],
    attachments: [],
    comments: [],
    activity: [{ id: `act-${Date.now().toString(36)}`, actorId: btId, message: 'reported this issue', createdAt: now, toStatus: 'New' }],
    relatedIssueKeys: [],
    qa: { status: 'Not submitted' }
  });
  await issue.save();

  try { await writeAuditEntry(_req.user!, 'Issue reported', 'BugTrackerIssue', issue.key, undefined, issue.title); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
  // Notify assignee if one was set, plus management users for triage.
  const reporterName = _req.user!.name;
  if (body.assigneeId) {
    const assigneeUser = await workforceUserForBtId(String(body.assigneeId));
    if (assigneeUser?._id) {
      try { await createBtNotification(assigneeUser._id, 'Assigned to you', `${key} ${issue.title}`, key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }
  const managers = await UserModel.find({ role: 'management', active: true }).lean();
  for (const m of managers as any[]) {
    if (m._id && m._id !== _req.user!.id) {
      try { await createBtNotification(m._id, 'New issue reported', `${reporterName} reported ${key}: ${issue.title}`, key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }

  res.status(201).json({ issue: toApiIssue(issue.toObject({ virtuals: true })) });
});

/** Update an issue field(s) � edit permission checked server-side. */
bugTrackerRouter.patch('/issues/:key', issueLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canEditIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to edit this issue.' }); return;
  }
  const body = _req.body as Record<string, unknown>;
  const allowed = ['title','description','type','severity','priority','dueDate','feature','environment','labels','stepsToReproduce','expectedResult','actualResult','fixSummary','reopenReason','blocked','blockedReason','assigneeId','status'];
  const updates: Record<string, unknown> = {};
  const previous: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      previous[k] = issue[k as keyof typeof issue];
      updates[k] = body[k];
    }
  }
  updates.updatedAt = new Date().toISOString();
  Object.assign(issue, updates);
  await issue.save();

  const changed = Object.keys(updates).filter(k => k !== 'updatedAt').join(', ');
  if (changed) {
    try { await writeAuditEntry(_req.user!, 'Issue updated', 'BugTrackerIssue', issue.key, previous[changed] ? JSON.stringify(previous) : undefined, JSON.stringify(updates)); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    if (body.assigneeId && body.assigneeId !== issue.assigneeId) {
      const assigneeUser = await workforceUserForBtId(String(body.assigneeId));
      if (assigneeUser?._id) {
        try { await createBtNotification(assigneeUser._id, 'Assigned to you', `${issue.key} ${issue.title}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
      }
    }
  }

  res.json({ issue: toApiIssue(issue.toObject({ virtuals: true })) });
});

/** Workflow transition � role and state validated server-side. */
bugTrackerRouter.post('/issues/:key/transition', issueLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  const body = _req.body as Record<string, unknown>;
  const transitionId = String(body.transitionId ?? '');
  const note = body.note ? String(body.note) : undefined;
  const now = new Date().toISOString();

  const validation = validateTransition(userRole, btId, issue, transitionId);
  if (!validation.ok) { res.status(403).json({ error: validation.error }); return; }
  const toStatus = validation.to;

  const previousStatus = issue.status;
  issue.status = toStatus;
  issue.updatedAt = now;
  if (body.assigneeId) issue.assigneeId = String(body.assigneeId);

  switch (transitionId) {
    case 'submit-qa':
      issue.submittedForQaAt = now;
      issue.fixSummary = note;
      issue.qa = { status: 'Awaiting QA' };
      break;
    case 'start-testing':
      issue.qa = { status: 'In testing', verifierId: btId };
      break;
    case 'pass-qa': {
      issue.qa = { status: 'Passed', verifierId: btId, notes: note, verifiedAt: now };
      issue.resolution = {
        summary: issue.fixSummary ?? 'Fix verified by QA.',
        resolvedById: issue.assigneeId ?? btId,
        resolvedAt: now,
        verificationOutcome: 'Passed QA verification'
      };
      if (note) issue.comments.push({ id: `cmt-${Date.now().toString(36)}`, authorId: btId, body: note, createdAt: now, kind: 'qa-pass' });
      break;
    }
    case 'fail-qa': {
      issue.qa = { status: 'Failed', verifierId: btId, reason: note, verifiedAt: now };
      issue.resolution = undefined;
      issue.reopenReason = note;
      if (note) issue.comments.push({ id: `cmt-${Date.now().toString(36)}`, authorId: btId, body: note, createdAt: now, kind: 'qa-fail' });
      break;
    }
    case 'reopen': {
      issue.reopenReason = note;
      issue.resolution = undefined;
      issue.qa = { status: 'Not submitted' };
      if (note) issue.comments.push({ id: `cmt-${Date.now().toString(36)}`, authorId: btId, body: note, createdAt: now, kind: 'reopen' });
      break;
    }
    case 'close': {
      if (!issue.resolution) {
        issue.resolution = { summary: note ?? 'Closed without code changes.', resolvedById: btId, resolvedAt: now, verificationOutcome: 'Closed by manager' };
      } else if (note) {
        issue.comments.push({ id: `cmt-${Date.now().toString(36)}`, authorId: btId, body: note, createdAt: now, kind: 'comment' });
      }
      break;
    }
    default:
      if (note) issue.fixSummary = note;
      break;
  }

  await issue.save();

  try { await writeAuditEntry(_req.user!, `Issue transitioned: ${transitionId}`, 'BugTrackerIssue', issue.key, previousStatus, toStatus); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }

  // Notifications on transition outcomes.
  const reporterUser = await workforceUserForBtId(issue.reporterId);
  const assigneeUser = issue.assigneeId ? await workforceUserForBtId(issue.assigneeId) : null;
  if (transitionId === 'submit-qa') {
    const wfEmployees = await EmployeeModel.find({ status: 'Active' }).lean();
    const qaUsers: any[] = [];
    for (const e of wfEmployees as any[]) {
      const d = String(e.designation || '').toLowerCase();
      if (d.includes('qa') || d.includes('quality')) {
        const u = await UserModel.findOne({ employeeId: e._id, active: true }).lean();
        if (u) qaUsers.push(u);
      }
    }
    for (const q of qaUsers) {
      try { await createBtNotification(q._id, 'Ready for QA', `${issue.key} ${issue.title}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }
  if (transitionId === 'pass-qa' || transitionId === 'fail-qa' || transitionId === 'reopen') {
    const recipients = new Set<string>();
    if (reporterUser?._id) recipients.add(reporterUser._id);
    if (assigneeUser?._id) recipients.add(assigneeUser._id);
    for (const rid of recipients) {
      try { await createBtNotification(rid, transitionId === 'pass-qa' ? 'Fix verified' : 'Issue reopened', `${issue.key} ${issue.title}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }

  res.json({ issue: toApiIssue(issue.toObject({ virtuals: true })) });
});

/** Add a comment � any authenticated user may comment on a visible issue. */
bugTrackerRouter.post('/issues/:key/comments', commentLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canViewIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to comment on this issue.' }); return;
  }
  const body = _req.body as Record<string, unknown>;
  const comment = {
    id: `cmt-${Date.now().toString(36)}`,
    authorId: btId,
    body: String(body.body ?? ''),
    createdAt: new Date().toISOString(),
    kind: String(body.kind ?? 'comment')
  };
  issue.comments.push(comment as any);
  issue.updatedAt = new Date().toISOString();
  await issue.save();

  try { await writeAuditEntry(_req.user!, 'Comment added', 'BugTrackerIssue', issue.key, undefined, comment.body); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }

  // Notify assignee and reporter of new comment.
  const recipients = new Set<string>();
  if (issue.assigneeId) {
    const aUser = await workforceUserForBtId(issue.assigneeId);
    if (aUser?._id) recipients.add(aUser._id);
  }
  if (issue.reporterId) {
    const rUser = await workforceUserForBtId(issue.reporterId);
    if (rUser?._id) recipients.add(rUser._id);
  }
  for (const rid of recipients) {
    if (rid !== _req.user!.id) {
      try { await createBtNotification(rid, 'New comment', `${issue.key}: ${comment.body}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }

  res.status(201).json({ comment });
});

/** Add attachments (JSON payload) to an issue. */
bugTrackerRouter.post('/issues/:key/attachments', uploadLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canViewIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to attach to this issue.' }); return;
  }
  const body = _req.body as Record<string, unknown>;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  issue.attachments.push(...(attachments as any));
  issue.updatedAt = new Date().toISOString();
  await issue.save();
  res.json({ issue: toApiIssue(issue.toObject({ virtuals: true })) });
});

/** Upload a file attachment to an issue (multipart). */
bugTrackerRouter.post('/issues/:key/attachments/upload', uploadLimiter, btUpload.single('file'), async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canViewIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to attach to this issue.' }); return;
  }
  if (!_req.file) { res.status(400).json({ error: 'No file uploaded.' }); return; }

  const file = _req.file as Express.Multer.File;
  const now = new Date().toISOString();
  const isImage = file.mimetype.startsWith('image/');
  // file.filename is the generated on-disk name (multer storage); file.originalname
  // is the user-supplied name. Store both so the download endpoint can resolve the
  // correct file on disk while displaying the original name to users.
  const attachment = {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.originalname,
    fileName: file.filename,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    kind: isImage ? 'image' : /\.(log|har|txt)$/i.test(file.originalname) ? 'log' : /\.(pdf|csv)$/i.test(file.originalname) ? 'document' : 'document',
    // previewUrl points to the authenticated download endpoint with the on-disk filename.
    previewUrl: `/api/bug-tracker/issues/${issue.key}/attachments/download?filename=${encodeURIComponent(file.filename)}`,
    uploadedById: btId,
    uploadedAt: now
  };

  issue.attachments.push(attachment);
  issue.updatedAt = now;
  await issue.save();

  try { await writeAuditEntry(_req.user!, 'Attachment uploaded', 'BugTrackerIssue', issue.key, undefined, file.originalname); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }

  res.status(201).json({ attachment });
});

/** Download/preview a file attachment � authenticated, authorization-checked.
 *  Serves the file only if the requesting user can view the associated issue.
 *  Path traversal is prevented by resolving through path.basename. */
bugTrackerRouter.get('/issues/:key/attachments/download', issueLimiter, async (_req, res) => {
  const { filename } = _req.query as { filename?: string };
  if (!filename) { res.status(400).json({ error: 'Missing filename.' }); return; }

  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key }).lean();
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }

  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  if (!canViewIssue(userRole, btId, issue)) {
    res.status(403).json({ error: 'You do not have permission to access this attachment.' }); return;
  }

  // Verify the attachment belongs to this issue (prevents guessing filenames of other issues).
  const attachment = issue.attachments.find((a: any) => a.fileName === filename);
  if (!attachment) {
    res.status(404).json({ error: 'Attachment not found on this issue.' }); return;
  }

  const filePath = resolveAttachmentPath(filename);
  if (!filePath) { res.status(400).json({ error: 'Invalid attachment filename.' }); return; }

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    res.status(404).json({ error: 'Attachment file not found on server.' }); return;
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
    '.txt': 'text/plain', '.log': 'text/plain', '.csv': 'text/csv', '.har': 'application/json',
    '.bin': 'application/octet-stream'
  };
  res.set('Content-Type', mimeMap[ext] ?? 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.set('Cache-Control', 'no-store');
  res.sendFile(filePath);
});

/** Employee directory for bug tracker � uses existing Workforce employee data. */
bugTrackerRouter.get('/employees', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }

  const wfEmployees = await EmployeeModel.find({ status: 'Active' }).sort({ name: 1 }).lean();
  const projects = await ProjectModel.find({}).lean();
  const allUsers = await UserModel.find({ active: true }).lean();

  // Map employee -> project ids using existing Workforce project membership.
  const empProjectMap = new Map<string, string[]>();
  for (const p of projects as any[]) {
    for (const eid of (p.employeeIds || [])) {
      if (!empProjectMap.has(eid)) empProjectMap.set(eid, []);
      empProjectMap.get(eid)!.push(p._id);
    }
  }
  const userByEmployee = new Map<string, any>();
  const userByEmail = new Map<string, any>();
  for (const u of allUsers as any[]) {
    if (u.employeeId) userByEmployee.set(u.employeeId, u);
    if (u.email) userByEmail.set(String(u.email).toLowerCase(), u);
  }

  const mapped: any[] = [];
  for (const e of wfEmployees as any[]) {
    const u = userByEmployee.get(e._id) || userByEmail.get(String(e.email || '').toLowerCase());
    const designation = String(e.designation || '').toLowerCase();
    let role = 'developer';
    if (designation.includes('qa') || designation.includes('quality')) role = 'qa';
    mapped.push({
      id: e._id,
      name: e.name,
      initials: String(e.name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      title: e.designation ?? '',
      email: e.email,
      teamId: e.teamId,
      role,
      projectIds: empProjectMap.get(e._id) || [],
      userId: u ? u._id : undefined
    });
  }

  // Management users without an employee record are exposed as pseudo-employees so
  // they can be assigned/reported against using their Workforce user id.
  for (const u of allUsers as any[]) {
    if (u.role !== 'management' || u.employeeId) continue;
    mapped.push({
      id: u._id,
      name: u.name,
      initials: String(u.name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      title: u.title || '',
      email: u.email,
      teamId: '',
      role: u.canManagePayroll ? 'admin' : 'manager',
      projectIds: [],
      userId: u._id
    });
  }

  res.json({ employees: mapped });
});

/** Projects for bug tracker � uses Workforce project data. */
bugTrackerRouter.get('/projects', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const projects = await ProjectModel.find({}).sort({ name: 1 }).lean();
  const mapped = projects.map((p: any) => ({
    id: p._id,
    name: p.name,
    code: p.code,
    leadId: p.managerId
  }));
  res.json({ projects: mapped });
});

/** Teams for bug tracker � uses Workforce team data. */
bugTrackerRouter.get('/teams', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const teams = await TeamModel.find({}).sort({ name: 1 }).lean();
  const mapped = teams.map((t: any) => ({
    id: t._id,
    name: t.name,
    managerId: t.leadId
  }));
  res.json({ teams: mapped });
});

/** Notifications for the signed-in user � Workforce notifications merged with Bug Tracker notifications. */
bugTrackerRouter.get('/notifications', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const btNotifications = await BugTrackerNotificationModel.find({ recipientId: _req.user!.id }).sort({ createdAt: -1 }).lean();
  const workforceNotifications = await NotificationModel.find({ audience: _req.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ notifications: [...btNotifications, ...workforceNotifications] });
});

/** Mark notifications as read. */
bugTrackerRouter.post('/notifications/read', issueLimiter, async (_req, res) => {
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  await BugTrackerNotificationModel.updateMany({ recipientId: _req.user!.id, read: false }, { $set: { read: true } });
  await NotificationModel.updateMany({ audience: _req.user!.id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});
