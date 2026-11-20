import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { projectRoot } from '../paths';
import { requireAuth } from '../auth';
import type { AuthUser } from '../../shared/types';
import { io } from '../socket';
import { invalidateCache } from '../store';
import { deleteAsset, signedUrl, StorageUnavailableError, uploadAttachment, type DeliveryType, type ResourceType } from '../storage/cloudinary';
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
  qa: { manageSettings: false, triage: false, assign: true, setPriority: false, viewTeam: false, viewQAQueue: true, verifyQA: true, viewReports: true, editAnyIssue: false },
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
  // Only the reporter may edit their own issue while it is still New.
  // Developers/QA change status via transitions (start / submit-qa / pass-qa etc.),
  // not by editing manager-set fields such as assignee, priority, title or description.
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
  // Management/admin oversee all issues; assigneeOnly applies only to developers
  // (their userId matches employee assigneeId). Management userId is in a different
  // ID space, so bypass the check for them.
  if (t.assigneeOnly && !['admin', 'manager'].includes(userRole) && issue.assigneeId !== userId) return { ok: false, error: 'Only the assignee can perform this transition.' };
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
  await new BugTrackerNotificationModel({
    _id: `bt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    recipientId,
    title,
    body,
    link: issueKey ? `/bug-tracker/issues/${issueKey}` : undefined,
    createdAt: new Date().toISOString(),
    read: false,
    tone: 'info'
  }).save();
}

/**
 * Attachment storage.
 *
 * New uploads go to Cloudinary as private ("authenticated") assets under
 * <root>/bug-tracker/<issueKey>/. Multer keeps the file in memory only long enough to
 * stream it there. The legacy disk directory is kept for the old download route.
 */

const btUploadDir = path.resolve(projectRoot, "uploads/bug-tracker");

const btStorage = multer.memoryStorage();

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

/**
 * Rate limiting (reuse express-rate-limit, already a dependency).
 *
 * Limits are counted per signed-in user (requireAuth runs first), not per IP,
 * so colleagues behind one office NAT don't share a budget. Reads and writes
 * have separate budgets so normal browsing can't starve mutations.
 */
const perUserKey = (req: any): string => (req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`);

/** GET endpoints: issue list/detail, directory lookups, notifications, downloads. */
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: perUserKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

/** Issue create / edit / transition / delete, notification mark-read. */
const issueLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: perUserKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many issue requests. Please slow down.' }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: perUserKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many comments. Please slow down.' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: perUserKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please slow down.' }
});

/** Number of attachments included in list summaries (Kanban card thumbnails). */
const ATTACHMENT_PREVIEW_COUNT = 3;

/**
 * Client-facing form of one attachment.
 *
 * Storage internals (publicId, resourceType, ...) never leave the server. Cloudinary
 * assets get a signed URL only when `sign` is true, which callers pass only on HTTP
 * responses that already passed the issue permission check. Socket broadcasts reach
 * every connected user, so they always use sign=false and carry no URL for private
 * files. Legacy attachments (base64 previewUrl) pass through unchanged.
 */
function presentAttachment(a: any, sign: boolean): any {
  if (!a || typeof a !== 'object') return a;
  const { publicId, resourceType, deliveryType, format, version, ...rest } = a;
  if (publicId) {
    rest.stored = true;
    rest.previewUrl = sign
      ? signedUrl({ publicId, resourceType: resourceType as ResourceType, deliveryType: deliveryType as DeliveryType, format, version })
      : undefined;
  }
  return rest;
}

/**
 * Normalize a Mongoose lean issue document into the frontend contract (id = _id)
 * and add the summary fields the issue list relies on:
 * commentCount, commentAuthorIds, attachmentCount, attachmentPreview, resolvedAt.
 * Docs that already carry them (from the list aggregation) are left as is.
 * `sign` adds signed URLs for stored attachments (see presentAttachment).
 */
