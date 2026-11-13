import mongoose from 'mongoose';
import { WfhHistoryModel } from './models';

/**
 * One-time migration: recover existing WFH declarations from User documents
 * into the new WfhHistory collection.
 *
 * Reliable evidence: users who have workFromHomeAt set. The date is derived
 * from workFromHomeAt (IST), and the status is the current workFromHome value.
 *
 * Append-only: creates new WfhHistory records with source 'historical_recovery'.
 * Does not modify existing User documents.
 *
 * Also cleans up duplicate isLatest records (same employeeId + date with
 * multiple isLatest=true) and creates a unique partial index to prevent
 * future duplicates.
 *
 * Assumes mongoose is already connected. Caller manages the connection.
 */
export async function migrateWfhHistory(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected.');

  // ── Step 1: Recover historical WFH declarations from User documents ──
  const users = await db
    .collection('users')
    .find(
      { workFromHomeAt: { $exists: true } },
      { projection: { _id: 1, name: 1, employeeId: 1, workFromHome: 1, workFromHomeAt: 1 } }
    )
    .toArray();

  console.log(`[wfh-migration] Found ${users.length} users with workFromHomeAt set.`);

  let created = 0;
  let skipped = 0;

  for (const u of users) {
    const declaredAt = new Date(u.workFromHomeAt);
    // Derive IST date key from the stored UTC date.
    const istOffset = (5 * 60 + 30) * 60 * 1000;
    const istDate = new Date(declaredAt.getTime() + istOffset);
    const dateKey = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;
    const employeeId = u.employeeId ?? u._id;

    // Skip if a historical_recovery record already exists for this employee/date.
    const existing = await WfhHistoryModel.findOne({
      employeeId,
      date: dateKey,
      source: 'historical_recovery'
    }).lean();
    if (existing) {
      console.log(`[wfh-migration] Skip ${u.name} (${employeeId}) ${dateKey}: already migrated.`);
      skipped++;
      continue;
    }

    await WfhHistoryModel.create({
      _id: `wfh-rec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      employeeId,
      employeeName: u.name,
      date: dateKey,
      workFromHome: u.workFromHome === true,
      declaredAt,
      createdAt: declaredAt,
      updatedAt: declaredAt,
      source: 'historical_recovery',
      isLatest: true
    });
    console.log(`[wfh-migration] Migrated ${u.name} (${employeeId}) ${dateKey}: WFH=${u.workFromHome === true}`);
    created++;
  }

  // ── Step 2: Clean up duplicate isLatest records ──
  // Find groups with multiple isLatest=true for same employeeId + date
  const duplicates = await db.collection('wfhhistorys').aggregate([
    { $match: { isLatest: true } },
    {
      $group: {
        _id: { employeeId: '$employeeId', date: '$date' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        declaredAts: { $push: '$declaredAt' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  let fixed = 0;
  for (const group of duplicates) {
    // Keep the most recent declaredAt as isLatest=true, supersede the rest
    const sorted = group.ids.map((id: any, i: number) => ({ id, declaredAt: group.declaredAts[i] }))
      .sort((a: any, b: any) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime());

    for (let i = 1; i < sorted.length; i++) {
      await WfhHistoryModel.updateOne(
        { _id: sorted[i].id },
        { $set: { isLatest: false, updatedAt: new Date() } }
      );
      fixed++;
    }
    console.log(
      `[wfh-migration] Dedup ${group._id.employeeId}/${group._id.date}: kept ${sorted[0].id}, superseded ${sorted.length - 1} record(s)`
    );
  }
  console.log(`[wfh-migration] Deduplication complete: ${fixed} record(s) superseded.`);

  // ── Step 3: Create unique partial index to prevent future duplicates ──
  try {
    await WfhHistoryModel.collection.createIndex(
      { employeeId: 1, date: 1 },
      { unique: true, partialFilterExpression: { isLatest: true } }
    );
    console.log('[wfh-migration] Created unique partial index on (employeeId, date) where isLatest=true');
  } catch (err: any) {
    if (err.code === 85 || err.code === 86) {
      console.log('[wfh-migration] Index already exists:', err.codeName);
    } else {
      throw err;
    }
  }

  console.log(`[wfh-migration] Complete: ${created} created, ${skipped} skipped, ${fixed} deduped, ${users.length} total.`);
}

/** Standalone CLI entry point. */
if (import.meta.url === process.argv[1] || process.argv.includes('--run-migration')) {
  (async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/workforce');
    try {
      await migrateWfhHistory();
    } finally {
      await mongoose.disconnect();
    }
  })().catch((err) => {
    console.error('[wfh-migration] Failed:', err);
    process.exit(1);
  });
}
