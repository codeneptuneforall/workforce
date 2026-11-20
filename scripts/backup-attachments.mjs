/**
 * Back up every bug tracker attachment from the live API server.
 *
 * Attachments live in two places:
 *   - inside the issue record in MongoDB, as a base64 data URL (images added in the UI)
 *   - on the server disk (multipart upload endpoint), which Render wipes on every deploy
 * Both are saved as real files. Attachments where only a name was ever stored are
 * listed in the manifest.
 *
 * It only reads: it logs in, lists issues, opens each issue with attachments and
 * downloads disk files through the permission-checked endpoint. Nothing is changed.
 *
 * Output (outside the repo, never committed):
 *   ../workforce-asset-backup/<timestamp>/bug-tracker/<issueKey>/<fileName>
 *   ../workforce-asset-backup/<timestamp>/manifest.json   (saved + missing, with metadata)
 *
 * Usage (cmd):
 *   set "BACKUP_EMAIL=admin@yourcompany.com"
 *   set "BACKUP_PASSWORD=..."
 *   node scripts/backup-attachments.mjs
 *
 * Optional: API_BASE (default https://workforce-hc9w.onrender.com), BACKUP_DIR.
 * Use a management account with payroll access, so the bug tracker treats it as
 * admin and every issue is visible.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = (process.env.API_BASE ?? 'https://workforce-hc9w.onrender.com').replace(/\/$/, '');
const email = process.env.BACKUP_EMAIL;
const password = process.env.BACKUP_PASSWORD;
if (!email || !password) {
  console.error('Set BACKUP_EMAIL and BACKUP_PASSWORD first (see the header of this file).');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(process.env.BACKUP_DIR ?? path.join(process.cwd(), '..', 'workforce-asset-backup'), stamp);

/** The download endpoint allows ~30 requests/minute; stay under it. */
const PAUSE_MS = 2200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(url, init = {}, attempt = 1) {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt <= 5) {
    const wait = 15_000 * attempt;
    console.log(`  rate limited, waiting ${wait / 1000}s...`);
    await sleep(wait);
    return request(url, init, attempt + 1);
  }
  return res;
}

