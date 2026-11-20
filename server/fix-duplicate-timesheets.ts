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

function isUntouchedAuto(ts: Ts): boolean {
  const history = ts.history ?? [];
  return ts.status === 'Submitted' && history.length === 1 && history[0]?.action === AUTO_ACTION && history[0]?.by === 'System';
}

function createdAt(ts: Ts): string {
  return ts.history?.[0]?.at ?? ts.submittedAt ?? '';
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

  const toDelete: Ts[] = [];
  const manualReview: Array<{ key: string; group: Ts[] }> = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group);
    const extras = group.filter((t) => t._id !== keeper._id);
    const deletable = extras.filter(isUntouchedAuto);
    const notDeletable = extras.filter((t) => !isUntouchedAuto(t));
    toDelete.push(...deletable);

    console.log(`\n${key}  (${group.length} timesheets)`);
    console.log(`  KEEP    ${keeper._id}  ${keeper.status}  history=${keeper.history?.length ?? 0}`);
    for (const t of deletable) console.log(`  DELETE  ${t._id}  ${t.status}  (untouched auto-submit, ${createdAt(t)})`);
    for (const t of notDeletable) console.log(`  REVIEW  ${t._id}  ${t.status}  history=${t.history?.length ?? 0}  (not auto-created, left as is)`);
    if (notDeletable.length) manualReview.push({ key, group });
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
