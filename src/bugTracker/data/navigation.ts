import {
  BarChart3Icon,
  AlertCircleIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FolderKanbanIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  ListIcon,
  SettingsIcon,
  UserCheckIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  GaugeIcon } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RolePermissions } from '../types/bugTracker';

/** Resolve the Bug Tracker URL base for the current portal
 *  (management or employee) from the browser location, so links work from
 *  any bug-tracker sub-route without hardcoding /management or /employee. */
function portalBase(): string {
  const m = typeof window !== 'undefined' && window.location.pathname.match(/^\/(management|employee)\/bug-tracker/);
  return m ? m[0] : '/management/bug-tracker';
}

export const bugTrackerRoutes = {
  overview: portalBase(),
  issues: `${portalBase()}/issues`,
  issue: (key: string) => `${portalBase()}/issues/${key}`,
  myIssues: `${portalBase()}/my-issues`,
  report: `${portalBase()}/report`,
  board: `${portalBase()}/board`,
  team: `${portalBase()}/team`,
  qa: `${portalBase()}/qa`,
  reports: `${portalBase()}/reports`,
  settings: `${portalBase()}/settings`
};

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  permission?: keyof RolePermissions;
}

export const bugTrackerNav: NavItem[] = [
{ id: 'overview', label: 'Overview', to: bugTrackerRoutes.overview, icon: GaugeIcon, end: true },
{ id: 'issues', label: 'All Issues', to: bugTrackerRoutes.issues, icon: ListIcon },
{ id: 'my-issues', label: 'My Issues', to: bugTrackerRoutes.myIssues, icon: UserCheckIcon },
{ id: 'report', label: 'Report a Bug', to: bugTrackerRoutes.report, icon: AlertCircleIcon },
{ id: 'board', label: 'Kanban Board', to: bugTrackerRoutes.board, icon: KanbanSquareIcon },
{ id: 'team', label: 'Team & Assignments', to: bugTrackerRoutes.team, icon: UsersRoundIcon, permission: 'viewTeam' },
{ id: 'qa', label: 'QA Verification', to: bugTrackerRoutes.qa, icon: ClipboardCheckIcon, permission: 'viewQAQueue' },
{ id: 'reports', label: 'Reports & Analytics', to: bugTrackerRoutes.reports, icon: BarChart3Icon, permission: 'viewReports' },
{ id: 'settings', label: 'Tracker Settings', to: bugTrackerRoutes.settings, icon: SettingsIcon, permission: 'manageSettings' }];


// Existing Workforce modules — shown for context only, not part of this prototype.
export const workforceNav: {label: string;icon: LucideIcon;}[] = [
{ label: 'Dashboard', icon: LayoutDashboardIcon },
{ label: 'Employees', icon: UsersIcon },
{ label: 'Projects', icon: FolderKanbanIcon },
{ label: 'Time Tracking', icon: ClockIcon },
{ label: 'Leave', icon: CalendarDaysIcon },
{ label: 'Payroll', icon: WalletIcon }];