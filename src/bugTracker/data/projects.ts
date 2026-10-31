import type { Project } from '../types/bugTracker';

// Sample Workforce projects. Real project IDs come from the Workforce Projects module.
export const projects: Project[] = [
{ id: 'p-time', name: 'Time Tracking', code: 'TIME', leadId: 'emp-rahul' },
{ id: 'p-leave', name: 'Leave Management', code: 'LEAVE', leadId: 'emp-meera' },
{ id: 'p-payroll', name: 'Payroll', code: 'PAY', leadId: 'emp-karthik' },
{ id: 'p-directory', name: 'Employee Directory', code: 'DIR', leadId: 'emp-meera' },
{ id: 'p-mobile', name: 'Workforce Mobile', code: 'MOB', leadId: 'emp-ananya' }];