function toApiIssue(doc: any, opts: { sign?: boolean } = {}): any {
  if (!doc) return doc;
  const sign = opts.sign === true;
  const out = { ...doc };
  if (out._id !== undefined && out.id === undefined) out.id = out._id;
  if (Array.isArray(out.comments)) {
    out.commentCount = out.comments.length;
    out.commentAuthorIds = [...new Set(out.comments.map((c: any) => c.authorId))];
  }
  if (Array.isArray(out.attachments)) {
    out.attachmentCount = out.attachments.length;
    // First few *image* attachments — what the Kanban card renders as thumbnails.
    out.attachmentPreview = out.attachments.filter((a: any) => a.kind === 'image').slice(0, ATTACHMENT_PREVIEW_COUNT);
    out.attachments = out.attachments.map((a: any) => presentAttachment(a, sign));
  }
  if (Array.isArray(out.attachmentPreview)) {
    out.attachmentPreview = out.attachmentPreview.map((a: any) => presentAttachment(a, sign));
  }
  if (out.resolvedAt === undefined) out.resolvedAt = out.resolution?.resolvedAt ?? null;
  return out;
}

/** HTTP-response form: signed URLs included. Only call after the permission check. */
const toSignedApiIssue = (doc: any): any => toApiIssue(doc, { sign: true });

/**
 * Attachments sent as JSON by a client (legacy base64 flow). Only display fields are
 * kept: storage fields are stripped so nobody can point an attachment at another
 * issue's private Cloudinary asset and get a signed URL for it, and the uploader is
 * always the caller.
 */
