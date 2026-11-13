import { Router } from 'express';
import type { Page } from 'playwright';
import type { AppState, Credentials, Employee } from '../../shared/types';
import { projectState } from '../../shared/domain/access';
import { runCommand } from '../../shared/domain/commands';
import { provisionEmployeeAccount, resetEmployeePassword, setEmployeeAccountActive } from '../accounts';
import { requireAuth, requirePasswordChanged, requireRole } from '../auth';
import { EmployeeModel, UserModel, PayslipModel, WfhHistoryModel } from '../models';
import { ensureLoaded, loadState, persistDiff, setCachedState, invalidateCache } from '../store';
import { config } from '../config';
import { withPdfBrowser } from '../pdfBrowser';
import { monthLabel } from '../../shared/domain/payroll';
import * as XLSX from 'xlsx';

export const apiRouter = Router();

/**
 * Mutations are serialised: two concurrent writes would otherwise both read the same
 * snapshot and the second one would silently overwrite the first.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** The full application state, filtered for the signed-in account. */
apiRouter.get('/state', requireAuth, requirePasswordChanged, async (req, res) => {
  const state = await loadState();
  setCachedState(state);
  res.json({ state: projectState(state, req.user!) });
});

/**
 * The list of active user accounts.
 *
 * Management needs this to populate owner and approver pickers (a manager, a payroll
 * manager, a leave approver). Employees never need it, so the endpoint is management-only.
 */
apiRouter.get('/accounts', requireAuth, requirePasswordChanged, requireRole('management'), async (_req, res) => {
  const accounts = await UserModel.find({ active: true })
    .select({ name: 1, email: 1, role: 1, title: 1, employeeId: 1, canManagePayroll: 1, workFromHome: 1 })
    .sort({ name: 1 })
    .lean();
  res.json({
    accounts: accounts.map((a: any) => ({
      id: a._id,
      name: a.name,
      email: a.email,
      role: a.role,
      title: a.title ?? '',
      employeeId: a.employeeId ?? undefined,
      canManagePayroll: !!a.canManagePayroll,
      workFromHome: !!a.workFromHome
    }))
  });
});

/**
 * Helper: validate an IST date key `yyyy-MM-dd` and return its boundaries.
 */
function istDateBounds(dateKey: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return {
    start: new Date(Date.UTC(y, mo, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, mo, d, 23, 59, 59, 999))
  };
}

/**
 * Helper: month boundaries for an IST `yyyy-mm` key.
 */
function istMonthBounds(monthKey: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1;
  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  if (first.getFullYear() !== y || first.getMonth() !== mo) return null;
  return {
    start: new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, mo, last.getDate(), 23, 59, 59, 999))
  };
}

/**
 * GET /api/wfh-history
 * Filtered WFH history records. Management sees all; employees see only their own.
 * Query: month (yyyy-mm), employeeId, teamId
 */
