import { Router } from 'express';
import type { AppState, Credentials, Employee } from '../../shared/types';
import { projectState } from '../../shared/domain/access';
import { runCommand } from '../../shared/domain/commands';
import { provisionEmployeeAccount, resetEmployeePassword, setEmployeeAccountActive } from '../accounts';
import { requireAuth, requirePasswordChanged, requireRole } from '../auth';
import { UserModel } from '../models';
import { ensureLoaded, loadState, persistDiff, setCachedState } from '../store';

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
    .select({ name: 1, email: 1, role: 1, title: 1, employeeId: 1, canManagePayroll: 1 })
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
      canManagePayroll: !!a.canManagePayroll
    }))
  });
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
 * Apply one command. The server owns the rules, the permissions and the MongoDB write;
 * the browser only states what the user asked for.
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
