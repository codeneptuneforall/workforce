import type { AppNotification } from '../types/bugTracker';

export const notifications: AppNotification[] = [
{ id: 'ntf-1', recipientId: 'emp-arjun', title: 'New critical issue', body: 'WF-019 Biometric sync duplicates punches for night shifts needs triage.', issueKey: 'WF-019', createdAt: '2026-10-27T16:05:00', read: false },
{ id: 'ntf-2', recipientId: 'emp-arjun', title: 'Overdue', body: 'WF-011 Payroll run stalls at tax computation is 2 days overdue and blocked.', issueKey: 'WF-011', createdAt: '2026-10-28T08:00:00', read: false },
{ id: 'ntf-3', recipientId: 'emp-arjun', title: 'Ready for QA', body: 'Ananya submitted WF-009 for verification.', issueKey: 'WF-009', createdAt: '2026-10-27T18:20:00', read: true },
{ id: 'ntf-4', recipientId: 'emp-rahul', title: 'Assigned to you', body: 'WF-013 Add bulk approve for pending timesheets.', issueKey: 'WF-013', createdAt: '2026-10-22T15:30:00', read: false },
{ id: 'ntf-5', recipientId: 'emp-rahul', title: 'Overdue', body: 'WF-005 Clock-in button double-submits on slow networks passed its due date.', issueKey: 'WF-005', createdAt: '2026-10-28T08:00:00', read: false },
{ id: 'ntf-6', recipientId: 'emp-sneha', title: 'Ready for QA', body: 'WF-009 Mobile app crashes when uploading profile photo.', issueKey: 'WF-009', createdAt: '2026-10-27T18:20:00', read: false },
{ id: 'ntf-7', recipientId: 'emp-sneha', title: 'Ready for QA', body: 'WF-012 Date picker ignores company week-start setting.', issueKey: 'WF-012', createdAt: '2026-10-26T12:10:00', read: false },
{ id: 'ntf-8', recipientId: 'emp-priya', title: 'Security issue resolved', body: 'WF-004 passed QA verification.', issueKey: 'WF-004', createdAt: '2026-10-20T11:00:00', read: false },
{ id: 'ntf-9', recipientId: 'emp-daniel', title: 'Your report was reopened', body: 'WF-007 failed QA and is back with the developer.', issueKey: 'WF-007', createdAt: '2026-10-24T14:40:00', read: false },
{ id: 'ntf-10', recipientId: 'emp-daniel', title: 'Moved to QA testing', body: 'WF-010 Team calendar overlaps half-day leaves.', issueKey: 'WF-010', createdAt: '2026-10-26T10:00:00', read: true }];