/**
 * Migrate existing profile picture files from local uploads/ to base64 data URLs
 * stored in MongoDB.
 *
 * Problem: Profile pictures were uploaded to uploads/profiles/ on the local
 * filesystem. The uploads/ directory is gitignored, so when the app is deployed,
 * those files don't exist on the server and photo URLs break.
 *
 * Fix: Read each uploaded file, convert it to a base64 data URL, and store that
 * in the employee's photoUrl field in MongoDB. The data URL travels with the
 * employee record and survives deploys.
 *
 * Run locally before deploying:
 *   npx tsx server/migrate-profile-pictures.ts
 */
import { connectDatabase, disconnectDatabase } from './db';
import { EmployeeModel } from './models';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../');
const uploadDir = path.resolve(root, 'uploads/profiles');

async function main() {
  if (!fs.existsSync(uploadDir)) {
    console.log('[migrate] No uploads directory found. Nothing to migrate.');
    await disconnectDatabase();
    return;
  }

  const files = fs.readdirSync(uploadDir);
  const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));

  if (imageFiles.length === 0) {
    console.log('[migrate] No profile picture files found. Nothing to migrate.');
    await disconnectDatabase();
    return;
  }

  console.log(`[migrate] Found ${imageFiles.length} image file(s) in uploads/profiles/`);

  // Group files by employee ID prefix (filename format: {employeeId}-{timestamp}-{random}.{ext})
  const byEmployee: Record<string, string[]> = {};
  for (const f of imageFiles) {
    const empId = f.split('-')[0];
    if (!byEmployee[empId]) byEmployee[empId] = [];
    byEmployee[empId].push(f);
  }

  await connectDatabase();

  let updated = 0;
  let skipped = 0;

  for (const [empId, files] of Object.entries(byEmployee)) {
    // Sort by modification time descending, pick the latest
    files.sort((a, b) => {
      const aTime = fs.statSync(path.join(uploadDir, a)).mtimeMs;
      const bTime = fs.statSync(path.join(uploadDir, b)).mtimeMs;
      return bTime - aTime;
    });

    const latestFile = files[0];
    const filePath = path.join(uploadDir, latestFile);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(latestFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const mime = mimeMap[ext] || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    const result = await EmployeeModel.updateOne(
      { _id: empId },
      { $set: { photoUrl: dataUrl } }
    );

    if (result.matchedCount > 0) {
      console.log(`[migrate] Updated ${empId}: ${latestFile} → base64 data URL`);
      updated++;
    } else {
      console.log(`[migrate] Skipped ${empId}: no employee found with id ${empId}`);
      skipped++;
    }
  }

  console.log(`\n[migrate] Complete. Updated: ${updated}, Skipped: ${skipped}`);
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
