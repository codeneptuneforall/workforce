import { Router } from 'express';
import type { Page } from 'playwright';
import type { AppState, Credentials, Employee } from '../../shared/types';
import { projectState } from '../../shared/domain/access';
import { runCommand } from '../../shared/domain/commands';
import { provisionEmployeeAccount, resetEmployeePassword, setEmployeeAccountActive } from '../accounts';
import { requireAuth, requirePasswordChanged, requireRole } from '../auth';
import { UserModel, PayslipModel } from '../models';
import { ensureLoaded, loadState, persistDiff, setCachedState } from '../store';
import { config } from '../config';
import { withPdfBrowser } from '../pdfBrowser';
import { monthLabel } from '../../shared/domain/payroll';

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
  // Candidate origins: the configured client origin first, then the API's own
  // origin (this server also serves the built client). A loopback *configured*
  // origin is dropped in production because a headless browser inside the
  // container cannot reach the developer machine. The self origin is always
  // kept: it is reachable from the container by definition.
  const selfOrigin = `${req.protocol}://${req.get('host') ?? req.headers.host ?? `localhost:${config.port}`}`;
  const isLoopback = (origin: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(origin);
  const configuredOrigins = config.clientOrigins
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ''))
    .filter((origin) => !(config.isProduction && isLoopback(origin)));
  const printOrigins = [...new Set([...configuredOrigins, selfOrigin.replace(/\/$/, '')])];

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

          return await page.pdf({
            format: 'A4',
            landscape: false,
            margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
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