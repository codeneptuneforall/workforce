import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, Employee, Project, Result, Task, Team } from '@shared/types';
import { complianceCtx } from '@shared/domain/compliance';
import type { ComplianceCtx } from '@shared/domain/compliance';
import { ApiError, api } from '../api/client';
import type { Command } from '../utils/commands';
import { useAuth } from './AuthContext';

interface DataValue {
  state: AppState;
  ctx: ComplianceCtx;
  actor: string;
  /** Sessions that were already running when this browser session started. */
  restoredSessionIds: string[];
  loading: boolean;
  loadError: string | null;
  run: (command: Command) => Promise<Result>;
  refresh: () => Promise<boolean>;
  employee: (id?: string) => Employee | undefined;
  project: (id?: string) => Project | undefined;
  task: (id?: string) => Task | undefined;
  team: (id?: string) => Team | undefined;
  personName: (id?: string) => string;
}

const DataContext = createContext<DataValue | null>(null);

/** How often the client re-reads the authoritative state from the server. */
const POLL_INTERVAL_MS = 15000;

/** Structural comparison that ignores object key order. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual(ao[k], bo[k]));
}

/**
 * Keeps the identity of the parts of the state that did not change.
 *
 * The server rebuilds the whole state on every request, so a fresh object would be a
 * different reference on every poll. Forms that mirror a slice of the state (the
 * settings form, the timesheet drawer) re-seed themselves from it in an effect, and a
 * new reference would wipe what the user is typing. Reusing the previous reference for
 * unchanged slices keeps those effects from firing.
 */
function reconcile(previous: AppState, next: AppState): AppState {
  const result = { ...next } as AppState;
  const target = result as unknown as Record<string, unknown>;
  const source = previous as unknown as Record<string, unknown>;
  let changed = false;
  for (const key of Object.keys(next) as (keyof AppState)[]) {
    if (deepEqual(source[key], target[key])) {
      target[key] = source[key];
    } else {
      changed = true;
    }
  }
  return changed ? result : previous;
}

const EMPTY_STATE: AppState = {
  version: 0,
  employees: [],
  teams: [],
  projects: [],
  tasks: [],
  sessions: [],
  timesheets: [],
  reviews: {},
  leaves: [],
  holidays: [],
  salary: [],
  payrollRuns: [],
  payslips: [],
  notifications: [],
  audit: [],
  settings: {
    companyName: '',
    companyAddress: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata (IST)',
    confidentialityNote: '',
    dailyTargetMinutes: 480,
    dayEndTime: '23:59',
    workingDays: [1, 2, 3, 4, 5],
    workingSaturdays: [1, 3],
    allowOverlap: false,
    requireTask: true,
    generalCategory: false,
    approachingWarningMinutes: 30,
    timesheetApprovalRequired: true,
    correctionPolicy: '',
    absentPolicy: 'not_recorded',
    deductionEnabled: false,
    deductionMethod: 'not_configured',
    payrollBasis: 'not_configured',
    fixedBasisDays: null,
    rounding: 'nearest_rupee',
    showDeductionToEmployee: false,
    casualAdvanceDays: 5,
    casualAllowance: null,
    emergencyRetrospective: true,
    leaveYearStartMonth: 1,
    casualTreatment: 'not_configured',
    emergencyTreatment: 'not_configured',
    carryForward: '',
    cancellationPolicy: '',
    leaveApprover: '',
    attachmentsEnabled: true,
    releaseRequiresCredit: true
  }
};

export function DataProvider({ children }: {children: React.ReactNode;}) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoredSessionIds, setRestoredSessionIds] = useState<string[]>([]);
  const restoredCaptured = useRef(false);
  const { user, expire } = useAuth();

  /**
   * The account the state in memory belongs to.
   *
   * The state is scoped to the signed-in account, so it may only be used once it has
   * been read for that account. Comparing the ids during render (instead of flipping a
   * flag in an effect) means a page never sees a stale or empty state.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const needsData = !!user && !user.mustChangePassword;
  const loading = needsData && loadedFor !== user!.id && !loadError;

  /** Loads the authoritative state for the signed-in account. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.state();
      setState((prev) => reconcile(prev, res.state));
      setLoadError(null);
      if (!restoredCaptured.current) {
        // A session that was already running when the page loaded was restored from the
        // server, so its elapsed time is measured from the saved start timestamp.
        restoredCaptured.current = true;
        setRestoredSessionIds(
          res.state.sessions.filter((s) => s.status === 'Working').map((s) => s.id)
        );
      }
      return true;
    } catch (err) {
      // A rejected session is not a loading problem: the account has to sign in again.
      // Keeping the page on a "your data could not be loaded" card would leave the user
      // staring at a dead end while the poller keeps asking for data that never arrives.
      if (err instanceof ApiError && err.status === 401) {
        setState(EMPTY_STATE);
        setLoadError(null);
        expire();
        return false;
      }
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your data.');
      return false;
    }
  }, [expire]);

  // A different account means a different state: forget what was restored for the
  // previous one and read the state that belongs to the new account.
  useEffect(() => {
    restoredCaptured.current = false;
    setRestoredSessionIds([]);
    setLoadedFor(null);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!needsData || !user) return;
    (async () => {
      const ok = await refresh();
      if (active && ok) setLoadedFor(user.id);
    })();
    return () => {
      active = false;
    };
  }, [needsData, user, refresh]);

  /**
   * Live polling.
   *
   * Timers keep running on the server, so the management live tracker, the attendance
   * board and the running-session banners have to pick up changes made by other people
   * (or by the clock) without a manual reload.
   */
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || document.hidden) return;
      await refresh();
    };
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  /** Sends one command to the API and applies the state the server returns. */
  const run = useCallback(async (command: Command): Promise<Result> => {
    try {
      const res = await api.mutate(command.op, command.args ?? {});
      setState((prev) => reconcile(prev, res.state));
      return { ok: true, credentials: res.credentials };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState(EMPTY_STATE);
        // The session is gone, so the account has to sign in again before it can work.
        expire();
        return { ok: false, error: 'Your session has expired. Please sign in again.' };
      }
      return { ok: false, error: err instanceof ApiError ? err.message : 'The change could not be saved.' };
    }
  }, [expire]);

  const ctx = useMemo<ComplianceCtx>(() => complianceCtx(state), [state]);

  const value = useMemo<DataValue>(() => {
    const employee = (id?: string) => state.employees.find((e) => e.id === id);
    return {
      state,
      ctx,
      actor: user?.name ?? 'System',
      restoredSessionIds,
      loading,
      loadError,
      run,
      refresh,
      employee,
      project: (id) => state.projects.find((p) => p.id === id),
      task: (id) => state.tasks.find((t) => t.id === id),
      team: (id) => state.teams.find((t) => t.id === id),
      personName: (id) => employee(id)?.name ?? '—'
    };
  }, [state, ctx, user, restoredSessionIds, loading, loadError, run, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
