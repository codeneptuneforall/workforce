/**
 * One-time migration: move base64 files stored inside MongoDB into Cloudinary.
 *
 *   Profile photos   employee.photoUrl = "data:image/..."
 *                    -> <root>/profiles/<employeeId>, employee.photo = { publicId, version, format }
 *   Bug attachments  attachment.previewUrl = "data:image/..."
 *                    -> <root>/bug-tracker/<issueKey>/<attachmentId> (private),
 *                       attachment.publicId/resourceType/deliveryType/format/version
 *
 * Only the path is stored; the API builds the URLs. The base64 copy is removed from the
 * record once the file is safely in Cloudinary.
 *
 * Safe to run more than once: anything already migrated is skipped, and an upload that
 * already exists in Cloudinary is reused (overwrite is off for attachments).
 *
 * Run the NEW server code first (deploy), then this. The old code does not understand
 * the new fields.
 *
 * Dry run (reads only, uploads nothing):
 *   node ./node_modules/tsx/dist/cli.mjs server/migrate-assets-to-cloudinary.ts
 * Apply (must name the target folder, as a guard against writing to the wrong one):
 *   node ./node_modules/tsx/dist/cli.mjs server/migrate-assets-to-cloudinary.ts --apply --folder=workforce
 *
 * Uses MONGODB_URI, CLOUDINARY_URL and CLOUDINARY_FOLDER from the environment / .env.
 */
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './db';
import { BugTrackerIssueModel, EmployeeModel } from './models';
import { isStorageConfigured, uploadAttachment, uploadProfilePhoto } from './storage/cloudinary';

const apply = process.argv.includes('--apply');
const folderArg = process.argv.find((a) => a.startsWith('--folder='))?.split('=')[1];

function decodeDataUrl(value: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) return null;
  const mime = match[1] ?? 'application/octet-stream';
  const buffer = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
  return buffer.length ? { mime, buffer } : null;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

async function migratePhotos(stats: Record<string, number>) {
  const employees: any[] = await EmployeeModel.find({}, { name: 1, photoUrl: 1, photo: 1 }).lean();
  console.log(`\n── Profile photos (${employees.length} employees) ──`);
  for (const e of employees) {
    const url: string | undefined = e.photoUrl;
    const hasData = typeof url === 'string' && url.startsWith('data:image/');

    if (e.photo?.publicId) {
      if (hasData) {
        // Already migrated, but a stale base64 copy was written back: just drop it.
        console.log(`CLEANUP  ${e._id}  ${e.name}  (already in Cloudinary, removing leftover base64)`);
        stats.photoCleanup++;
        if (apply) await EmployeeModel.updateOne({ _id: e._id }, { $unset: { photoUrl: 1 } });
      } else {
        stats.photoDone++;
      }
      continue;
    }
    if (!url) { stats.photoNone++; continue; }
    if (!hasData) {
      // External link typed in the employee form, or a legacy /uploads path.
      const legacyDisk = url.startsWith('/uploads/');
      console.log(`${legacyDisk ? 'LOST    ' : 'KEEP    '} ${e._id}  ${e.name}  (${legacyDisk ? 'old disk path, file no longer exists' : 'external link, left as is'})`);
      stats[legacyDisk ? 'photoLost' : 'photoExternal']++;
      continue;
    }

    const decoded = decodeDataUrl(url);
    if (!decoded) { console.log(`FAILED   ${e._id}  ${e.name}  (unreadable data URL)`); stats.failed++; continue; }
    console.log(`MOVE     ${e._id}  ${e.name}  (${kb(decoded.buffer.length)}) -> ${config.cloudinaryFolder}/profiles/${e._id}`);
    stats.photoMove++;
    if (!apply) continue;
    try {
      const { asset } = await uploadProfilePhoto(String(e._id), decoded.buffer);
      await EmployeeModel.updateOne(
        { _id: e._id },
        { $set: { photo: { publicId: asset.publicId, version: asset.version, format: asset.format } }, $unset: { photoUrl: 1 } }
      );
    } catch (err: any) {
      console.log(`FAILED   ${e._id}  ${e.name}  (${err?.message ?? err})`);
      stats.failed++;
    }
  }
}

