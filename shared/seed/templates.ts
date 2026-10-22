import type { HolidayType, LeaveStatus, LeaveType, Tone } from '../types';

// Fixed-date national holidays plus sample company holidays.
// Management must verify all dates against the official notification before publishing.
export const holidayTemplates: {name: string;monthDay: string;type: HolidayType;description?: string;}[] = [
{ name: "New Year's Day", monthDay: '01-01', type: 'Optional', description: 'Optional holiday — employees may choose to take it.' },
{ name: 'Republic Day', monthDay: '01-26', type: 'Government', description: 'Entered by management from the official notification.' },
{ name: 'Independence Day', monthDay: '08-15', type: 'Government', description: 'Entered by management from the official notification.' },
{ name: 'Gandhi Jayanti', monthDay: '10-02', type: 'Government', description: 'Entered by management from the official notification.' },
{ name: 'Code Neptune Foundation Day', monthDay: '11-14', type: 'Company' },
{ name: 'Christmas Day', monthDay: '12-25', type: 'Government', description: 'Entered by management from the official notification.' },
{ name: 'Year-end Company Holiday', monthDay: '12-31', type: 'Company' }];


// Leave requests are positioned relative to today when the demo data is generated.
export const leaveTemplates: {
  employeeId: string;
  type: LeaveType;
  startOffset: number;
  length: number;
  status: LeaveStatus;
  reason: string;
  submittedOffset: number;
  rejectionReason?: string;
  inPreviousMonth?: boolean;
}[] = [
{ employeeId: 'e1', type: 'Casual', startOffset: 9, length: 2, status: 'Approved', reason: 'Family function in Mysuru.', submittedOffset: -6 },
{ employeeId: 'e2', type: 'Casual', startOffset: 12, length: 1, status: 'Pending Approval', reason: 'Personal errand — bank and documentation work.', submittedOffset: -1 },
{ employeeId: 'e3', type: 'Emergency', startOffset: -3, length: 1, status: 'Pending Approval', reason: 'Took my father to hospital for an urgent check-up; could not inform in advance.', submittedOffset: -1 },
{ employeeId: 'e4', type: 'Casual', startOffset: 6, length: 3, status: 'Rejected', reason: 'Short trip home.', submittedOffset: -4, rejectionReason: 'Overlaps the Aqua Commerce release window. Please pick dates after the release.' },
{ employeeId: 'e5', type: 'Emergency', startOffset: 0, length: 1, status: 'Approved', reason: 'Medical emergency at home.', submittedOffset: 0, inPreviousMonth: true },
{ employeeId: 'e6', type: 'Casual', startOffset: -8, length: 1, status: 'Approved', reason: 'Vehicle registration appointment.', submittedOffset: -16 },
{ employeeId: 'e7', type: 'Casual', startOffset: 15, length: 2, status: 'Pending Approval', reason: 'Attending a design conference.', submittedOffset: 0 }];


export const workNotes: string[] = [
'Implemented review comments and pushed changes.',
'Pairing session and code review.',
'Fixed edge cases found in QA.',
'Wrote unit tests and updated docs.',
'Investigated performance regression.',
'Client sync and follow-up tasks.',
'Refined layouts after design review.'];


export const notificationTemplates: {
  audience: string;
  title: string;
  body: string;
  link: string;
  minutesAgo: number;
  tone: Tone;
  read?: boolean;
}[] = [
{ audience: 'management', title: 'New leave request', body: 'Meera Pillai requested 2 days of Casual Leave.', link: '/management/leaves/requests', minutesAgo: 35, tone: 'warn' },
{ audience: 'management', title: 'Retrospective Emergency Leave', body: 'Ananya Iyer submitted a past-dated Emergency Leave request.', link: '/management/leaves/requests', minutesAgo: 140, tone: 'warn' },
{ audience: 'management', title: 'Shortfalls awaiting review', body: 'Working-hour shortfalls from last month need review before payroll.', link: '/management/attendance/shortfalls', minutesAgo: 300, tone: 'bad' },
{ audience: 'management', title: 'Timesheets pending', body: 'Several timesheets for last week are awaiting approval.', link: '/management/timesheets', minutesAgo: 600, tone: 'info' },
{ audience: 'management', title: 'Payroll needs review', body: 'Last month’s payroll has records that need review.', link: '/management/payroll', minutesAgo: 1440, tone: 'warn', read: true },
{ audience: 'e1', title: 'Leave approved', body: 'Your Casual Leave request was approved by Neha Kapoor.', link: '/employee/leaves/history', minutesAgo: 90, tone: 'ok' },
{ audience: 'e1', title: 'Timesheet submitted', body: 'Your timesheet for last week was submitted for review.', link: '/employee/timesheets', minutesAgo: 1500, tone: 'info' },
{ audience: 'e1', title: 'Payslip released', body: 'Your payslip is now available.', link: '/employee/payslips', minutesAgo: 8000, tone: 'ok', read: true },
{ audience: 'e2', title: 'Timesheet approved', body: 'Your timesheet for last week was approved.', link: '/employee/timesheets', minutesAgo: 400, tone: 'ok' }];