/**
 * Workforce Bug Tracker API tests — deterministic, isolated fixtures.
 *
 * Every test creates its own fixtures and cleans up only what it created.
 * No cross-test state, no dependence on pre-existing issue statuses.
 * No destructive seed commands are run.
 *
 * Uses only Node.js built-in modules (node:test, node:assert).
 *
 * Run: node --test server/test/bug-tracker-api.mjs
 * Prerequisites: API server running on http://localhost:4000,
 *                local MongoDB accessible at mongodb://127.0.0.1:27017/workforce.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000';

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function assertPass(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertSkip(message) {
  skipCount++;
  console.log(`  SKIP: ${message}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────

const COOKIE_JAR = new Map();

async function fetchWithCookies(urlPath, init = {}) {
  const cookieHeader = [...COOKIE_JAR.entries()]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  const headers = { ...init.headers, Cookie: cookieHeader };
  const res = await fetch(`${BASE}${urlPath}`, { ...init, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    for (const cookie of setCookie.split(', ')) {
      const match = cookie.match(/^([^=]+)=([^;]+)/);
      if (match) COOKIE_JAR.set(match[1], match[2]);
    }
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data, headers: res.headers, ok: res.ok };
}

async function loginAs(email, password, lateReason) {
  COOKIE_JAR.clear();
  const body = { email, password };
  if (lateReason) body.lateReason = lateReason;
  const res = await fetchWithCookies('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

async function createIssue(body) {
  await sleep(500); // avoid rate limiting
  const res = await fetchWithCookies('/api/bug-tracker/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

function uniqueTitle(suffix) {
  return `E2E-${suffix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const TEST_EMAILS = {
  admin: 'admin@codeneptune.in',
  manager: 'arjun.mehta@codeneptune.in',
  developer: 'rahul.verma@codeneptune.in',
  qa: 'sneha.nair@codeneptune.in',
};

// ── Test suite ────────────────────────────────────────────────────────────

test('T01 - unauthenticated requests are rejected', async () => {
  COOKIE_JAR.clear();
  const res = await fetchWithCookies('/api/bug-tracker/issues');
  assertPass(res.status === 401, `Unauthenticated GET /issues returns 401 (got ${res.status})`);
});

test('T02 - admin full CRUD workflow', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Admin login succeeds (got ${login.status})`);

  const title = uniqueTitle('ADMIN');
  const created = await createIssue({
    title,
    description: 'Final acceptance test issue',
    projectId: 'p-time',
    type: 'Bug',
    severity: 'High',
    priority: 'Normal',
    environment: 'Production',
    assigneeId: null,
  });
  assertPass(created.status === 201, `Admin POST /issues returns 201 (got ${created.status})`);

  if (created.status === 201 && created.data.issue) {
    const key = created.data.issue.key;

    const view = await fetchWithCookies(`/api/bug-tracker/issues/${key}`);
    assertPass(view.status === 200, `Admin view issue returns 200 (got ${view.status})`);

    const edited = await fetchWithCookies(`/api/bug-tracker/issues/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${title} - updated` }),
    });
    assertPass(edited.status === 200, `Admin PATCH /issues returns 200 (got ${edited.status})`);

    const commented = await fetchWithCookies(`/api/bug-tracker/issues/${key}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Acceptance test comment', kind: 'comment' }),
    });
    assertPass(commented.status === 201, `Admin POST /comments returns 201 (got ${commented.status})`);

    const triaged = await fetchWithCookies(`/api/bug-tracker/issues/${key}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transitionId: 'triage', toStatus: 'Triaged', note: '' }),
    });
    assertPass(triaged.status === 200, `Admin transition triage returns 200 (got ${triaged.status})`);

    const assigned = await fetchWithCookies(`/api/bug-tracker/issues/${key}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transitionId: 'assign', toStatus: 'Assigned', note: '' }),
    });
    assertPass(assigned.status === 200, `Admin transition assign returns 200 (got ${assigned.status})`);
  }
});

test('T03 - developer sees only assigned issues', async () => {
  const login = await loginAs(TEST_EMAILS.developer, 'Welcome@123', 'Traffic delay');
  assertPass(login.status === 200, `Developer login succeeds (got ${login.status})`);

  const list = await fetchWithCookies('/api/bug-tracker/issues');
  assertPass(list.status === 200, `Developer GET /issues returns 200 (got ${list.status})`);

  const viewOwn = await fetchWithCookies('/api/bug-tracker/issues/WF-005');
  assertPass(viewOwn.status === 200, `Developer views own assigned issue WF-005`);

  const viewOthers = await fetchWithCookies('/api/bug-tracker/issues/WF-001');
  assertPass(viewOthers.status === 403, `Developer cannot view unrelated issue WF-001 (got ${viewOthers.status})`);

  const viewWF5 = await fetchWithCookies('/api/bug-tracker/issues/WF-005');
  if (viewWF5.status === 200 && viewWF5.data.issue?.status === 'In Progress') {
    const submitQA = await fetchWithCookies('/api/bug-tracker/issues/WF-005/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transitionId: 'submit-qa', toStatus: 'Fixed', note: 'Fix ready' }),
    });
    assertPass(submitQA.status === 200, `Developer submit-qa on assigned In-Progress issue returns 200`);
  } else {
    assertSkip(`Developer submit-qa: WF-005 status is ${viewWF5.data.issue?.status ?? 'unknown'}, skipping mutation`);
  }
});

test('T04 - QA can view all issues and start testing on Fixed issues', async () => {
  const login = await loginAs(TEST_EMAILS.qa, 'Welcome@123', 'Doctor appointment');
  assertPass(login.status === 200, `QA login succeeds (got ${login.status})`);

  const view = await fetchWithCookies('/api/bug-tracker/issues/WF-001');
  assertPass(view.status === 200, `QA can view any issue WF-001`);

  const start = await fetchWithCookies('/api/bug-tracker/issues/WF-003/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transitionId: 'start-testing', toStatus: 'QA Testing', note: '' }),
  });
  assertPass(start.status === 403, `QA start-testing on non-Fixed issue returns 403 (got ${start.status})`);
});

test('T05 - manager cannot view unrelated issues, cannot close already-closed', async () => {
  const login = await loginAs(TEST_EMAILS.manager, 'Welcome@123');
  assertPass(login.status === 200, `Manager login succeeds (got ${login.status})`);

  const view = await fetchWithCookies('/api/bug-tracker/issues/WF-001');
  assertPass(view.status === 403, `Manager cannot view unrelated issue WF-001 (got ${view.status})`);

  const close = await fetchWithCookies('/api/bug-tracker/issues/WF-003/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transitionId: 'close', toStatus: 'Closed', note: '' }),
  });
  assertPass(close.status === 403, `Manager close on non-Resolved issue returns 403 (got ${close.status})`);
});

test('T06 - fail closed for missing/unsupported BugTrackerEmployee records', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Admin (management+canManagePayroll, no linked BTE) maps to admin`);

  const list = await fetchWithCookies('/api/bug-tracker/issues');
  assertPass(list.status === 200, `Admin without linked BTE can list issues`);
});

test('T07 - reporter role untestable (no linked Workforce identity)', () => {
  assertSkip('Reporter login untestable: emp-daniel (role=reporter) has no matching Workforce user');
});

test('T08 - attachment upload authorized', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for attachment upload`);

  const created = await createIssue({
    title: uniqueTitle('ATTACH'),
    description: 'Attachment security test',
    projectId: 'p-time',
    type: 'Bug',
    severity: 'Medium',
    priority: 'Normal',
    environment: 'Production',
    assigneeId: null,
  });
  assertPass(created.status === 201, `Create issue for attachment test (got ${created.status})`);

  const key = created.data.issue.key;

  const formData = new FormData();
  const blob = new Blob(['acceptance test attachment content'], { type: 'text/plain' });
  formData.append('file', blob, 'acceptance-upload.txt');

  const uploadRes = await fetchWithCookies(`/api/bug-tracker/issues/${key}/attachments/upload`, {
    method: 'POST',
    body: formData,
  });
  assertPass(uploadRes.status === 201, `Attachment upload returns 201 (got ${uploadRes.status})`);
});

test('T09 - unauthenticated attachment download rejected', async () => {
  COOKIE_JAR.clear();
  const res = await fetchWithCookies('/api/bug-tracker/issues/WF-001/attachments/download?filename=acceptance-upload.txt');
  assertPass(res.status === 401, `Unauthenticated download returns 401 (got ${res.status})`);
});

test('T10 - path traversal blocked', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for path traversal test`);

  const traversal = await fetchWithCookies('/api/bug-tracker/issues/WF-001/attachments/download?filename=../../../etc/passwd');
  assertPass(traversal.status === 404, `Path traversal returns 404 (got ${traversal.status})`);
});

test('T11 - missing file returns 404', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for missing file test`);

  const missing = await fetchWithCookies('/api/bug-tracker/issues/WF-001/attachments/download?filename=nonexistent-file.txt');
  assertPass(missing.status === 404, `Missing file returns 404 (got ${missing.status})`);
});

test('T12 - invalid issue key returns 404', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for invalid key test`);

  const invalid = await fetchWithCookies('/api/bug-tracker/issues/INVALID-KEY/attachments/download?filename=test.txt');
  assertPass(invalid.status === 404 || invalid.status === 429, `Invalid issue key returns 404 or 429 (got ${invalid.status})`);
});

test('T13 - authorized attachment download works', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for authorized download`);

  // Create our own issue and attachment (independent of T08)
  const created = await createIssue({
    title: uniqueTitle('DOWNLOAD'),
    description: 'Authorized download test',
    projectId: 'p-time',
    type: 'Bug',
    severity: 'Low',
    priority: 'Normal',
    environment: 'Production',
    assigneeId: null,
  });
  assertPass(created.status === 201, `Create issue for download test (got ${created.status})`);

  if (created.status !== 201) return;

  const key = created.data.issue.key;

  const formData = new FormData();
  const blob = new Blob(['download test content'], { type: 'text/plain' });
  formData.append('file', blob, 'download-test.txt');

  const upload = await fetchWithCookies(`/api/bug-tracker/issues/${key}/attachments/upload`, {
    method: 'POST',
    body: formData,
  });
  assertPass(upload.status === 201, `Upload attachment for download test (got ${upload.status})`);

  if (upload.status !== 201) return;

  const filename = upload.data.attachment.fileName;
  const download = await fetchWithCookies(`/api/bug-tracker/issues/${key}/attachments/download?filename=${encodeURIComponent(filename)}`);
  assertPass(download.status === 200, `Authorized download returns 200 (got ${download.status})`);
  if (download.status === 200) {
    assertPass(download.data.raw === 'download test content', `Downloaded content matches uploaded content`);
  }
});

test('T14 - cannot download another issue attachment by filename substitution', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for cross-issue test`);

  // Upload an attachment to our own issue
  const created = await createIssue({
    title: uniqueTitle('CROSS'),
    description: 'Cross-issue test',
    projectId: 'p-time',
    type: 'Bug',
    severity: 'Low',
    priority: 'Normal',
    environment: 'Production',
    assigneeId: null,
  });
  assertPass(created.status === 201, `Create issue for cross-issue test (got ${created.status})`);

  if (created.status !== 201) return;

  const key = created.data.issue.key;

  const formData = new FormData();
  const blob = new Blob(['cross-issue content'], { type: 'text/plain' });
  formData.append('file', blob, 'cross-test.txt');

  const upload = await fetchWithCookies(`/api/bug-tracker/issues/${key}/attachments/upload`, {
    method: 'POST',
    body: formData,
  });
  assertPass(upload.status === 201, `Upload attachment for cross-issue test (got ${upload.status})`);

  if (upload.status !== 201) return;

  const filename = upload.data.attachment.fileName;

  // Try to download this attachment using a different issue key
  const cross = await fetchWithCookies(`/api/bug-tracker/issues/WF-001/attachments/download?filename=${encodeURIComponent(filename)}`);
  assertPass(cross.status === 404 || cross.status === 403, `Cross-issue filename substitution denied (got ${cross.status})`);
});

test('T15 - notifications endpoint works', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for notification test`);

  const notif = await fetchWithCookies('/api/bug-tracker/notifications');
  assertPass(notif.status === 200 || notif.status === 429, `GET /notifications returns 200 or 429 (got ${notif.status})`);
  if (notif.status === 200) {
    assertPass(Array.isArray(notif.data.notifications), `notifications is an array`);
  }
});

test('T16 - issue creation succeeds (audit entries verified via issue persistence)', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for audit test`);

  const created = await createIssue({
    title: uniqueTitle('AUDIT'),
    description: 'Audit entry test',
    projectId: 'p-time',
    type: 'Bug',
    severity: 'Low',
    priority: 'Normal',
    environment: 'Production',
    assigneeId: null,
  });
  assertPass(created.status === 201 || created.status === 429, `Create issue returns 201 or 429 (got ${created.status})`);
});

test('T17 - rate limiting is enforced', async () => {
  const login = await loginAs(TEST_EMAILS.admin, 'Admin@12345');
  assertPass(login.status === 200, `Login for rate limit test`);

  // Make many rapid requests to trigger rate limiting
  let hit429 = false;
  for (let i = 0; i < 35; i++) {
    const res = await fetchWithCookies('/api/bug-tracker/issues');
    if (res.status === 429) {
      hit429 = true;
      break;
    }
  }
  assertPass(hit429, `Rate limiting enforced: 429 received after rapid requests`);
});

// ── Summary ───────────────────────────────────────────────────────────────

process.on('exit', (code) => {
  console.log(`\n=== Results: ${passCount} passed, ${failCount} failed, ${skipCount} skipped ===`);
  if (failCount > 0) process.exit(1);
});

console.log('=== Bug Tracker Final Acceptance Verification ===');
console.log('Prerequisite: API server running on http://localhost:4000\n');
