import type { Project, Task, Team } from '../types';

export const teams: Team[] = [
{ id: 't1', name: 'Product Engineering', description: 'Builds and maintains client and internal product platforms.', leadId: 'e2', status: 'Active' },
{ id: 't2', name: 'Design', description: 'Product design, UX research and the shared design system.', leadId: 'e3', status: 'Active' },
{ id: 't3', name: 'Platform & QA', description: 'Infrastructure, release pipelines and quality assurance.', leadId: 'e6', status: 'Active' }];


export const projects: Project[] = [
{ id: 'p1', name: 'Neptune HRMS', code: 'NHR', description: 'Internal HR and workforce platform.', managerId: 'e2', teamIds: ['t1', 't2'], employeeIds: ['e1', 'e2', 'e3', 'e5', 'e8'], startDate: '2026-04-01', endDate: '2026-12-15', estimatedHours: 2400, status: 'Active', notes: 'Phase 2 covers leave and payroll modules.' },
{ id: 'p2', name: 'Aqua Commerce App', code: 'ACA', description: 'Mobile-first commerce app for a retail client.', client: 'BlueWave Retail (sample)', managerId: 'e2', teamIds: ['t1', 't3'], employeeIds: ['e1', 'e4', 'e5', 'e6', 'e7'], startDate: '2026-06-15', endDate: '2027-01-31', estimatedHours: 1800, status: 'Active' },
{ id: 'p3', name: 'Cloud Cost Dashboard', code: 'CCD', description: 'Internal visibility into cloud spend.', managerId: 'e6', teamIds: ['t3'], employeeIds: ['e6', 'e4'], startDate: '2026-08-01', endDate: '2026-11-30', estimatedHours: 600, status: 'Active' },
{ id: 'p4', name: 'Atlas Analytics', code: 'ATL', description: 'Analytics workspace for operations teams.', managerId: 'e3', teamIds: ['t2'], employeeIds: ['e3', 'e7'], startDate: '2026-07-01', endDate: '2026-12-31', status: 'On Hold', notes: 'Paused pending client scope confirmation.' },
{ id: 'p5', name: 'Legacy Portal Migration', code: 'LPM', description: 'Migration of the old customer portal.', managerId: 'e2', teamIds: ['t1'], employeeIds: ['e2', 'e8'], startDate: '2025-10-01', endDate: '2026-03-31', estimatedHours: 900, status: 'Archived' }];


export const tasks: Task[] = [
{ id: 'k1', title: 'Leave application form UI', description: 'Build the apply-for-leave form with validation.', projectId: 'p1', assigneeId: 'e1', priority: 'High', startDate: '2026-09-01', dueDate: '2026-11-07', status: 'In Progress' },
{ id: 'k2', title: 'Payslip PDF layout', description: 'A4 payslip layout matching the company reference.', projectId: 'p1', assigneeId: 'e1', priority: 'Medium', startDate: '2026-10-01', dueDate: '2026-11-20', status: 'To Do' },
{ id: 'k3', title: 'Product listing performance fixes', description: 'Reduce listing render time on low-end devices.', projectId: 'p2', assigneeId: 'e1', priority: 'Medium', startDate: '2026-09-10', dueDate: '2026-11-01', status: 'In Progress' },
{ id: 'k4', title: 'Attendance API endpoints', description: 'Endpoints for attendance and compliance data.', projectId: 'p1', assigneeId: 'e2', priority: 'High', startDate: '2026-09-01', dueDate: '2026-10-31', status: 'In Progress' },
{ id: 'k5', title: 'Role-based access middleware', description: 'Server-side permission checks per route.', projectId: 'p1', assigneeId: 'e2', priority: 'High', startDate: '2026-08-15', dueDate: '2026-09-30', status: 'Completed' },
{ id: 'k6', title: 'Design system tokens', description: 'Shared colour, type and spacing tokens.', projectId: 'p1', assigneeId: 'e3', priority: 'Medium', startDate: '2026-09-01', dueDate: '2026-11-15', status: 'In Progress' },
{ id: 'k7', title: 'Checkout flow redesign', description: 'Simplify the three-step checkout.', projectId: 'p2', assigneeId: 'e7', priority: 'High', startDate: '2026-09-15', dueDate: '2026-11-10', status: 'In Progress' },
{ id: 'k8', title: 'Regression test suite', description: 'Automated regression coverage for releases.', projectId: 'p2', assigneeId: 'e4', priority: 'Medium', startDate: '2026-09-01', dueDate: '2026-12-01', status: 'In Progress' },
{ id: 'k9', title: 'Push notification module', description: 'Waiting on client notification provider decision.', projectId: 'p2', assigneeId: 'e5', priority: 'Low', startDate: '2026-09-20', dueDate: '2026-11-30', status: 'Blocked' },
{ id: 'k10', title: 'Offline cart sync', description: 'Persist cart changes while offline.', projectId: 'p2', assigneeId: 'e5', priority: 'High', startDate: '2026-09-01', dueDate: '2026-11-05', status: 'In Progress' },
{ id: 'k11', title: 'Cost anomaly alerts', description: 'Alert on unusual daily cloud spend.', projectId: 'p3', assigneeId: 'e6', priority: 'Medium', startDate: '2026-09-01', dueDate: '2026-11-15', status: 'In Progress' },
{ id: 'k12', title: 'Kubernetes cluster upgrade', description: 'Upgrade staging and production clusters.', projectId: 'p3', assigneeId: 'e6', priority: 'High', startDate: '2026-10-01', dueDate: '2026-11-25', status: 'To Do' },
{ id: 'k13', title: 'API load testing', description: 'Load test the attendance APIs.', projectId: 'p3', assigneeId: 'e4', priority: 'Medium', startDate: '2026-10-05', dueDate: '2026-11-20', status: 'To Do' },
{ id: 'k14', title: 'Analytics dashboard wireframes', description: 'On hold with the project.', projectId: 'p4', assigneeId: 'e3', priority: 'Low', startDate: '2026-07-10', dueDate: '2026-10-30', status: 'Blocked' },
{ id: 'k15', title: 'Timesheet export', description: 'CSV export of weekly timesheets.', projectId: 'p1', assigneeId: 'e8', priority: 'Low', startDate: '2026-08-01', dueDate: '2026-09-15', status: 'Completed' },
{ id: 'k16', title: 'Design QA for HRMS', description: 'Review implemented screens against designs.', projectId: 'p1', assigneeId: 'e7', priority: 'Medium', startDate: '2026-09-01', dueDate: '2026-12-01', status: 'In Progress' }];