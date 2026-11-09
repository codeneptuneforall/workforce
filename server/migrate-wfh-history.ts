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
 * Assumes mongoose is already connected. Caller manages the connection.
 */
export async function migrateWfhHistory(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected.');

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

  console.log(`[wfh-migration] Complete: ${created} created, ${skipped} skipped, ${users.length} total.`);
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