apiRouter.get('/wfh-history', requireAuth, requirePasswordChanged, async (req, res) => {
  const caller = req.user!;
  const isManager = caller.role === 'management';
  const callerEmpId = caller.employeeId ?? caller.id;

  const monthRaw = req.query?.month;
  const month = monthRaw == null ? '' : (Array.isArray(monthRaw) ? String(monthRaw[0]) : String(monthRaw));
  const employeeIdRaw = req.query?.employeeId;
  const employeeId = employeeIdRaw == null ? '' : (Array.isArray(employeeIdRaw) ? String(employeeIdRaw[0]) : String(employeeIdRaw));
  const teamIdRaw = req.query?.teamId;
  const teamId = teamIdRaw == null ? '' : (Array.isArray(teamIdRaw) ? String(teamIdRaw[0]) : String(teamIdRaw));

  const monthBounds = month ? istMonthBounds(month) : null;
  if (month && !monthBounds) {
    res.status(400).json({ error: 'Invalid month. Use yyyy-mm.' });
    return;
  }

  // Employees may only query their own history.
  if (!isManager && employeeId && employeeId !== callerEmpId) {
    res.status(403).json({ error: 'You may only view your own WFH history.' });
    return;
  }

  const filter: Record<string, any> = {};
  if (monthBounds) {
    filter.declaredAt = { $gte: monthBounds.start, $lte: monthBounds.end };
  }
  if (employeeId) filter.employeeId = employeeId;
  else if (!isManager) filter.employeeId = callerEmpId;

  const records = await WfhHistoryModel.find(filter)
    .sort({ declaredAt: -1 })
    .lean();

  let result = records.map((r: any) => ({
    id: r._id,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    date: r.date,
    workFromHome: r.workFromHome,
    declaredAt: r.declaredAt ? new Date(r.declaredAt).toISOString() : '',
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
    source: r.source,
    correctionReason: r.correctionReason ?? undefined,
    correctedBy: r.correctedBy ?? undefined,
    correctedAt: r.correctedAt ? new Date(r.correctedAt).toISOString() : undefined,
    previousValue: r.previousValue ?? undefined,
    originalRecordId: r.originalRecordId ?? undefined,
    isLatest: r.isLatest
  }));

  // Team filter requires joining against employees.
  if (teamId) {
    const employees = await EmployeeModel.find({ teamId }).select({ _id: 1 }).lean();
    const empIds = new Set(employees.map((e) => e._id));
    result = result.filter((r) => empIds.has(r.employeeId));
  }

  res.json({ wfhHistory: result });
});

/**
 * GET /api/wfh-history/summary
 * Monthly WFH summary per employee (distinct dates where the latest status is WFH).
 * Query: month (yyyy-mm), teamId
 */
apiRouter.get('/wfh-history/summary', requireAuth, requirePasswordChanged, async (req, res) => {
  const caller = req.user!;
  const isManager = caller.role === 'management';
  const callerEmpId = caller.employeeId ?? caller.id;

  const monthRaw = req.query?.month;
  const month = monthRaw == null ? '' : (Array.isArray(monthRaw) ? String(monthRaw[0]) : String(monthRaw));
  const teamIdRaw = req.query?.teamId;
  const teamId = teamIdRaw == null ? '' : (Array.isArray(teamIdRaw) ? String(teamIdRaw[0]) : String(teamIdRaw));

  const monthBounds = month ? istMonthBounds(month) : null;
  if (month && !monthBounds) {
    res.status(400).json({ error: 'Invalid month. Use yyyy-mm.' });
    return;
  }

  if (!isManager && callerEmpId) {
    // Employees only see their own summary.
  }

  // Effective records: latest per (employeeId, date) within the month.
  const filter: Record<string, any> = { isLatest: true };
  if (monthBounds) filter.declaredAt = { $gte: monthBounds.start, $lte: monthBounds.end };

  const records = await WfhHistoryModel.find(filter).sort({ employeeId: 1, date: 1 }).lean();

  // If team filter, restrict to employees in that team.
  let teamEmpIds: Set<string> | null = null;
  if (teamId) {
    const employees = await EmployeeModel.find({ teamId }).select({ _id: 1 }).lean();
    teamEmpIds = new Set(employees.map((e) => e._id));
  }

  // Build employee name map.
  const allEmpIds = new Set(records.map((r) => r.employeeId));
  const employees = await EmployeeModel.find({ _id: { $in: Array.from(allEmpIds) } }).select({ _id: 1, name: 1, teamId: 1 }).lean();
  const empMap = new Map(employees.map((e) => [e._id, { name: e.name, teamId: e.teamId }]));

  // Aggregate per employee: count distinct dates where workFromHome === true.
  // Use Set for dates to prevent double-counting if duplicate isLatest records exist.
  const perEmp = new Map<string, { name: string; teamId?: string; wfhDays: number; dates: Set<string> }>();
  for (const r of records as any[]) {
    if (!isManager && r.employeeId !== callerEmpId) continue;
    if (teamEmpIds && !teamEmpIds.has(r.employeeId)) continue;
    const emp = empMap.get(r.employeeId);
    if (!emp) continue;
    const key = r.employeeId;
    if (!perEmp.has(key)) {
      perEmp.set(key, { name: emp.name, teamId: emp.teamId ?? '', wfhDays: 0, dates: new Set() });
    }
    if (r.workFromHome === true) {
      perEmp.get(key)!.dates.add(r.date);
    }
  }

  const summary = Array.from(perEmp.entries()).map(([employeeId, v]) => {
    const dates = Array.from(v.dates).sort();
    return {
      employeeId,
      name: v.name,
      teamId: v.teamId ?? '',
      wfhDays: dates.length,
      wfhDates: dates
    };
  }).sort((a, b) => b.wfhDays - a.wfhDays || a.name.localeCompare(b.name));

  res.json({ summary, month });
});

