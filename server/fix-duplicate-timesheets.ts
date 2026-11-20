/**
 * One-off cleanup: remove duplicate timesheets created by the auto-submit cron.
 *
 * Before the fix in cron/autoSubmitTimesheets.ts, every server start created a new
 * "Submitted" timesheet for each employee-week whose timesheet was already
 * Submitted/Approved. This finds every employee-week with more than one timesheet and:
 *
 *   - KEEPS one per week: a manually handled timesheet if there is one (highest status,
 *     then longest history), otherwise the oldest auto-created one.
 *   - DELETES only the extra copies that are untouched auto-submissions
 *     (status Submitted, a single "Auto-submitted by system" history entry).
 *   - REPORTS anything else for manual review and never deletes it.
 *
 * Add --verbose to list every timesheet id.
 *
 * Dry run by default (changes nothing):
 *   node ./node_modules/tsx/dist/cli.mjs server/fix-duplicate-timesheets.ts
 * Apply:
 *   node ./node_modules/tsx/dist/cli.mjs server/fix-duplicate-timesheets.ts --apply
 *
 * Uses MONGODB_URI from the environment / .env.
 */
import { connectDatabase, disconnectDatabase } from './db';
import { TimesheetModel } from './models';

const AUTO_ACTION = 'Auto-submitted by system (week ended)';
const STATUS_RANK: Record<string, number> = {
  Approved: 5,
  'Under Review': 4,
  'Changes Requested': 3,
  Submitted: 2,
  Draft: 1
};

type Ts = { _id: string; employeeId: string; weekStart: string; status: string; submittedAt?: string; history?: any[] };

/**
 * An auto-submit history entry in either format the cron has written:
 *   since 2026-11-16 (583ec57): { action, by: 'System', at }
 *   2026-11-01 → 11-16 (6c8ee3b): { message, actorId: 'system', createdAt }
 */
function isAutoEntry(entry: any): boolean {
  if (!entry) return false;
  const newFormat = entry.action === AUTO_ACTION && entry.by === 'System';
  const oldFormat = entry.message === AUTO_ACTION && entry.actorId === 'system';
  return newFormat || oldFormat;
}

function isUntouchedAuto(ts: Ts): boolean {
  const history = ts.history ?? [];
  return ts.status === 'Submitted' && history.length === 1 && isAutoEntry(history[0]);
}

function createdAt(ts: Ts): string {
  const first = ts.history?.[0];
  return first?.at ?? first?.createdAt ?? ts.submittedAt ?? '';
}

/** Manual timesheets first (best status, then most history), then the oldest. */
function pickKeeper(group: Ts[]): Ts {
  return [...group].sort((a, b) => {
    const autoA = isUntouchedAuto(a) ? 1 : 0;
    const autoB = isUntouchedAuto(b) ? 1 : 0;
    if (autoA !== autoB) return autoA - autoB;
    const rank = (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0);
    if (rank !== 0) return rank;
    const hist = (b.history?.length ?? 0) - (a.history?.length ?? 0);
    if (hist !== 0) return hist;
    return createdAt(a).localeCompare(createdAt(b));
  })[0];
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectDatabase();

  const all = (await TimesheetModel.find({}).lean()) as unknown as Ts[];
  const groups = new Map<string, Ts[]>();
  for (const ts of all) {
    const key = `${ts.employeeId}|${ts.weekStart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ts);
  }

  const verbose = process.argv.includes('--verbose');
  const toDelete: Ts[] = [];
  const manualReview: Array<{ key: string; group: Ts[] }> = [];
  /** How the REVIEW rows were created, so unknown auto-submit variants can be spotted. */
  const reviewSignatures = new Map<string, { count: number; example: Ts }>();
  const signature = (t: Ts) => {
    const first = t.history?.[0];
    return `status=${t.status} | history=${t.history?.length ?? 0} | by=${first?.by ?? first?.actorId ?? '-'} | action=${first?.action ?? first?.message ?? '-'}`;
  };

  console.log('\nEMPLOYEE|WEEK                     TOTAL  KEEP  DELETE  REVIEW');
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group);
    const extras = group.filter((t) => t._id !== keeper._id);
    const deletable = extras.filter(isUntouchedAuto);
    const notDeletable = extras.filter((t) => !isUntouchedAuto(t));
    toDelete.push(...deletable);
    for (const t of notDeletable) {
      const sig = signature(t);
      const entry = reviewSignatures.get(sig);
      if (entry) entry.count++;
      else reviewSignatures.set(sig, { count: 1, example: t });
    }

    console.log(`${key.padEnd(34)} ${String(group.length).padStart(5)}  ${'1'.padStart(4)}  ${String(deletable.length).padStart(6)}  ${String(notDeletable.length).padStart(6)}   keep=${keeper._id} (${signature(keeper)})`);
    if (verbose) {
      for (const t of deletable) console.log(`    DELETE  ${t._id}  (untouched auto-submit, ${createdAt(t)})`);
      for (const t of notDeletable) console.log(`    REVIEW  ${t._id}  ${signature(t)}`);
    }
    if (notDeletable.length) manualReview.push({ key, group });
  }

  if (reviewSignatures.size) {
    console.log('\nREVIEW rows grouped by how they were created (left untouched):');
    for (const [sig, { count, example }] of [...reviewSignatures].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${String(count).padStart(5)} x  ${sig}`);
      console.log(`         e.g. ${example._id}  at=${example.history?.[0]?.at ?? '-'}  submittedAt=${example.submittedAt ?? '-'}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Timesheets total:          ${all.length}`);
  console.log(`Employee-weeks with dupes: ${[...groups.values()].filter((g) => g.length > 1).length}`);
  console.log(`To delete:                 ${toDelete.length}`);
  console.log(`Need manual review:        ${manualReview.length}`);

  if (!apply) {
    console.log('\nDRY RUN: nothing was changed. Re-run with --apply to delete the rows marked DELETE.');
  } else if (toDelete.length) {
    const result = await TimesheetModel.deleteMany({ _id: { $in: toDelete.map((t) => t._id) } });
    console.log(`\nDeleted ${result.deletedCount} duplicate timesheet(s).`);
  } else {
    console.log('\nNothing to delete.');
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[fix-duplicate-timesheets] failed:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