async function migrateAttachments(stats: Record<string, number>) {
  const issues: any[] = await BugTrackerIssueModel.find(
    { 'attachments.0': { $exists: true } },
    { key: 1, attachments: 1 }
  ).lean();
  console.log(`\n── Bug tracker attachments (${issues.length} issues with attachments) ──`);
  for (const issue of issues) {
    for (const a of issue.attachments ?? []) {
      if (a.publicId) { stats.attDone++; continue; }
      const url: string | undefined = a.previewUrl;
      if (!url || !url.startsWith('data:')) {
        // Name-only (content never stored) or old disk upload: nothing to move.
        stats.attNoContent++;
        console.log(`SKIP     ${issue.key}  ${a.name}  (no stored content)`);
        continue;
      }
      const decoded = decodeDataUrl(url);
      if (!decoded) { console.log(`FAILED   ${issue.key}  ${a.name}  (unreadable data URL)`); stats.failed++; continue; }
      console.log(`MOVE     ${issue.key}  ${a.name}  (${kb(decoded.buffer.length)}) -> ${config.cloudinaryFolder}/bug-tracker/${issue.key}/${a.id}`);
      stats.attMove++;
      if (!apply) continue;
      try {
        const stored = await uploadAttachment(issue.key, a.id, decoded.buffer, decoded.mime, a.name || a.id);
        // Update just this attachment, and only if it is still the un-migrated one.
        await BugTrackerIssueModel.updateOne(
          { _id: issue._id, attachments: { $elemMatch: { id: a.id, publicId: { $exists: false } } } },
          {
            $set: {
              'attachments.$.publicId': stored.publicId,
              'attachments.$.resourceType': stored.resourceType,
              'attachments.$.deliveryType': stored.deliveryType,
              'attachments.$.format': stored.format,
              'attachments.$.version': stored.version
            },
            $unset: { 'attachments.$.previewUrl': 1 }
          }
        );
      } catch (err: any) {
        console.log(`FAILED   ${issue.key}  ${a.name}  (${err?.message ?? err})`);
        stats.failed++;
      }
    }
  }
}

async function main() {
  if (!isStorageConfigured()) {
    console.error('CLOUDINARY_URL is not set (or invalid). Nothing to do.');
    process.exit(1);
  }
  if (apply && folderArg !== config.cloudinaryFolder) {
    console.error(`Refusing to apply: target folder is "${config.cloudinaryFolder}" (from CLOUDINARY_FOLDER).`);
    console.error(`Re-run with --folder=${config.cloudinaryFolder} to confirm that is the folder you mean.`);
    process.exit(1);
  }

  await connectDatabase();
  console.log(`Mode:   ${apply ? 'APPLY (uploads and updates records)' : 'DRY RUN (reads only, changes nothing)'}`);
  console.log(`Folder: ${config.cloudinaryFolder}/`);

  const stats: Record<string, number> = {
    photoMove: 0, photoDone: 0, photoCleanup: 0, photoNone: 0, photoExternal: 0, photoLost: 0,
    attMove: 0, attDone: 0, attNoContent: 0, failed: 0
  };
  await migratePhotos(stats);
  await migrateAttachments(stats);

  console.log('\n────────────────────────────────────────');
  console.log(`Photos to move:            ${stats.photoMove}`);
  console.log(`Photos already migrated:   ${stats.photoDone}  (+ ${stats.photoCleanup} leftover base64 cleaned)`);
  console.log(`Photos external / none:    ${stats.photoExternal} / ${stats.photoNone}`);
  console.log(`Photos lost (old disk):    ${stats.photoLost}`);
  console.log(`Attachments to move:       ${stats.attMove}`);
  console.log(`Attachments already done:  ${stats.attDone}`);
  console.log(`Attachments without file:  ${stats.attNoContent}`);
  console.log(`Failed:                    ${stats.failed}`);
  console.log(apply
    ? '\nAPPLIED. The app picks up the change within 60 s. Run the dry run again: "to move" should be 0.'
    : '\nDRY RUN: nothing was changed. Re-run with --apply --folder=<folder> to migrate.');

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[migrate-assets] failed:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
