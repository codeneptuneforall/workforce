import type { Issue } from '../types/bugTracker';

// Sample issues for the prototype. Dashboard metrics are computed from this list.
export const issues: Issue[] = [
{
  id: 'iss-001', key: 'WF-001', title: 'Timesheet CSV export truncates rows beyond 500 entries',
  description: 'When managers export monthly timesheets for large teams, the CSV stops at exactly 500 rows with no warning. Payroll reconciliation was being done on incomplete data.',
  projectId: 'p1', type: 'Bug', severity: 'High', priority: 'High', status: 'Closed',
  assigneeId: 'e7', reporterId: 'u-admin', createdAt: '2026-09-22T10:14:00', updatedAt: '2026-10-06T16:40:00', dueDate: '2026-10-03',
  feature: 'Timesheets › Export', environment: 'Production',
  stepsToReproduce: ['Open Time Tracking › Timesheets as a manager', 'Select a team with more than 40 members and all of September', 'Click Export › CSV and open the file'],
  expectedResult: 'All timesheet rows for the selected period are exported.', actualResult: 'The file contains only the first 500 rows.',
  labels: ['export', 'payroll-impact'],
  attachments: [{ id: 'att-001', name: 'timesheet-export-sept.csv', sizeKb: 84, kind: 'document', uploadedById: 'u-admin', uploadedAt: '2026-09-22T10:14:00' }],
  comments: [],
  activity: [
  { id: 'a-001-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-09-22T10:14:00', toStatus: 'New' },
  { id: 'a-001-2', actorId: 'u-arjun', message: 'assigned to Meera Iyer', createdAt: '2026-09-22T14:02:00', toStatus: 'Assigned' },
  { id: 'a-001-3', actorId: 'e7', message: 'submitted the fix for QA', createdAt: '2026-09-30T17:20:00', toStatus: 'Fixed' },
  { id: 'a-001-4', actorId: 'e5', message: 'passed QA verification', createdAt: '2026-10-02T11:30:00', toStatus: 'Resolved' },
  { id: 'a-001-5', actorId: 'u-arjun', message: 'closed the issue', createdAt: '2026-10-06T16:40:00', toStatus: 'Closed' }],

  relatedIssueKeys: ['WF-013'],
  fixSummary: 'Removed the hard-coded page size from the export query and switched to streamed CSV generation.',
  qa: { status: 'Passed', verifierId: 'e5', notes: 'Exported 1,284 rows for Platform team; totals match the timesheet summary.', verifiedAt: '2026-10-02T11:30:00' },
  resolution: { summary: 'Removed the hard-coded page size from the export query and switched to streamed CSV generation.', resolvedById: 'e7', resolvedAt: '2026-10-02T11:30:00', verificationOutcome: 'Passed QA verification' }
},
{
  id: 'iss-002', key: 'WF-002', title: 'Leave balance shows negative value after carry-forward',
  description: 'Employees who carried forward more than 5 days from last year see a negative balance on the Leave dashboard, even though their entitlement is correct in the admin view.',
  projectId: 'p1', type: 'Functional Issue', severity: 'Medium', priority: 'Normal', status: 'Closed',
  assigneeId: 'e7', reporterId: 'u-admin', createdAt: '2026-09-25T09:40:00', updatedAt: '2026-10-09T12:15:00', dueDate: '2026-10-08',
  feature: 'Leave › Balances', environment: 'Production',
  stepsToReproduce: ['Sign in as an employee with 7 carried-forward days', 'Open Leave › My balance'],
  expectedResult: 'Balance shows annual entitlement plus carried-forward days.', actualResult: 'Balance displays -2 days.',
  labels: ['regression'], attachments: [], comments: [],
  activity: [
  { id: 'a-002-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-09-25T09:40:00', toStatus: 'New' },
  { id: 'a-002-2', actorId: 'u-arjun', message: 'assigned to Meera Iyer', createdAt: '2026-09-26T10:00:00', toStatus: 'Assigned' },
  { id: 'a-002-3', actorId: 'e6', message: 'passed QA verification', createdAt: '2026-10-07T15:10:00', toStatus: 'Resolved' },
  { id: 'a-002-4', actorId: 'u-arjun', message: 'closed the issue', createdAt: '2026-10-09T12:15:00', toStatus: 'Closed' }],

  relatedIssueKeys: [],
  fixSummary: 'Carry-forward days are now added before deductions are applied in the balance calculation.',
  qa: { status: 'Passed', verifierId: 'e6', notes: 'Verified with 3 employee profiles including 0, 5 and 7 carried days.', verifiedAt: '2026-10-07T15:10:00' },
  resolution: { summary: 'Carry-forward days are now added before deductions are applied in the balance calculation.', resolvedById: 'e7', resolvedAt: '2026-10-07T15:10:00', verificationOutcome: 'Passed QA verification' }
},
{
  id: 'iss-003', key: 'WF-003', title: 'Payslip PDF misaligns deductions table in Safari',
  description: 'The deductions table on downloaded payslips overflows into the net-pay box when generated from Safari 18. Chrome and Edge render correctly.',
  projectId: 'p1', type: 'UI/UX Issue', severity: 'Medium', priority: 'Normal', status: 'Resolved',
  assigneeId: 'e2', reporterId: 'e1', createdAt: '2026-10-05T11:20:00', updatedAt: '2026-10-21T14:05:00', dueDate: '2026-10-16',
  feature: 'Payroll › Payslips', environment: 'Production',
  stepsToReproduce: ['Open Payroll › Payslips in Safari 18', 'Download the September payslip as PDF'],
  expectedResult: 'Deductions table fits within its section.', actualResult: 'Table overlaps the net pay summary.',
  labels: ['payroll-impact'],
  attachments: [{ id: 'att-003', name: 'payslip-safari.png', sizeKb: 312, kind: 'image', uploadedById: 'e1', uploadedAt: '2026-10-05T11:20:00' }],
  comments: [{ id: 'c-003-1', authorId: 'e5', body: 'Verified on Safari 18.1 and 17.6 — layout is correct on both.', createdAt: '2026-10-21T14:05:00', kind: 'qa-pass' }],
  activity: [
  { id: 'a-003-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-05T11:20:00', toStatus: 'New' },
  { id: 'a-003-2', actorId: 'u-arjun', message: 'assigned to Rahul Verma', createdAt: '2026-10-06T09:00:00', toStatus: 'Assigned' },
  { id: 'a-003-3', actorId: 'e2', message: 'submitted the fix for QA', createdAt: '2026-10-17T18:00:00', toStatus: 'Fixed' },
  { id: 'a-003-4', actorId: 'e5', message: 'passed QA verification', createdAt: '2026-10-21T14:05:00', toStatus: 'Resolved' }],

  relatedIssueKeys: [],
  fixSummary: 'Replaced flex layout in the PDF template with a fixed-width table to avoid WebKit print reflow.',
  qa: { status: 'Passed', verifierId: 'e5', notes: 'Verified on Safari 18.1 and 17.6 — layout is correct on both.', verifiedAt: '2026-10-21T14:05:00' },
  resolution: { summary: 'Replaced flex layout in the PDF template with a fixed-width table to avoid WebKit print reflow.', resolvedById: 'e2', resolvedAt: '2026-10-21T14:05:00', verificationOutcome: 'Passed QA verification' }
},
{
  id: 'iss-004', key: 'WF-004', title: 'Session token not invalidated after password reset',
  description: 'After an employee resets their password, existing sessions on other devices remain active for up to 24 hours. This is a security exposure for shared or lost devices.',
  projectId: 'p1', type: 'Security Issue', severity: 'Critical', priority: 'Urgent', status: 'Resolved',
  assigneeId: 'e7', reporterId: 'e6', createdAt: '2026-10-08T15:45:00', updatedAt: '2026-10-20T11:00:00', dueDate: '2026-10-10',
  feature: 'Account › Password reset', environment: 'Staging',
  stepsToReproduce: ['Sign in on two browsers', 'Reset the password from browser A', 'Refresh Workforce in browser B'],
  expectedResult: 'Browser B is signed out immediately.', actualResult: 'Browser B stays signed in.',
  labels: ['security'], attachments: [], comments: [],
  activity: [
  { id: 'a-004-1', actorId: 'e6', message: 'reported this issue', createdAt: '2026-10-08T15:45:00', toStatus: 'New' },
  { id: 'a-004-2', actorId: 'e1', message: 'assigned to Meera Iyer', createdAt: '2026-10-08T16:10:00', toStatus: 'Assigned' },
  { id: 'a-004-3', actorId: 'e7', message: 'submitted the fix for QA', createdAt: '2026-10-10T13:30:00', toStatus: 'Fixed' },
  { id: 'a-004-4', actorId: 'e6', message: 'passed QA verification', createdAt: '2026-10-20T11:00:00', toStatus: 'Resolved' }],

  relatedIssueKeys: [],
  fixSummary: 'Password reset now revokes all refresh tokens for the account and broadcasts a sign-out event.',
  qa: { status: 'Passed', verifierId: 'e6', notes: 'Tested across web and mobile sessions; all revoked within 5 seconds.', verifiedAt: '2026-10-20T11:00:00' },
  resolution: { summary: 'Password reset now revokes all refresh tokens for the account and broadcasts a sign-out event.', resolvedById: 'e7', resolvedAt: '2026-10-20T11:00:00', verificationOutcome: 'Passed QA verification' }
},
{
  id: 'iss-005', key: 'WF-005', title: 'Clock-in button double-submits on slow networks',
  description: 'On slow connections the Clock in button stays active while the request is pending. Tapping twice creates two punch records, which inflates worked hours and triggers false overtime.',
  projectId: 'p1', type: 'Bug', severity: 'Critical', priority: 'Urgent', status: 'In Progress',
  assigneeId: 'e2', reporterId: 'e5', createdAt: '2026-10-19T09:12:00', updatedAt: '2026-10-27T17:45:00', dueDate: '2026-10-27',
  feature: 'Time Tracking › Clock in', environment: 'Production',
  stepsToReproduce: ['Throttle the network to Slow 3G', 'Open Time Tracking › Today', 'Tap Clock in twice within one second'],
  expectedResult: 'A single punch record is created and the button is disabled while saving.', actualResult: 'Two punch records are created 400 ms apart.',
  labels: ['regression', 'payroll-impact'],
  attachments: [
  { id: 'att-005-1', name: 'duplicate-punches.png', sizeKb: 228, kind: 'image', uploadedById: 'e5', uploadedAt: '2026-10-19T09:12:00' },
  { id: 'att-005-2', name: 'network-har.log', sizeKb: 640, kind: 'log', uploadedById: 'e5', uploadedAt: '2026-10-19T09:14:00' }],

  comments: [
  { id: 'c-005-1', authorId: 'e5', body: 'Reproduced on Chrome with network throttled to Slow 3G — two punch records 400 ms apart.', createdAt: '2026-10-19T09:20:00', kind: 'test-note' },
  { id: 'c-005-2', authorId: 'e2', body: 'Root cause is the button not disabling while the request is pending. Adding an idempotency key on the API side as well; coordinating with Meera.', createdAt: '2026-10-23T11:05:00', kind: 'comment' },
  { id: 'c-005-3', authorId: 'u-arjun', body: 'This is now overdue — payroll cutoff is Oct 31. Please prioritise over WF-013.', createdAt: '2026-10-27T17:45:00', kind: 'comment' }],

  activity: [
  { id: 'a-005-1', actorId: 'e5', message: 'reported this issue', createdAt: '2026-10-19T09:12:00', toStatus: 'New' },
  { id: 'a-005-2', actorId: 'u-arjun', message: 'triaged the issue', createdAt: '2026-10-19T10:00:00', toStatus: 'Triaged' },
  { id: 'a-005-3', actorId: 'u-arjun', message: 'assigned to Rahul Verma', createdAt: '2026-10-19T10:02:00', toStatus: 'Assigned' },
  { id: 'a-005-4', actorId: 'e2', message: 'started progress', createdAt: '2026-10-21T09:30:00', toStatus: 'In Progress' }],

  relatedIssueKeys: ['WF-019'],
  qa: { status: 'Not submitted' }
},
{
  id: 'iss-006', key: 'WF-006', title: 'Overtime multiplier ignored for public holidays',
  description: 'Hours worked on public holidays are paid at 1.5× instead of the configured 2× multiplier. Affects all employees in the Bengaluru and Pune locations.',
  projectId: 'p1', type: 'Functional Issue', severity: 'High', priority: 'High', status: 'QA Testing',
  assigneeId: 'e4', reporterId: 'e1', createdAt: '2026-10-12T14:30:00', updatedAt: '2026-10-26T09:15:00', dueDate: '2026-10-30',
  feature: 'Payroll › Overtime rules', environment: 'Staging',
  stepsToReproduce: ['Configure Oct 2 as a public holiday for Bengaluru', 'Log 8 hours for an employee on Oct 2', 'Run a payroll preview for October'],
  expectedResult: 'Holiday hours are paid at 2× the hourly rate.', actualResult: 'Holiday hours are paid at 1.5×.',
  labels: ['payroll-impact', 'tax'], attachments: [],
  comments: [{ id: 'c-006-1', authorId: 'e4', body: 'Fix is on staging. Holiday calendar lookup now runs before the generic overtime rule.', createdAt: '2026-10-24T18:00:00', kind: 'comment' }],
  activity: [
  { id: 'a-006-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-12T14:30:00', toStatus: 'New' },
  { id: 'a-006-2', actorId: 'u-arjun', message: 'assigned to Karthik Nair', createdAt: '2026-10-13T09:00:00', toStatus: 'Assigned' },
  { id: 'a-006-3', actorId: 'e4', message: 'started progress', createdAt: '2026-10-14T10:00:00', toStatus: 'In Progress' },
  { id: 'a-006-4', actorId: 'e4', message: 'submitted the fix for QA', createdAt: '2026-10-24T18:00:00', toStatus: 'Fixed' },
  { id: 'a-006-5', actorId: 'e5', message: 'started QA testing', createdAt: '2026-10-26T09:15:00', toStatus: 'QA Testing' }],

  relatedIssueKeys: ['WF-011'], submittedForQaAt: '2026-10-24T18:00:00',
  fixSummary: 'Holiday calendar lookup now runs before the generic overtime rule; multiplier read from location settings.',
  qa: { status: 'In testing', verifierId: 'e5' }
},
{
  id: 'iss-007', key: 'WF-007', title: 'Leave approval email links to the wrong request',
  description: 'When an employee has two pending leave requests, the "Review request" link in the manager approval email opens the most recent request instead of the one described in the email.',
  projectId: 'p1', type: 'Bug', severity: 'High', priority: 'High', status: 'Reopened',
  assigneeId: 'e7', reporterId: 'u-admin', createdAt: '2026-10-10T08:50:00', updatedAt: '2026-10-24T14:40:00', dueDate: '2026-10-25',
  feature: 'Leave › Approval emails', environment: 'Production',
  stepsToReproduce: ['Submit two leave requests as the same employee', 'Open the approval email for the first request', 'Click Review request'],
  expectedResult: 'The first request opens.', actualResult: 'The second (most recent) request opens.',
  labels: ['email', 'customer-reported'], attachments: [],
  comments: [
  { id: 'c-007-1', authorId: 'e7', body: 'Email links now carry the request ID instead of the employee ID.', createdAt: '2026-10-22T16:30:00', kind: 'comment' },
  { id: 'c-007-2', authorId: 'e6', body: 'Still failing for requests created from the mobile app — the link falls back to the latest request because the mobile payload omits the request ID.', createdAt: '2026-10-24T14:40:00', kind: 'qa-fail' }],

  activity: [
  { id: 'a-007-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-10-10T08:50:00', toStatus: 'New' },
  { id: 'a-007-2', actorId: 'u-arjun', message: 'assigned to Meera Iyer', createdAt: '2026-10-10T11:00:00', toStatus: 'Assigned' },
  { id: 'a-007-3', actorId: 'e7', message: 'submitted the fix for QA', createdAt: '2026-10-22T16:30:00', toStatus: 'Fixed' },
  { id: 'a-007-4', actorId: 'e6', message: 'started QA testing', createdAt: '2026-10-23T10:00:00', toStatus: 'QA Testing' },
  { id: 'a-007-5', actorId: 'e6', message: 'failed QA verification', createdAt: '2026-10-24T14:40:00', toStatus: 'Reopened' }],

  relatedIssueKeys: ['WF-010'],
  fixSummary: 'Email links now carry the request ID instead of the employee ID.',
  reopenReason: 'Still failing for requests created from the mobile app.',
  qa: { status: 'Failed', verifierId: 'e6', reason: 'Still failing for requests created from the mobile app — the mobile payload omits the request ID.', verifiedAt: '2026-10-24T14:40:00' }
},
{
  id: 'iss-008', key: 'WF-008', title: 'Employee directory search slow above 5,000 records',
  description: 'Directory search takes 6–9 seconds to return results for tenants with more than 5,000 employees. Typing feels frozen because each keystroke triggers a full query.',
  projectId: 'p1', type: 'Performance Issue', severity: 'High', priority: 'High', status: 'In Progress',
  assigneeId: 'e7', reporterId: 'u-arjun', createdAt: '2026-10-15T13:00:00', updatedAt: '2026-10-25T10:30:00', dueDate: '2026-11-04',
  feature: 'Employee Directory › Search', environment: 'Production',
  stepsToReproduce: ['Open Employee Directory on the Acme tenant (6,200 employees)', 'Type "san" into search'],
  expectedResult: 'Results appear within 500 ms.', actualResult: 'Results take 6–9 seconds.',
  labels: ['performance'], attachments: [], comments: [],
  activity: [
  { id: 'a-008-1', actorId: 'u-arjun', message: 'reported this issue', createdAt: '2026-10-15T13:00:00', toStatus: 'New' },
  { id: 'a-008-2', actorId: 'u-arjun', message: 'assigned to Meera Iyer', createdAt: '2026-10-15T13:05:00', toStatus: 'Assigned' },
  { id: 'a-008-3', actorId: 'e7', message: 'started progress', createdAt: '2026-10-25T10:30:00', toStatus: 'In Progress' }],

  relatedIssueKeys: ['WF-016'], qa: { status: 'Not submitted' }
},
{
  id: 'iss-009', key: 'WF-009', title: 'Mobile app crashes when uploading a profile photo',
  description: 'On Android 14 the app crashes immediately after selecting a photo larger than 8 MB from the gallery. iOS is not affected.',
  projectId: 'p2', type: 'Bug', severity: 'Critical', priority: 'Urgent', status: 'Fixed',
  assigneeId: 'e3', reporterId: 'u-neha', createdAt: '2026-10-16T10:25:00', updatedAt: '2026-10-27T18:20:00', dueDate: '2026-10-29',
  feature: 'Mobile › Profile', environment: 'Production',
  stepsToReproduce: ['Open Profile on an Android 14 device', 'Tap the avatar and choose Gallery', 'Select a photo larger than 8 MB'],
  expectedResult: 'Photo is resized and uploaded.', actualResult: 'App closes without an error message.',
  labels: ['mobile', 'regression'],
  attachments: [{ id: 'att-009', name: 'crash-stacktrace.log', sizeKb: 46, kind: 'log', uploadedById: 'u-neha', uploadedAt: '2026-10-16T10:25:00' }],
  comments: [],
  activity: [
  { id: 'a-009-1', actorId: 'u-neha', message: 'reported this issue', createdAt: '2026-10-16T10:25:00', toStatus: 'New' },
  { id: 'a-009-2', actorId: 'u-neha', message: 'assigned to Ananya Das', createdAt: '2026-10-16T10:30:00', toStatus: 'Assigned' },
  { id: 'a-009-3', actorId: 'e3', message: 'started progress', createdAt: '2026-10-17T09:00:00', toStatus: 'In Progress' },
  { id: 'a-009-4', actorId: 'e3', message: 'submitted the fix for QA', createdAt: '2026-10-27T18:20:00', toStatus: 'Fixed' }],

  relatedIssueKeys: [], submittedForQaAt: '2026-10-27T18:20:00',
  fixSummary: 'Images are now downscaled to 2048 px on-device before upload; added out-of-memory guard.',
  qa: { status: 'Awaiting QA' }
},
{
  id: 'iss-010', key: 'WF-010', title: 'Team calendar overlaps half-day leaves',
  description: 'Two half-day leaves on the same date (morning and afternoon) render on top of each other in the team calendar, hiding one of them.',
  projectId: 'p1', type: 'UI/UX Issue', severity: 'Medium', priority: 'Normal', status: 'QA Testing',
  assigneeId: 'e2', reporterId: 'u-admin', createdAt: '2026-10-14T16:10:00', updatedAt: '2026-10-26T10:00:00', dueDate: '2026-10-31',
  feature: 'Leave › Team calendar', environment: 'Production',
  stepsToReproduce: ['Approve a morning half-day and an afternoon half-day for two people on the same date', 'Open Leave › Team calendar in week view'],
  expectedResult: 'Both entries are visible, stacked.', actualResult: 'Only one entry is visible.',
  labels: ['calendar'], attachments: [], comments: [],
  activity: [
  { id: 'a-010-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-10-14T16:10:00', toStatus: 'New' },
  { id: 'a-010-2', actorId: 'u-arjun', message: 'assigned to Rahul Verma', createdAt: '2026-10-15T09:00:00', toStatus: 'Assigned' },
  { id: 'a-010-3', actorId: 'e2', message: 'submitted the fix for QA', createdAt: '2026-10-25T15:00:00', toStatus: 'Fixed' },
  { id: 'a-010-4', actorId: 'e6', message: 'started QA testing', createdAt: '2026-10-26T10:00:00', toStatus: 'QA Testing' }],

  relatedIssueKeys: ['WF-007'], submittedForQaAt: '2026-10-25T15:00:00',
  fixSummary: 'Calendar cells now split into AM/PM lanes for half-day entries.',
  qa: { status: 'In testing', verifierId: 'e6' }
},
{
  id: 'iss-011', key: 'WF-011', title: 'Payroll run stalls at tax computation step',
  description: 'The October payroll run for the Pune entity stops at "Computing tax" and never completes. The job times out after 45 minutes and must be restarted.',
  projectId: 'p1', type: 'Performance Issue', severity: 'Critical', priority: 'Urgent', status: 'In Progress',
  assigneeId: 'e4', reporterId: 'e1', createdAt: '2026-10-21T08:30:00', updatedAt: '2026-10-27T12:00:00', dueDate: '2026-10-26',
  feature: 'Payroll › Run payroll', environment: 'Staging',
  stepsToReproduce: ['Open Payroll › Runs', 'Start an October run for the Pune entity', 'Wait for the tax computation step'],
  expectedResult: 'Tax computation completes within 5 minutes.', actualResult: 'Step stalls and times out after 45 minutes.',
  labels: ['payroll-impact', 'tax'], attachments: [],
  comments: [{ id: 'c-011-1', authorId: 'e4', body: 'Blocked: the FY 2026–27 tax slab configuration has not been published by Finance yet. The job loops while looking up a missing slab.', createdAt: '2026-10-27T12:00:00', kind: 'comment' }],
  activity: [
  { id: 'a-011-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-21T08:30:00', toStatus: 'New' },
  { id: 'a-011-2', actorId: 'u-arjun', message: 'assigned to Karthik Nair', createdAt: '2026-10-21T09:00:00', toStatus: 'Assigned' },
  { id: 'a-011-3', actorId: 'e4', message: 'started progress', createdAt: '2026-10-21T11:00:00', toStatus: 'In Progress' },
  { id: 'a-011-4', actorId: 'e4', message: 'marked the issue as blocked', createdAt: '2026-10-27T12:00:00' }],

  relatedIssueKeys: ['WF-006', 'WF-015'], blocked: true, blockedReason: 'Waiting on FY 2026–27 tax slab configuration from Finance',
  qa: { status: 'Not submitted' }
},
{
  id: 'iss-012', key: 'WF-012', title: 'Date picker ignores company week-start setting',
  description: 'The date picker always starts weeks on Sunday, even when the company setting is Monday. Employees pick the wrong week when filling timesheets.',
  projectId: 'p1', type: 'UI/UX Issue', severity: 'Low', priority: 'Low', status: 'Fixed',
  assigneeId: 'e2', reporterId: 'e5', createdAt: '2026-10-17T12:40:00', updatedAt: '2026-10-26T12:10:00', dueDate: '2026-11-07',
  feature: 'Shared › Date picker', environment: 'QA',
  stepsToReproduce: ['Set Company settings › Week starts on to Monday', 'Open any date picker in Time Tracking'],
  expectedResult: 'Weeks start on Monday.', actualResult: 'Weeks start on Sunday.',
  labels: ['accessibility'], attachments: [], comments: [],
  activity: [
  { id: 'a-012-1', actorId: 'e5', message: 'reported this issue', createdAt: '2026-10-17T12:40:00', toStatus: 'New' },
  { id: 'a-012-2', actorId: 'u-arjun', message: 'assigned to Rahul Verma', createdAt: '2026-10-18T09:00:00', toStatus: 'Assigned' },
  { id: 'a-012-3', actorId: 'e2', message: 'submitted the fix for QA', createdAt: '2026-10-26T12:10:00', toStatus: 'Fixed' }],

  relatedIssueKeys: [], submittedForQaAt: '2026-10-26T12:10:00',
  fixSummary: 'Date picker reads weekStartsOn from company settings context.',
  qa: { status: 'Awaiting QA' }
},
{
  id: 'iss-013', key: 'WF-013', title: 'Add bulk approve for pending timesheets',
  description: 'Managers with large teams approve timesheets one by one. Add multi-select and a bulk Approve action to the pending timesheets list.',
  projectId: 'p1', type: 'Enhancement', severity: 'Medium', priority: 'Normal', status: 'Assigned',
  assigneeId: 'e2', reporterId: 'u-arjun', createdAt: '2026-10-22T15:20:00', updatedAt: '2026-10-22T15:30:00', dueDate: '2026-11-12',
  feature: 'Timesheets › Approvals', environment: 'Production',
  stepsToReproduce: ['Open Time Tracking › Approvals with 30+ pending timesheets'],
  expectedResult: 'Managers can select several timesheets and approve them together.', actualResult: 'Each timesheet must be approved individually.',
  labels: [], attachments: [], comments: [],
  activity: [
  { id: 'a-013-1', actorId: 'u-arjun', message: 'reported this issue', createdAt: '2026-10-22T15:20:00', toStatus: 'New' },
  { id: 'a-013-2', actorId: 'u-arjun', message: 'assigned to Rahul Verma', createdAt: '2026-10-22T15:30:00', toStatus: 'Assigned' }],

  relatedIssueKeys: ['WF-001'], qa: { status: 'Not submitted' }
},
{
  id: 'iss-014', key: 'WF-014', title: 'Push notification badge count not clearing',
  description: 'The app icon badge on iOS keeps showing unread notifications after they have been opened in the app.',
  projectId: 'p2', type: 'Bug', severity: 'Medium', priority: 'Normal', status: 'Assigned',
  assigneeId: 'e3', reporterId: 'e6', createdAt: '2026-10-23T11:00:00', updatedAt: '2026-10-23T14:00:00', dueDate: '2026-11-05',
  feature: 'Mobile › Notifications', environment: 'Production',
  stepsToReproduce: ['Receive 3 push notifications', 'Open the app and view all notifications', 'Return to the home screen'],
  expectedResult: 'Badge count is cleared.', actualResult: 'Badge still shows 3.',
  labels: ['mobile'], attachments: [], comments: [],
  activity: [
  { id: 'a-014-1', actorId: 'e6', message: 'reported this issue', createdAt: '2026-10-23T11:00:00', toStatus: 'New' },
  { id: 'a-014-2', actorId: 'u-neha', message: 'assigned to Ananya Das', createdAt: '2026-10-23T14:00:00', toStatus: 'Assigned' }],

  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-015', key: 'WF-015', title: 'Bank file export missing IFSC for new hires',
  description: 'Employees onboarded after Oct 1 are exported to the salary bank file without an IFSC code, so the bank rejects their transfers.',
  projectId: 'p1', type: 'Functional Issue', severity: 'High', priority: 'Urgent', status: 'In Progress',
  assigneeId: 'e4', reporterId: 'e1', createdAt: '2026-10-20T10:00:00', updatedAt: '2026-10-25T16:00:00', dueDate: '2026-10-24',
  feature: 'Payroll › Bank file', environment: 'Production',
  stepsToReproduce: ['Onboard an employee with bank details after Oct 1', 'Generate the bank transfer file for October'],
  expectedResult: 'Every row includes the IFSC code.', actualResult: 'IFSC column is empty for new hires.',
  labels: ['payroll-impact', 'integration'], attachments: [], comments: [],
  activity: [
  { id: 'a-015-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-20T10:00:00', toStatus: 'New' },
  { id: 'a-015-2', actorId: 'u-arjun', message: 'assigned to Karthik Nair', createdAt: '2026-10-20T11:30:00', toStatus: 'Assigned' },
  { id: 'a-015-3', actorId: 'e4', message: 'started progress', createdAt: '2026-10-25T16:00:00', toStatus: 'In Progress' }],

  relatedIssueKeys: ['WF-011'], qa: { status: 'Not submitted' }
},
{
  id: 'iss-016', key: 'WF-016', title: 'Org chart fails to render for teams over 40 members',
  description: 'The org chart shows a blank canvas when a manager has more than 40 direct and indirect reports.',
  projectId: 'p1', type: 'Bug', severity: 'High', priority: 'High', status: 'Triaged',
  assigneeId: null, reporterId: 'u-neha', createdAt: '2026-10-24T09:30:00', updatedAt: '2026-10-25T10:00:00', dueDate: '2026-11-03',
  feature: 'Employee Directory › Org chart', environment: 'Production',
  stepsToReproduce: ['Open Employee Directory › Org chart', 'Select Arjun Mehta as the root'],
  expectedResult: 'Org chart renders all reports.', actualResult: 'Canvas is blank; console shows a layout error.',
  labels: [], attachments: [], comments: [],
  activity: [
  { id: 'a-016-1', actorId: 'u-neha', message: 'reported this issue', createdAt: '2026-10-24T09:30:00', toStatus: 'New' },
  { id: 'a-016-2', actorId: 'u-arjun', message: 'triaged the issue', createdAt: '2026-10-25T10:00:00', toStatus: 'Triaged' }],

  relatedIssueKeys: ['WF-008'], qa: { status: 'Not submitted' }
},
{
  id: 'iss-017', key: 'WF-017', title: 'Audit log export lacks timezone information',
  description: 'Audit log CSV timestamps are exported without a timezone offset, which makes compliance reviews across offices ambiguous.',
  projectId: 'p1', type: 'Task', severity: 'Low', priority: 'Low', status: 'Triaged',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-25T13:15:00', updatedAt: '2026-10-26T09:00:00', dueDate: null,
  feature: 'Admin › Audit log', environment: 'Production',
  stepsToReproduce: ['Open Admin › Audit log', 'Export the last 30 days as CSV'],
  expectedResult: 'Timestamps include an ISO 8601 offset.', actualResult: 'Timestamps have no offset.',
  labels: ['export'], attachments: [], comments: [],
  activity: [
  { id: 'a-017-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-25T13:15:00', toStatus: 'New' },
  { id: 'a-017-2', actorId: 'u-arjun', message: 'triaged the issue', createdAt: '2026-10-26T09:00:00', toStatus: 'Triaged' }],

  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-018', key: 'WF-018', title: 'Leave request form accepts end date before start date',
  description: 'Employees can submit a leave request where the end date is earlier than the start date. The request is created with a negative duration.',
  projectId: 'p1', type: 'Functional Issue', severity: 'Medium', priority: 'Normal', status: 'New',
  assigneeId: null, reporterId: 'u-admin', createdAt: '2026-10-27T10:05:00', updatedAt: '2026-10-27T10:05:00', dueDate: null,
  feature: 'Leave › Apply for leave', environment: 'Production',
  stepsToReproduce: ['Open Leave › Apply', 'Choose start date Nov 10 and end date Nov 6', 'Submit'],
  expectedResult: 'Form shows a validation error.', actualResult: 'Request is submitted with -4 days.',
  labels: ['customer-reported'], attachments: [], comments: [],
  activity: [{ id: 'a-018-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-10-27T10:05:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-019', key: 'WF-019', title: 'Biometric sync duplicates punches for night shifts',
  description: 'Night-shift punches that cross midnight are imported twice from the biometric devices — once for each calendar day.',
  projectId: 'p1', type: 'Bug', severity: 'High', priority: 'High', status: 'New',
  assigneeId: null, reporterId: 'e6', createdAt: '2026-10-27T16:00:00', updatedAt: '2026-10-27T16:00:00', dueDate: null,
  feature: 'Time Tracking › Biometric sync', environment: 'Production',
  stepsToReproduce: ['Punch in at 22:00 on a biometric device', 'Punch out at 06:00 the next day', 'Run the hourly sync'],
  expectedResult: 'One shift of 8 hours is recorded.', actualResult: 'Two shifts are recorded across both days.',
  labels: ['integration', 'payroll-impact'], attachments: [], comments: [],
  activity: [{ id: 'a-019-1', actorId: 'e6', message: 'reported this issue', createdAt: '2026-10-27T16:00:00', toStatus: 'New' }],
  relatedIssueKeys: ['WF-005'], qa: { status: 'Not submitted' }
},
{
  id: 'iss-020', key: 'WF-020', title: 'Dark mode contrast too low on mobile payslip view',
  description: 'In dark mode, secondary amounts on the mobile payslip screen are grey on dark grey and hard to read.',
  projectId: 'p2', type: 'UI/UX Issue', severity: 'Low', priority: 'Normal', status: 'New',
  assigneeId: null, reporterId: 'u-admin', createdAt: '2026-10-28T08:40:00', updatedAt: '2026-10-28T08:40:00', dueDate: null,
  feature: 'Mobile › Payslip', environment: 'Production',
  stepsToReproduce: ['Enable dark mode on the device', 'Open Payslips › October'],
  expectedResult: 'All amounts meet WCAG AA contrast.', actualResult: 'Deduction amounts are barely visible.',
  labels: ['accessibility', 'mobile'], attachments: [], comments: [],
  activity: [{ id: 'a-020-1', actorId: 'u-admin', message: 'reported this issue', createdAt: '2026-10-28T08:40:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-sample-1', key: 'WF-101', title: 'Login page crashes on Safari 17',
  description: 'The login page crashes when users try to sign in from Safari 17 on macOS.',
  projectId: 'p1', type: 'Bug', severity: 'High', priority: 'Urgent', status: 'New',
  assigneeId: 'e1', reporterId: 'e8', createdAt: '2026-10-28T09:00:00', updatedAt: '2026-10-28T09:00:00', dueDate: '2026-11-15',
  feature: 'Auth › Login', environment: 'Production',
  stepsToReproduce: ['Open login page in Safari 17', 'Enter valid credentials', 'Click Sign In'],
  expectedResult: 'User is signed in and redirected to dashboard.', actualResult: 'Page crashes with JavaScript error.',
  labels: ['safari', 'regression', 'customer-reported'], attachments: [], comments: [],
  activity: [{ id: 'a-101-1', actorId: 'e8', message: 'reported this issue', createdAt: '2026-10-28T09:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-sample-2', key: 'WF-102', title: 'Timesheet export missing weekend entries',
  description: 'When exporting weekly timesheets, Saturday and Sunday entries are not included in the CSV file.',
  projectId: 'p1', type: 'Functional Issue', severity: 'Medium', priority: 'High', status: 'Triaged',
  assigneeId: 'e2', reporterId: 'e3', createdAt: '2026-10-28T10:00:00', updatedAt: '2026-10-28T10:00:00', dueDate: '2026-11-20',
  feature: 'Timesheets › Export', environment: 'Production',
  stepsToReproduce: ['Open Timesheets page', 'Select a week with weekend work', 'Click Export CSV'],
  expectedResult: 'CSV includes all days including Saturday and Sunday.', actualResult: 'CSV only includes Monday through Friday entries.',
  labels: ['payroll-impact', 'export'], attachments: [], comments: [],
  activity: [{ id: 'a-102-1', actorId: 'e3', message: 'reported this issue', createdAt: '2026-10-28T10:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-sample-3', key: 'WF-103', title: 'Leave balance not updating after approval',
  description: 'When a manager approves a leave request, the employee leave balance does not decrease accordingly.',
  projectId: 'p4', type: 'Bug', severity: 'High', priority: 'High', status: 'Assigned',
  assigneeId: 'e4', reporterId: 'e5', createdAt: '2026-10-28T11:00:00', updatedAt: '2026-10-28T11:00:00', dueDate: '2026-11-10',
  feature: 'Leave › Approvals', environment: 'Staging',
  stepsToReproduce: ['Submit leave request as employee', 'Approve the request as manager', 'Check employee leave balance'],
  expectedResult: 'Leave balance decreases by approved days.', actualResult: 'Leave balance remains unchanged.',
  labels: ['leave', 'balance'], attachments: [], comments: [],
  activity: [{ id: 'a-103-1', actorId: 'e5', message: 'reported this issue', createdAt: '2026-10-28T11:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-sample-4', key: 'WF-104', title: 'Payslip PDF download fails on mobile',
  description: 'Users cannot download payslip PDF files from mobile devices.',
  projectId: 'p5', type: 'Bug', severity: 'Medium', priority: 'Normal', status: 'New',
  assigneeId: 'e7', reporterId: 'e6', createdAt: '2026-10-28T12:00:00', updatedAt: '2026-10-28T12:00:00', dueDate: '2026-11-25',
  feature: 'Payroll › Payslips', environment: 'Production',
  stepsToReproduce: ['Open Payslips page on iPhone', 'Tap Download PDF button'],
  expectedResult: 'PDF file is downloaded to device.', actualResult: 'Nothing happens when button is tapped.',
  labels: ['mobile', 'ios'], attachments: [], comments: [],
  activity: [{ id: 'a-104-1', actorId: 'e6', message: 'reported this issue', createdAt: '2026-10-28T12:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-sample-5', key: 'WF-105', title: 'Employee search returns no results for hyphenated names',
  description: 'Searching for employees with hyphenated last names returns no results.',
  projectId: 'p3', type: 'Bug', severity: 'Low', priority: 'Normal', status: 'New',
  assigneeId: null, reporterId: 'e8', createdAt: '2026-10-28T13:00:00', updatedAt: '2026-10-28T13:00:00', dueDate: '2026-12-01',
  feature: 'Employee Directory › Search', environment: 'Production',
  stepsToReproduce: ['Open Employee Directory', 'Type hyphenated last name in search'],
  expectedResult: 'Matching employees are displayed.', actualResult: 'No results found.',
  labels: ['search', 'directory'], attachments: [], comments: [],
  activity: [{ id: 'a-105-1', actorId: 'e8', message: 'reported this issue', createdAt: '2026-10-28T13:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-emp-1', key: 'WF-201', title: 'Dashboard not showing my assigned tasks',
  description: 'The management dashboard does not display tasks assigned to me as an employee.',
  projectId: 'p1', type: 'Bug', severity: 'Medium', priority: 'Normal', status: 'New',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-29T09:00:00', updatedAt: '2026-10-29T09:00:00', dueDate: '2026-11-05',
  feature: 'Dashboard › My Tasks', environment: 'Production',
  stepsToReproduce: ['Log in as employee', 'Open Management Dashboard', 'Check My Tasks section'],
  expectedResult: 'Tasks assigned to me are listed.', actualResult: 'No tasks are displayed.',
  labels: ['dashboard', 'employee-view'], attachments: [], comments: [],
  activity: [{ id: 'a-emp-1', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-29T09:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-emp-2', key: 'WF-202', title: 'Payslip download button not working',
  description: 'The Download Payslip button on the employee portal does not trigger any download.',
  projectId: 'p5', type: 'Bug', severity: 'High', priority: 'High', status: 'New',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-29T10:00:00', updatedAt: '2026-10-29T10:00:00', dueDate: '2026-11-10',
  feature: 'Payroll › Payslips', environment: 'Production',
  stepsToReproduce: ['Log in as employee', 'Open Payslips page', 'Click Download PDF'],
  expectedResult: 'Payslip PDF is downloaded.', actualResult: 'Nothing happens.',
  labels: ['payslip', 'download', 'mobile'], attachments: [], comments: [],
  activity: [{ id: 'a-emp-2', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-29T10:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-emp-3', key: 'WF-203', title: 'Leave balance shows wrong remaining days',
  description: 'The leave balance displayed on the employee portal does not match approved leave days.',
  projectId: 'p4', type: 'Bug', severity: 'High', priority: 'High', status: 'New',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-29T11:00:00', updatedAt: '2026-10-29T11:00:00', dueDate: '2026-11-12',
  feature: 'Leave › Balance', environment: 'Production',
  stepsToReproduce: ['Log in as employee', 'Open Leave page', 'Check remaining balance'],
  expectedResult: 'Balance shows correct remaining days.', actualResult: 'Balance shows incorrect value.',
  labels: ['leave', 'balance'], attachments: [], comments: [],
  activity: [{ id: 'a-emp-3', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-29T11:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-emp-4', key: 'WF-204', title: 'Time tracker punch-in fails on slow network',
  description: 'When clocking in on a slow network, the punch-in button spins indefinitely.',
  projectId: 'p1', type: 'Bug', severity: 'Critical', priority: 'Urgent', status: 'New',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-29T12:00:00', updatedAt: '2026-10-29T12:00:00', dueDate: '2026-11-08',
  feature: 'Time Tracking › Clock in', environment: 'Production',
  stepsToReproduce: ['Throttle network to Slow 3G', 'Open Time Tracker', 'Click Clock in'],
  expectedResult: 'Punch record is created immediately.', actualResult: 'Button spins indefinitely, no record created.',
  labels: ['time-tracker', 'network', 'payroll-impact'], attachments: [], comments: [],
  activity: [{ id: 'a-emp-4', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-29T12:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
},
{
  id: 'iss-emp-5', key: 'WF-205', title: 'Profile photo upload size limit too low',
  description: 'Uploading a profile photo larger than 2MB fails. Employees should be able to upload up to 5MB.',
  projectId: 'p3', type: 'Enhancement', severity: 'Low', priority: 'Normal', status: 'New',
  assigneeId: null, reporterId: 'e1', createdAt: '2026-10-29T13:00:00', updatedAt: '2026-10-29T13:00:00', dueDate: '2026-11-20',
  feature: 'Profile › Photo', environment: 'Production',
  stepsToReproduce: ['Open Profile page', 'Try to upload photo larger than 2MB'],
  expectedResult: 'Photo uploads successfully.', actualResult: 'Upload fails with size error.',
  labels: ['profile', 'upload'], attachments: [], comments: [],
  activity: [{ id: 'a-emp-5', actorId: 'e1', message: 'reported this issue', createdAt: '2026-10-29T13:00:00', toStatus: 'New' }],
  relatedIssueKeys: [], qa: { status: 'Not submitted' }
}];