/**
 * GET /api/wfh-history/export
 * Excel export of WFH history respecting month, employee and team filters.
 */
apiRouter.get('/wfh-history/export', requireAuth, requirePasswordChanged, async (req, res) => {
  const caller = req.user!;
  const isManager = caller.role === 'management';
  const callerEmpId = caller.employeeId ?? caller.id;

  const monthRaw = req.query?.month;
  const month = monthRaw == null ? '' : (Array.isArray(monthRaw) ? String(monthRaw[0]) : String(monthRaw));
  const employeeIdRaw = req.query?.employeeId;
  const employeeId = employeeIdRaw == null ? '' : (Array.isArray(employeeIdRaw) ? String(employeeIdRaw[0]) : String(employeeIdRaw));
  const teamIdRaw = req.query?.teamId;
  const teamId = teamIdRaw == null ? '' : (Array.isArray(teamIdRaw) ? String(teamIdRaw[0]) : String(teamIdRaw));

  const monthBounds = month ? istMonthBounds(month) : null;
  if (month && !monthBounds) {
    res.status(400).json({ error: 'Invalid month. Use yyyy-mm.' });
    return;
  }

  if (!isManager && employeeId && employeeId !== callerEmpId) {
    res.status(403).json({ error: 'You may only export your own WFH history.' });
    return;
  }

  const filter: Record<string, any> = { isLatest: true };
  if (monthBounds) filter.declaredAt = { $gte: monthBounds.start, $lte: monthBounds.end };
  if (employeeId) filter.employeeId = employeeId;
  else if (!isManager) filter.employeeId = callerEmpId;

  const records = await WfhHistoryModel.find(filter).sort({ employeeId: 1, date: 1 }).lean();

  let teamEmpIds: Set<string> | null = null;
  if (teamId) {
    const employees = await EmployeeModel.find({ teamId }).select({ _id: 1 }).lean();
    teamEmpIds = new Set(employees.map((e) => e._id));
  }

  const allEmpIds = new Set(records.map((r) => r.employeeId));
  const employees = await EmployeeModel.find({ _id: { $in: Array.from(allEmpIds) } }).select({ _id: 1, name: 1, teamId: 1 }).lean();
  const empMap = new Map(employees.map((e) => [e._id, { name: e.name, teamId: e.teamId }]));

  // ---------- Sheet 1: Monthly Summary ----------
  const summaryRows: any[] = [];
  const perEmp = new Map<string, { name: string; teamId?: string; wfhDays: number; dates: Set<string> }>();
  for (const r of records as any[]) {
    if (!isManager && r.employeeId !== callerEmpId) continue;
    if (teamEmpIds && !teamEmpIds.has(r.employeeId)) continue;
    const emp = empMap.get(r.employeeId);
    if (!emp) continue;
    const key = r.employeeId;
    if (!perEmp.has(key)) perEmp.set(key, { name: emp.name, teamId: emp.teamId ?? '', wfhDays: 0, dates: new Set() });
    if (r.workFromHome === true) {
      perEmp.get(key)!.dates.add(r.date);
    }
  }
  for (const [employeeId, v] of perEmp.entries()) {
    const dates = Array.from(v.dates).sort();
    summaryRows.push({
      'Employee Name': v.name,
      'Employee ID': employeeId,
      Team: v.teamId ?? '',
      'Total WFH Days': dates.length,
      'WFH Dates': dates.join(', ')
    });
  }
  summaryRows.sort((a, b) => Number(b['Total WFH Days']) - Number(a['Total WFH Days']) || String(a['Employee Name']).localeCompare(String(b['Employee Name'])));

  // ---------- Sheet 2: Detailed History ----------
  const detailRows: any[] = [];
  for (const r of records as any[]) {
    if (!isManager && r.employeeId !== callerEmpId) continue;
    if (teamEmpIds && !teamEmpIds.has(r.employeeId)) continue;
    const emp = empMap.get(r.employeeId);
    if (!emp) continue;
    detailRows.push({
      'Employee': emp.name,
      'Date': r.date,
      'Effective WFH Status': r.workFromHome === true ? 'WFH' : 'Office',
      'Original Declaration': r.previousValue === undefined ? '—' : (r.previousValue === true ? 'WFH' : 'Office'),
      'Correction Details': r.correctionReason ?? '—',
      'Declared At': r.declaredAt ? new Date(r.declaredAt).toISOString() : '',
      'Corrected By': r.correctedBy ?? '—'
    });
  }

  // ---------- Sheet 3: Audit History ----------
  const auditRows: any[] = [];
  for (const r of records as any[]) {
    if (r.source !== 'management_correction') continue;
    if (!isManager && r.employeeId !== callerEmpId) continue;
    if (teamEmpIds && !teamEmpIds.has(r.employeeId)) continue;
    const emp = empMap.get(r.employeeId);
    if (!emp) continue;
    auditRows.push({
      'Employee': emp.name,
      'Date': r.date,
      'Original Value': r.previousValue === undefined ? '—' : (r.previousValue === true ? 'WFH' : 'Office'),
      'New Value': r.workFromHome === true ? 'WFH' : 'Office',
      'Correction Reason': r.correctionReason ?? '—',
      'Corrected By': r.correctedBy ?? '—',
      'Corrected At': r.correctedAt ? new Date(r.correctedAt).toISOString() : ''
    });
  }

  const wb = XLSX.utils.book_new();
  wb.SheetNames.push('Monthly Summary', 'Detailed History', 'Audit History');
  wb.Sheets['Monthly Summary'] = XLSX.utils.json_to_sheet(summaryRows);
  wb.Sheets['Detailed History'] = XLSX.utils.json_to_sheet(detailRows);
  wb.Sheets['Audit History'] = XLSX.utils.json_to_sheet(auditRows);

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  const fileName = `WFH-History${month ? '_' + month : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
});

/**
 * GET /api/wfh-history/:employeeId
 * Full WFH history for one employee. Management sees any employee; employees see only themselves.
 */
apiRouter.get('/wfh-history/:employeeId', requireAuth, requirePasswordChanged, async (req, res) => {
  const caller = req.user!;
  const isManager = caller.role === 'management';
  const callerEmpId = caller.employeeId ?? caller.id;
  const targetEmpId = String(req.params.employeeId);

  if (!isManager && targetEmpId !== callerEmpId) {
    res.status(403).json({ error: 'You may only view your own WFH history.' });
    return;
  }

  const records = await WfhHistoryModel.find({ employeeId: targetEmpId })
    .sort({ date: -1, declaredAt: -1 })
    .lean();

  res.json({
    employeeId: targetEmpId,
    history: records.map((r: any) => ({
      id: r._id,
      date: r.date,
      workFromHome: r.workFromHome,
      declaredAt: r.declaredAt ? new Date(r.declaredAt).toISOString() : '',
      source: r.source,
      correctionReason: r.correctionReason ?? undefined,
      correctedBy: r.correctedBy ?? undefined,
      correctedAt: r.correctedAt ? new Date(r.correctedAt).toISOString() : undefined,
      previousValue: r.previousValue ?? undefined,
      originalRecordId: r.originalRecordId ?? undefined,
      isLatest: r.isLatest
    }))
  });
});

/**
 * POST /api/wfh-history/:employeeId/:date/correct
 * Management-only correction. Preserves the original record, inserts a superseding record.
 */
apiRouter.post('/wfh-history/:employeeId/:date/correct', requireAuth, requirePasswordChanged, requireRole('management'), async (req, res) => {
  const actor = req.user!;
  const targetEmpId = String(req.params.employeeId);
  const dateKey = String(req.params.date);
  const { workFromHome, reason } = req.body as { workFromHome?: boolean; reason?: string };

  if (!istDateBounds(dateKey)) {
    res.status(400).json({ error: 'Invalid date. Use yyyy-MM-dd.' });
    return;
  }
  if (typeof workFromHome !== 'boolean') {
    res.status(400).json({ error: 'workFromHome must be a boolean.' });
    return;
  }
  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'A correction reason is required.' });
    return;
  }

  const now = new Date();

  // Verify the employee exists.
  const employee = await EmployeeModel.findOne({ _id: targetEmpId }).select({ name: 1 }).lean();
  if (!employee) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  // Find the current latest record for this employee/date.
  const current = await WfhHistoryModel.findOne({ employeeId: targetEmpId, date: dateKey, isLatest: true }).lean();

  // If nothing exists yet, create the first record (no previous value).
  if (!current) {
    await WfhHistoryModel.create({
      _id: `wfh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      employeeId: targetEmpId,
      employeeName: employee.name,
      date: dateKey,
      workFromHome,
      declaredAt: now,
      createdAt: now,
      updatedAt: now,
      source: 'management_correction',
      correctionReason: reason.trim(),
      correctedBy: actor.name,
      correctedAt: now,
      isLatest: true
    });
    invalidateCache();
    res.json({ ok: true });
    return;
  }

  // Supersede the current latest record.
  await WfhHistoryModel.updateOne({ _id: current._id }, { $set: { isLatest: false, updatedAt: now } });

  await WfhHistoryModel.create({
    _id: `wfh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeId: targetEmpId,
    employeeName: employee.name,
    date: dateKey,
    workFromHome,
    declaredAt: now,
    createdAt: now,
    updatedAt: now,
    source: 'management_correction',
    correctionReason: reason.trim(),
    correctedBy: actor.name,
    correctedAt: now,
    previousValue: current.workFromHome,
    originalRecordId: current._id,
    isLatest: true
  });
  invalidateCache();
  res.json({ ok: true });
});

/**
 * Generate and download a payslip PDF using Playwright Chromium.
 *
 * Renders the actual payslip preview page (PayslipPrintPage) through a real
 * browser engine so the PDF output is pixel-identical to what the user sees
 * on screen. Always produces exactly one A4 page.
 *
 * Performance:
 *   - Reuses a single warm Chromium instance across requests (2-4s per PDF).
 *   - Waits only for .print-area content (domcontentloaded), not networkidle.
 *   - Each request gets its own incognito context for isolation.
 */
apiRouter.get('/payslip/download/:id', requireAuth, requirePasswordChanged, async (req, res) => {
  const payslipId = String(req.params.id);

  const payslip = await PayslipModel.findById(payslipId).lean();
  if (!payslip) {
    res.status(404).json({ error: 'Payslip not found.' });
    return;
  }

  // Access control: management can see all payslips; employees only their own.
  if (req.user!.role !== 'management' && payslip.employeeId !== req.user!.employeeId) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  // Standalone print route. It sits outside the role guards and the app shell, so
  // the renderer never depends on an authenticated SPA session or a redirect.
  //
  // Candidate origins: the API's own origin first (this server also serves the
  // built client, so that copy always matches the running server build), then
  // the configured client origin as a fallback. A loopback *configured* origin
  // is dropped in production because a headless browser inside the container
  // cannot reach the developer machine. The self origin is always kept: it is
  // reachable from the container by definition.
  const selfOrigin = `${req.protocol}://${req.get('host') ?? req.headers.host ?? `localhost:${config.port}`}`;
  const isLoopback = (origin: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin);
  const configuredOrigins = config.clientOrigins
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ''))
    .filter((origin) => !(config.isProduction && isLoopback(origin)));
  const printOrigins = [...new Set([selfOrigin.replace(/\/$/, ''), ...configuredOrigins])];

  // Extract the session cookie so page requests still carry the caller's session.
  const sessionCookie = req.cookies?.[config.cookieName];

  try {
    const pdfBuffer = await withPdfBrowser(async (context) => {
      if (sessionCookie) {
        // Mirror the exact attributes the API uses when it issues this cookie.
        // Playwright defaults to SameSite=Lax + Secure=false, which browsers drop
        // on cross-site requests and which does not match the real session cookie.
        await context.addCookies(printOrigins.map((origin) => ({
          name: config.cookieName,
          value: sessionCookie,
          url: origin,
          httpOnly: true,
          secure: config.isProduction,
          sameSite: (config.isProduction ? 'None' : 'Lax') as 'None' | 'Lax'
        })));
      }

      // Hand the already-authorised payslip payload to every page in this context
      // before the app boots. The print route renders it directly, so PDF
      // generation no longer depends on cookie propagation.
      const payload = JSON.parse(JSON.stringify({
        id: payslipId,
        employeeId: payslip.employeeId,
        month: payslip.month,
        version: payslip.version,
        status: payslip.status,
        revisionReason: payslip.revisionReason,
        data: payslip.data
      }));
      await context.addInitScript((data) => {
        (window as unknown as { __WF_PAYSLIP__?: unknown }).__WF_PAYSLIP__ = data;
      }, payload);

      // Try each candidate origin and keep the first one that actually renders
      // the payslip. A failed navigation leaves the page on chrome-error://, so
      // each attempt gets its own page.
      let lastError: unknown = null;
      for (const origin of printOrigins) {
        const page: Page = await context.newPage();
        // A4 width at 96 DPI (794×1123px) so Tailwind `sm:` breakpoints apply.
        await page.setViewportSize({ width: 794, height: 1123 });
        // Emulate print media so @media print CSS is applied.
        await page.emulateMedia({ media: 'print' });
        try {
          await page.goto(`${origin}/payslip/print/${payslipId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });

          // Wait for the payslip document to render (not the loading spinner).
          await page.waitForSelector('.print-area', { timeout: 15000 });

          // Wait for all fonts to load so Chromium doesn't substitute fallback
          // fonts. This keeps the PDF's weights identical to the preview.
          await page.evaluate(() => document.fonts.ready.then(() => true));

          // Additional wait to ensure all React rendering and CSS is complete.
          await page.waitForTimeout(300);

          // Page margins live in the print stylesheet's @page rule (20mm top /
          // 12mm elsewhere). Passing margins here as well is ignored while
          // preferCSSPageSize is true and risks double-applying them later, so
          // the CSS rule is the single source of truth.
          return await page.pdf({
            format: 'A4',
            landscape: false,
            printBackground: true,
            preferCSSPageSize: true,
          });
        } catch (error) {
          lastError = error;
          // Diagnostic context without employee, salary or session data.
          const diag = await page.evaluate(() => ({
            title: document.title,
            hasInjectedPayload: Boolean((window as unknown as { __WF_PAYSLIP__?: unknown }).__WF_PAYSLIP__),
            bodyTextLength: document.body?.innerText?.length ?? 0,
            path: location.pathname
          })).catch(() => null);
          console.warn('[payslip/download] print origin failed', JSON.stringify({
            host: new URL(origin).host,
            error: error instanceof Error ? error.message.slice(0, 140) : String(error).slice(0, 140),
            ...diag
          }));
        } finally {
          await page.close().catch(() => {});
        }
      }
      throw lastError ?? new Error('No print origin rendered the payslip');
    });

    // Validate that we got a valid PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    // Verify it starts with PDF magic bytes
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      throw new Error(`Generated PDF is invalid (missing PDF header, got: "${pdfHeader}")`);
    }

    if (pdfBuffer.length < 1000) {
      throw new Error(`Generated PDF is suspiciously small (${pdfBuffer.length} bytes)`);
    }

    const label = monthLabel(payslip.month);
    const [monthName, year] = label.split(' ');
    const safeName = String(payslip.data.employee.name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const safeMonth = (monthName ?? '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const safeYear = (year ?? '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const fileName = `${safeName}_${safeMonth}_${safeYear}.pdf`;

    console.log(`[payslip/download] Generated PDF for ${payslipId}: ${pdfBuffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[payslip/download] PDF generation failed:', errMsg);
    // Include the underlying error message so production debugging is possible.
    res.status(500).json({ error: `Failed to generate payslip PDF: ${errMsg}` });
  }
});

/**
 * Some commands also change the sign-in accounts: creating an employee provisions the
 * account they use to sign in, and deactivating one disables that account.
 */
async function applyAccountSideEffects(
  op: string,
  args: Record<string, unknown>,
  before: AppState,
  after: AppState
): Promise<{ credentials?: Credentials }> {
  if (op === 'employee.save') {
    const employee = args.employee as Employee | undefined;
    if (!employee) return {};
    const isNew = !before.employees.some((e) => e.id === employee.id);
    const { password } = await provisionEmployeeAccount(employee, isNew);
    if (!password) return {};
    return { credentials: { email: employee.email.trim().toLowerCase(), password } };
  }
  if (op === 'employee.resetPassword') {
    const id = String(args.employeeId ?? '');
    const employee = after.employees.find((e) => e.id === id);
    if (!employee || !employee.email.trim()) return {};
    const password = await resetEmployeePassword(employee);
    return { credentials: { email: employee.email.trim().toLowerCase(), password } };
  }
  if (op === 'employee.setStatus') {
    const id = String(args.id ?? '');
    const employee = after.employees.find((e) => e.id === id);
    if (employee) await setEmployeeAccountActive(employee, employee.status === 'Active');
  }
  return {};
}

/**
 * Apply one command. The server owns the rules, the permissions and the MongoDB write; the
 * browser only states what the user asked for.
 */
apiRouter.post('/state/mutate', requireAuth, requirePasswordChanged, async (req, res) => {
  const op = String(req.body?.op ?? '');
  const args = (req.body?.args ?? {}) as Record<string, unknown>;
  if (!op) {
    res.status(400).json({ error: 'No operation was supplied.' });
    return;
  }

  try {
    type Outcome = { error: string } | { state: AppState; credentials?: Credentials };
    const outcome = await serialise<Outcome>(async () => {
      const current = await ensureLoaded();
      const result = runCommand(op, { state: current, user: req.user!, actor: req.user!.name, now: Date.now() }, args);
      if ('error' in result) return { error: result.error };
      await persistDiff(current, result);
      setCachedState(result);
      const sideEffects = await applyAccountSideEffects(op, args, current, result);
      return { state: result, ...sideEffects };
    });

    if ('error' in outcome) {
      res.status(400).json({ error: outcome.error });
      return;
    }
    res.json({
      state: projectState(outcome.state, req.user!),
      ...(outcome.credentials ? { credentials: outcome.credentials } : {})
    });
  } catch (err) {
    console.error('[mutate] failed', op, err);
    res.status(500).json({ error: 'The change could not be saved. Please try again.' });
  }
});