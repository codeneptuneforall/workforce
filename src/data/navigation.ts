import {
  AlertCircleIcon,
  BarChart3Icon,
  BellIcon,
  BriefcaseIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  FileTextIcon,
  FolderKanbanIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PlaneIcon,
  ReceiptIcon,
  ScrollTextIcon,
  SettingsIcon,
  SquareKanbanIcon,
  TimerIcon,
  UserCheckIcon,
  UserIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';

const BUG_TRACKER_ENABLED = import.meta.env.VITE_BUG_TRACKER_ENABLED !== 'false';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  payrollOnly?: boolean;
  badgeKey?: 'notifications' | 'leaves' | 'timesheets';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const managementNav: NavGroup[] = [{
  label: 'Overview',
  items: [
  { label: 'Dashboard', to: '/management/dashboard', icon: LayoutDashboardIcon },
  { label: 'Live Time Tracker', to: '/management/time-tracker', icon: TimerIcon }]

},
{
  label: 'Time',
  items: [
  { label: 'Attendance & Hours', to: '/management/attendance', icon: CalendarCheckIcon },
  { label: 'Timesheets', to: '/management/timesheets', icon: ClipboardListIcon, badgeKey: 'timesheets' }]

},
{
  label: 'Workforce',
  items: [
  { label: 'Employees', to: '/management/employees', icon: UsersIcon },
  { label: 'Teams', to: '/management/teams', icon: UsersRoundIcon },
  { label: 'Projects', to: '/management/projects', icon: FolderKanbanIcon },
  { label: 'Tasks', to: '/management/tasks', icon: ListChecksIcon }]

},
{
  label: 'Leave',
  items: [
  { label: 'Leave Management', to: '/management/leaves', icon: PlaneIcon, badgeKey: 'leaves' },
  { label: 'Holiday Calendar', to: '/management/holidays', icon: CalendarDaysIcon }]

},
{
  label: 'Payroll',
  items: [
  { label: 'Payroll Reports', to: '/management/reports', icon: BarChart3Icon },
  { label: 'Payroll', to: '/management/payroll', icon: WalletIcon, payrollOnly: true },
  { label: 'Payslips', to: '/management/payslips', icon: ReceiptIcon, payrollOnly: true }]

},
{
  label: 'Admin',
  items: [
  { label: 'Notifications', to: '/management/notifications', icon: BellIcon, badgeKey: 'notifications' },
  { label: 'Settings', to: '/management/settings', icon: SettingsIcon },
  { label: 'Audit Log', to: '/management/audit-log', icon: ScrollTextIcon }]

},
{
  label: 'Bug Tracker',
  items: [
  { label: 'Overview', to: '/management/bug-tracker', icon: GaugeIcon },
  { label: 'All Issues', to: '/management/bug-tracker/issues', icon: ListChecksIcon },
  { label: 'My Issues', to: '/management/bug-tracker/my-issues', icon: UserCheckIcon },
  { label: 'Report a Bug', to: '/management/bug-tracker/report', icon: AlertCircleIcon },
  { label: 'Kanban Board', to: '/management/bug-tracker/board', icon: SquareKanbanIcon },
  { label: 'QA Verification', to: '/management/bug-tracker/qa', icon: ClipboardCheckIcon },
{ label: 'Reports', to: '/management/bug-tracker/reports', icon: BarChart3Icon }]
}];


export const employeeNav: NavGroup[] = [{
  label: 'Today',
  items: [
  { label: 'My Dashboard', to: '/employee/dashboard', icon: LayoutDashboardIcon },
  { label: 'Time Tracker', to: '/employee/time-tracker', icon: TimerIcon }]

},
{
  label: 'Work',
  items: [
  { label: 'My Work Logs', to: '/employee/work-logs', icon: ClockIcon },
  { label: 'My Timesheets', to: '/employee/timesheets', icon: ClipboardListIcon },
  { label: 'My Projects', to: '/employee/projects', icon: BriefcaseIcon },
  { label: 'My Attendance', to: '/employee/attendance', icon: CalendarCheckIcon }]

},
{
  label: 'Time off',
  items: [
  { label: 'Holiday Calendar', to: '/employee/holidays', icon: CalendarDaysIcon },
  { label: 'Apply for Leave', to: '/employee/leaves/apply', icon: FileTextIcon },
  { label: 'My Leaves', to: '/employee/leaves', icon: PlaneIcon }]

},
{
  label: 'Account',
  items: [
  { label: 'My Payslips', to: '/employee/payslips', icon: ReceiptIcon },
  { label: 'Notifications', to: '/employee/notifications', icon: BellIcon, badgeKey: 'notifications' },
  { label: 'My Profile', to: '/employee/profile', icon: UserIcon }]

},
{
  label: 'Bug Tracker',
  items: [
{ label: 'My Issues', to: '/employee/bug-tracker/my-issues', icon: UserCheckIcon },
  { label: 'Report a Bug', to: '/employee/bug-tracker/report', icon: AlertCircleIcon },
{ label: 'Kanban Board', to: '/employee/bug-tracker/board', icon: SquareKanbanIcon }]
}];


export const managementMobileTabs: NavItem[] = [
{ label: 'Home', to: '/management/dashboard', icon: LayoutDashboardIcon },
{ label: 'Hours', to: '/management/attendance', icon: CalendarCheckIcon },
{ label: 'Leave', to: '/management/leaves', icon: PlaneIcon },
{ label: 'Timesheets', to: '/management/timesheets', icon: ClipboardListIcon }];


export const employeeMobileTabs: NavItem[] = [
{ label: 'Home', to: '/employee/dashboard', icon: LayoutDashboardIcon },
{ label: 'Timer', to: '/employee/time-tracker', icon: TimerIcon },
{ label: 'Leave', to: '/employee/leaves', icon: PlaneIcon },
{ label: 'Payslips', to: '/employee/payslips', icon: ReceiptIcon }];