function safeName(name) {
  return path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

async function main() {
  console.log(`API:    ${API_BASE}`);
  console.log(`Output: ${outDir}\n`);

  // 1. Log in. The API returns the session token in the body; send it as a Bearer token.
  const login = await request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginBody = await login.json().catch(() => ({}));
  if (!login.ok || !loginBody.token) {
    console.error(`Login failed (${login.status}): ${loginBody.error ?? 'no token returned'}`);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${loginBody.token}` };
  console.log(`Logged in as ${loginBody.user?.name ?? email} (${loginBody.user?.role})`);

  // 2. List every visible issue.
  const issuesRes = await request(`${API_BASE}/api/bug-tracker/issues`, { headers: auth });
  const issuesBody = await issuesRes.json().catch(() => ({}));
  if (!issuesRes.ok) {
    console.error(`Could not list issues (${issuesRes.status}): ${issuesBody.error ?? ''}`);
    process.exit(1);
  }
  const issues = issuesBody.issues ?? [];

  // The list endpoint is slim: it returns attachmentCount but not the attachments
  // themselves. Open every issue that has any to get the full records.
  const withAttachments = issues.filter((i) => (i.attachmentCount ?? i.attachments?.length ?? 0) > 0);
  console.log(`Issues: ${issues.length}, with attachments: ${withAttachments.length}`);
  const fullIssues = [];
  for (const summary of withAttachments) {
    const res = await request(`${API_BASE}/api/bug-tracker/issues/${encodeURIComponent(summary.key)}`, { headers: auth });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.issue) fullIssues.push(body.issue);
    else console.log(`  could not open ${summary.key} (HTTP ${res.status})`);
    await sleep(600);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const all = fullIssues.flatMap((issue) => (issue.attachments ?? []).map((a) => ({ issueKey: issue.key, issueId: issue.id ?? issue._id, attachment: a })));
  // Stored inside MongoDB as a base64 data URL (images added through the UI).
  const embedded = all.filter(({ attachment: a }) => typeof a.previewUrl === 'string' && a.previewUrl.startsWith('data:'));
  // Stored on the server disk by the multipart upload endpoint.
  const withFiles = all.filter(({ attachment: a }) => a.fileName);
  // Only a name/size was saved; the file content was never stored anywhere.
  const metadataOnly = all.filter(({ attachment: a }) => !a.fileName && !(typeof a.previewUrl === 'string' && a.previewUrl.startsWith('data:')));
  const linkOnly = metadataOnly.map(({ issueKey, attachment: a }) => ({ issueKey, id: a.id, name: a.name, sizeKb: a.sizeKb, kind: a.kind, previewUrl: a.previewUrl, uploadedById: a.uploadedById, uploadedAt: a.uploadedAt }));
  console.log(`Attachments: ${all.length} total -> ${embedded.length} embedded in MongoDB, ${withFiles.length} on server disk, ${metadataOnly.length} name-only (no content was ever stored)\n`);

  const manifest = { apiBase: API_BASE, takenAt: new Date().toISOString(), issues: issues.length, issuesWithAttachments: withAttachments.length, embedded: [], saved: [], missing: [], failed: [], linkOnly };

  // Embedded data URLs: decode and save, so the backup holds every real file.
  const extFor = (mime) => ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf', 'text/plain': '.txt' })[mime] ?? '';
  for (const { issueKey, issueId, attachment: a } of embedded) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(a.previewUrl);
    if (!match) { manifest.failed.push({ issueKey, id: a.id, name: a.name, error: 'unreadable data URL' }); continue; }
    const mime = match[1] ?? 'application/octet-stream';
    const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
    const dir = path.join(outDir, 'bug-tracker', safeName(issueKey));
    fs.mkdirSync(dir, { recursive: true });
    const base = safeName(a.name || a.id);
    const fileName = path.extname(base) ? `${a.id}-${base}` : `${a.id}-${base}${extFor(mime)}`;
    const file = path.join(dir, fileName);
    fs.writeFileSync(file, bytes);
    manifest.embedded.push({ issueKey, issueId, id: a.id, name: a.name, kind: a.kind, sizeKb: a.sizeKb, uploadedById: a.uploadedById, uploadedAt: a.uploadedAt, contentType: mime, bytes: bytes.length, localPath: path.relative(outDir, file) });
    console.log(`EMBEDDED  ${issueKey}  ${a.name}  (${Math.round(bytes.length / 1024)} KB)`);
  }
  for (const m of linkOnly) console.log(`NAME-ONLY ${m.issueKey}  ${m.name}  (no content stored)`);
  if (embedded.length || linkOnly.length) console.log('');

  // 3. Download each one.
  let i = 0;
  for (const { issueKey, issueId, attachment } of withFiles) {
    i++;
    const url = `${API_BASE}/api/bug-tracker/issues/${encodeURIComponent(issueKey)}/attachments/download?filename=${encodeURIComponent(attachment.fileName)}`;
    const entry = { issueKey, issueId, id: attachment.id, name: attachment.name, fileName: attachment.fileName, sizeKb: attachment.sizeKb, kind: attachment.kind, uploadedById: attachment.uploadedById, uploadedAt: attachment.uploadedAt };
    try {
      const res = await request(url, { headers: auth });
      if (res.status === 404) {
        manifest.missing.push(entry);
        console.log(`[${i}/${withFiles.length}] MISSING  ${issueKey}  ${attachment.name}  (file no longer on server)`);
      } else if (!res.ok) {
        manifest.failed.push({ ...entry, status: res.status });
        console.log(`[${i}/${withFiles.length}] FAILED   ${issueKey}  ${attachment.name}  (HTTP ${res.status})`);
      } else {
        const bytes = Buffer.from(await res.arrayBuffer());
        const dir = path.join(outDir, 'bug-tracker', safeName(issueKey));
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, safeName(attachment.fileName));
        fs.writeFileSync(file, bytes);
        manifest.saved.push({ ...entry, bytes: bytes.length, contentType: res.headers.get('content-type'), localPath: path.relative(outDir, file) });
        console.log(`[${i}/${withFiles.length}] SAVED    ${issueKey}  ${attachment.name}  (${Math.round(bytes.length / 1024)} KB)`);
      }
    } catch (err) {
      manifest.failed.push({ ...entry, error: String(err?.message ?? err) });
      console.log(`[${i}/${withFiles.length}] FAILED   ${issueKey}  ${attachment.name}  (${err?.message ?? err})`);
    }
    if (i < withFiles.length) await sleep(PAUSE_MS);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n────────────────────────────────────────');
  console.log(`Embedded (from MongoDB) saved: ${manifest.embedded.length}`);
  console.log(`Disk files saved:              ${manifest.saved.length}`);
  console.log(`Disk files missing:            ${manifest.missing.length}  (already wiped by an earlier deploy)`);
  console.log(`Failed:                        ${manifest.failed.length}`);
  console.log(`Name-only (content never stored, nothing to save): ${linkOnly.length}`);
  console.log(`\nBackup folder: ${outDir}`);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