function sanitizeClientAttachments(input: unknown, uploaderId: string): any[] {
  if (!Array.isArray(input)) return [];
  const now = new Date().toISOString();
  return input
    .filter((a: any) => a && typeof a === 'object' && a.name)
    .map((a: any) => ({
      id: String(a.id ?? `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
      name: String(a.name).slice(0, 255),
      sizeKb: Number.isFinite(Number(a.sizeKb)) ? Number(a.sizeKb) : 0,
      kind: ['image', 'document', 'log'].includes(a.kind) ? a.kind : 'document',
      ...(typeof a.previewUrl === 'string' && a.previewUrl.startsWith('data:image/') ? { previewUrl: a.previewUrl } : {}),
      uploadedById: uploaderId,
      uploadedAt: typeof a.uploadedAt === 'string' ? a.uploadedAt : now
    }));
}

/** Fields only sent with the full issue (GET /issues/:key, mutation responses). */
const HEAVY_ISSUE_FIELDS = [
  'description', 'stepsToReproduce', 'expectedResult', 'actualResult',
  'attachments', 'comments', 'activity', 'resolution'
] as const;

/**
 * List-summary form of an issue: toApiIssue() derived fields, heavy fields removed.
 * Used for socket broadcasts so every connected client gets only what the
 * shared issue list needs.
 */
function toIssueSummary(doc: any): any {
  const out = toApiIssue(doc);
  if (!out) return out;
  for (const field of HEAVY_ISSUE_FIELDS) delete out[field];
  return out;
}

/**
 * Aggregation $project for GET /issues: light fields plus derived summary
 * fields computed in MongoDB, so heavy arrays never leave the database.
 */
const ISSUE_SUMMARY_PROJECTION = {
  key: 1, title: 1, projectId: 1, type: 1, severity: 1, priority: 1, status: 1,
  assigneeId: 1, reporterId: 1, createdAt: 1, updatedAt: 1, dueDate: 1,
  feature: 1, environment: 1, labels: 1, relatedIssueKeys: 1, blocked: 1,
  blockedReason: 1, submittedForQaAt: 1, fixSummary: 1, reopenReason: 1, qa: 1,
  commentCount: { $size: { $ifNull: ['$comments', []] } },
  commentAuthorIds: { $setUnion: [{ $ifNull: ['$comments.authorId', []] }, []] },
  attachmentCount: { $size: { $ifNull: ['$attachments', []] } },
  attachmentPreview: {
    $slice: [
      { $filter: { input: { $ifNull: ['$attachments', []] }, as: 'a', cond: { $eq: ['$$a.kind', 'image'] } } },
      ATTACHMENT_PREVIEW_COUNT
    ]
  },
  resolvedAt: { $ifNull: ['$resolution.resolvedAt', null] }
};

/**
 * MongoDB filter for the issues a user may see in lists and feeds.
 * admin / qa: everything. Others: issues they are assigned to or reported, plus
 * (for employees) issues in Workforce projects they are a member of.
 * Shared by GET /issues and GET /overview/activity so both stay in sync.
 */
async function issueVisibilityMatch(user: AuthUser, context: BugTrackerContext): Promise<Record<string, unknown>> {
  const { role: userRole, id: btId } = context;
  if (userRole === 'admin' || userRole === 'qa') return {};
  let projectIds: string[] = [];
  if (user.role === 'employee' && user.employeeId) {
    const projects = await ProjectModel.find({ employeeIds: user.employeeId }, { _id: 1 }).lean();
    projectIds = projects.map((p: any) => String(p._id));
  }
  const or: Record<string, unknown>[] = [{ assigneeId: btId }, { reporterId: btId }];
  if (projectIds.length) or.push({ projectId: { $in: projectIds } });
  return { $or: or };
}

/** Issue list with optional filters */

bugTrackerRouter.get('/issues', readLimiter, async (_req, res) => {
  const { projectId, status, assigneeId, reporterId, search } = _req.query as Record<string, string> | undefined ?? {};
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity. Contact an administrator.' }); return; }
  const filter: Record<string, unknown> = {};
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;
  if (assigneeId) filter.assigneeId = assigneeId;
  if (reporterId) filter.reporterId = reporterId;
  if (search) filter.$text = { $search: search };

  // Visibility is applied in the query, so invisible issues are never loaded.
  const visibility = await issueVisibilityMatch(_req.user!, context);
  const query = Object.keys(visibility).length ? { $and: [filter, visibility] } : filter;

  // Summary list: heavy fields (description, steps, comments, activity,
  // attachments, resolution) never leave MongoDB — the derived summary fields
  // are computed in the projection. Full issues come from GET /issues/:key.
  const issues = await BugTrackerIssueModel.aggregate([
    { $match: query },
    { $sort: { updatedAt: -1 } },
    { $project: ISSUE_SUMMARY_PROJECTION }
  ]);

  res.json({ issues: issues.map(toSignedApiIssue) });
});

/**
 * Recent activity feed for the Overview page.
 * Query: projectId (optional), since=YYYY-MM-DD (issues created on/after), limit (default 8, max 50).
 * Returns the newest activity entries across visible issues, without loading
 * full issue documents into the client.
 */
bugTrackerRouter.get('/overview/activity', readLimiter, async (_req, res) => {
  const { projectId, since, limit } = _req.query as Record<string, string | undefined>;
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity. Contact an administrator.' }); return; }

  const filter: Record<string, unknown> = {};
  if (projectId && projectId !== 'all') filter.projectId = String(projectId);
  if (since && /^\d{4}-\d{2}-\d{2}$/.test(since)) filter.createdAt = { $gte: since };
  const visibility = await issueVisibilityMatch(_req.user!, context);
  const match = Object.keys(visibility).length ? { $and: [filter, visibility] } : filter;
  const max = Math.min(Math.max(Number.parseInt(String(limit ?? ''), 10) || 8, 1), 50);

  const activity = await BugTrackerIssueModel.aggregate([
    { $match: match },
    { $project: { _id: 0, key: 1, title: 1, activity: 1 } },
    { $unwind: '$activity' },
    { $sort: { 'activity.createdAt': -1 } },
    { $limit: max },
    { $project: {
        id: '$activity.id',
        actorId: '$activity.actorId',
        message: '$activity.message',
        createdAt: '$activity.createdAt',
        toStatus: '$activity.toStatus',
        issueKey: '$key',
        issueTitle: '$title'
    } }
  ]);

  res.json({ activity });
});

/** Single issue by key � visibility checked server-side. */
bugTrackerRouter.get('/issues/:key', readLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key }).lean();
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  // Same rule as the issue list: anything the list shows a user (including
  // issues in their Workforce projects) must also open in Issue Detail, which
  // always loads through this endpoint.
  let allowed = canViewIssue(userRole, btId, issue);
  if (!allowed) {
    const visibility = await issueVisibilityMatch(_req.user!, context);
    allowed = Object.keys(visibility).length === 0 ||
      (await BugTrackerIssueModel.exists({ $and: [{ key: issue.key }, visibility] })) !== null;
  }
  if (!allowed) {
    res.status(403).json({ error: 'You do not have permission to view this issue.' }); return;
  }
  res.json({ issue: toSignedApiIssue(issue) });
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
    // The person reporting the bug (the logged-in QA engineer) is the assignee.
    // There is no Assignee dropdown at creation; the reporter is assigned automatically.
    assigneeId: String(body.assigneeId ?? btId),
    reporterId: btId,
    createdAt: now,
    updatedAt: now,
    dueDate: body.dueDate ?? null,
    feature: String(body.feature ?? ''),
    environment: String(body.environment ?? 'Production'),
    stepsToReproduce: Array.isArray(body.stepsToReproduce)
      ? body.stepsToReproduce
      : String(body.stepsToReproduce ?? '').split('\n').filter((s: string) => s.trim().length > 0),
    expectedResult: String(body.expectedResult ?? ''),
    actualResult: String(body.actualResult ?? ''),
    labels: Array.isArray(body.labels) ? body.labels : [],
    attachments: sanitizeClientAttachments(body.attachments, btId),
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
    try { await createBtNotification(String(body.assigneeId), 'Assigned to you', `${key} ${issue.title}`, key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
  }
  const managers = await UserModel.find({ role: 'management', active: true }).lean();
  for (const m of managers as any[]) {
    if (m._id && m._id !== _req.user!.id) {
      try { await createBtNotification(m._id, 'New issue reported', `${reporterName} reported ${key}: ${issue.title}`, key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }

  res.status(201).json({ issue: toSignedApiIssue(issue.toObject({ virtuals: true })) });
  io.emit('issue:created', toIssueSummary(issue.toObject({ virtuals: true })));
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
  // Normalise stepsToReproduce: the report form sends a multi-line string;
  // store it as an array so the issue detail page can render each step.
  if (body.stepsToReproduce !== undefined && !Array.isArray(issue.stepsToReproduce)) {
    issue.stepsToReproduce = String(body.stepsToReproduce).split('\n').filter((s: string) => s.trim().length > 0);
  }
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

  res.json({ issue: toSignedApiIssue(issue.toObject({ virtuals: true })) });
  io.emit('issue:updated', toIssueSummary(issue.toObject({ virtuals: true })));
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

  // Notifications on transition outcomes. Recipients are employee IDs (matching frontend currentUser.id).
  if (transitionId === 'submit-qa') {
    const wfEmployees = await EmployeeModel.find({ status: 'Active' }).lean();
    for (const e of wfEmployees as any[]) {
      const d = String(e.designation || '').toLowerCase();
      if (d.includes('qa') || d.includes('quality')) {
        try { await createBtNotification(e._id, 'Ready for QA', `${issue.key} ${issue.title}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
      }
    }
  }
  if (transitionId === 'pass-qa' || transitionId === 'fail-qa' || transitionId === 'reopen') {
    const recipients = new Set<string>();
    if (issue.reporterId) recipients.add(issue.reporterId);
    if (issue.assigneeId) recipients.add(issue.assigneeId);
    for (const rid of recipients) {
      try { await createBtNotification(rid, transitionId === 'pass-qa' ? 'Fix verified' : 'Issue reopened', `${issue.key} ${issue.title}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
    }
  }

  res.json({ issue: toSignedApiIssue(issue.toObject({ virtuals: true })) });
  io.emit('issue:transitioned', toIssueSummary(issue.toObject({ virtuals: true })));
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
  if (issue.assigneeId) recipients.add(issue.assigneeId);
  if (issue.reporterId) recipients.add(issue.reporterId);
  for (const rid of recipients) {
    try { await createBtNotification(rid, 'New comment', `${issue.key}: ${comment.body}`, issue.key); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
  }

  res.status(201).json({ comment });
  io.emit('issue:commented', { issueKey: _req.params.key, comment: { id: comment.id, authorId: comment.authorId, createdAt: comment.createdAt } });
  io.emit('issue:updated', toIssueSummary(issue.toObject({ virtuals: true })));
});

/** Delete an issue � admin, manager, or the reporter can delete their own issue. */
bugTrackerRouter.delete('/issues/:key', issueLimiter, async (_req, res) => {
  const issue = await BugTrackerIssueModel.findOne({ key: _req.params.key });
  if (!issue) { res.status(404).json({ error: 'Issue not found.' }); return; }
  const context = await getBugTrackerContext(_req.user!);
  if (!context) { res.status(403).json({ error: 'No Bug Tracker directory record for your identity.' }); return; }
  const { role: userRole, id: btId } = context;
  const isAdminOrManager = ['admin', 'manager'].includes(userRole);
  const isReporter = issue.reporterId === btId;
  if (!isAdminOrManager && !isReporter) {
    res.status(403).json({ error: 'You do not have permission to delete this issue.' }); return;
  }
  const storedFiles = (issue.attachments ?? []).filter((a: any) => a.publicId);
  await issue.deleteOne();
  // Remove the issue's files from Cloudinary too (best effort, never blocks the delete).
  for (const a of storedFiles as any[]) {
    void deleteAsset({ publicId: a.publicId, resourceType: a.resourceType, deliveryType: a.deliveryType });
  }
  try { await writeAuditEntry(_req.user!, 'Issue deleted', 'BugTrackerIssue', issue.key, issue.title, undefined); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }
  res.json({ ok: true, key: issue.key });
  io.emit('issue:deleted', { key: issue.key, id: issue._id as string });
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
  const attachments = sanitizeClientAttachments(body.attachments, btId);
  issue.attachments.push(...(attachments as any));
  issue.updatedAt = new Date().toISOString();
  await issue.save();
  res.json({ issue: toSignedApiIssue(issue.toObject({ virtuals: true })) });
  io.emit('issue:updated', toIssueSummary(issue.toObject({ virtuals: true })));
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
  const attachmentId = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // Store the file in Cloudinary as a private asset under <root>/bug-tracker/<issueKey>/.
  // Whatever Cloudinary reports (resource type, format, version) is what gets stored.
  let stored;
  try {
    stored = await uploadAttachment(issue.key, attachmentId, file.buffer, file.mimetype, file.originalname);
  } catch (err) {
    if (err instanceof StorageUnavailableError) { res.status(503).json({ error: err.message }); return; }
    logBtSideEffectError('bt-attachment-upload', err);
    res.status(502).json({ error: 'Could not store the file. Please try again.' }); return;
  }

  const attachment = {
    id: attachmentId,
    name: file.originalname,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    kind: isImage ? 'image' : /\.(log|har|txt)$/i.test(file.originalname) ? 'log' : 'document',
    uploadedById: btId,
    uploadedAt: now,
    publicId: stored.publicId,
    resourceType: stored.resourceType,
    deliveryType: stored.deliveryType,
    format: stored.format,
    version: stored.version
  };

  issue.attachments.push(attachment as any);
  issue.updatedAt = now;
  await issue.save();

  try { await writeAuditEntry(_req.user!, 'Attachment uploaded', 'BugTrackerIssue', issue.key, undefined, file.originalname); } catch (err) { logBtSideEffectError('bt-side-effect-write', err); }

  const full = toSignedApiIssue(issue.toObject({ virtuals: true }));
  res.status(201).json({ attachment: presentAttachment(attachment, true), issue: full });
  io.emit('issue:updated', toIssueSummary(issue.toObject({ virtuals: true })));
});

/** Download/preview a file attachment � authenticated, authorization-checked.
 *  Serves the file only if the requesting user can view the associated issue.
 *  Path traversal is prevented by resolving through path.basename. */
bugTrackerRouter.get('/issues/:key/attachments/download', readLimiter, async (_req, res) => {
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
bugTrackerRouter.get('/employees', readLimiter, async (_req, res) => {
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
bugTrackerRouter.get('/projects', readLimiter, async (_req, res) => {
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
bugTrackerRouter.get('/teams', readLimiter, async (_req, res) => {
  const teams = await TeamModel.find({}).sort({ name: 1 }).lean();
  const mapped = teams.map((t: any) => ({
    id: t._id,
    name: t.name,
    managerId: t.leadId
  }));
  res.json({ teams: mapped });
});

/** Notifications for the signed-in user � Workforce notifications merged with Bug Tracker notifications. */
bugTrackerRouter.get('/notifications', readLimiter, async (_req, res) => {
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
  // Workforce notifications live in the cached state; drop it so the read flags show.
  invalidateCache();
  res.json({ ok: true });
});
