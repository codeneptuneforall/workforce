import type { Employee } from '../types/bugTracker';

// Sample people for the prototype only. Real Workforce employee IDs will differ.
export const employees: Employee[] = [
{ id: 'emp-priya', name: 'Priya Raman', initials: 'PR', title: 'Workforce Administrator', email: 'priya.raman@codeneptune.com', teamId: 'team-platform', role: 'admin', projectIds: ['p-time', 'p-leave', 'p-payroll', 'p-directory', 'p-mobile'] },
{ id: 'emp-arjun', name: 'Arjun Mehta', initials: 'AM', title: 'Engineering Manager', email: 'arjun.mehta@codeneptune.com', teamId: 'team-platform', role: 'manager', projectIds: ['p-time', 'p-leave', 'p-payroll', 'p-directory'] },
{ id: 'emp-rahul', name: 'Rahul Verma', initials: 'RV', title: 'Senior Frontend Developer', email: 'rahul.verma@codeneptune.com', teamId: 'team-platform', role: 'developer', projectIds: ['p-time', 'p-leave', 'p-payroll'] },
{ id: 'emp-meera', name: 'Meera Iyer', initials: 'MI', title: 'Backend Developer', email: 'meera.iyer@codeneptune.com', teamId: 'team-platform', role: 'developer', projectIds: ['p-time', 'p-leave', 'p-directory'] },
{ id: 'emp-karthik', name: 'Karthik Nair', initials: 'KN', title: 'Full-stack Developer', email: 'karthik.nair@codeneptune.com', teamId: 'team-payroll', role: 'developer', projectIds: ['p-payroll', 'p-time'] },
{ id: 'emp-ananya', name: 'Ananya Das', initials: 'AD', title: 'Mobile Developer', email: 'ananya.das@codeneptune.com', teamId: 'team-mobile', role: 'developer', projectIds: ['p-mobile'] },
{ id: 'emp-neha', name: 'Neha Joshi', initials: 'NJ', title: 'Mobile Team Lead', email: 'neha.joshi@codeneptune.com', teamId: 'team-mobile', role: 'manager', projectIds: ['p-mobile', 'p-directory'] },
{ id: 'emp-sneha', name: 'Sneha Kapoor', initials: 'SK', title: 'QA Engineer', email: 'sneha.kapoor@codeneptune.com', teamId: 'team-qa', role: 'qa', projectIds: ['p-time', 'p-leave', 'p-payroll', 'p-directory', 'p-mobile'] },
{ id: 'emp-vikram', name: 'Vikram Singh', initials: 'VS', title: 'QA Analyst', email: 'vikram.singh@codeneptune.com', teamId: 'team-qa', role: 'qa', projectIds: ['p-time', 'p-leave', 'p-payroll', 'p-directory', 'p-mobile'] },
{ id: 'emp-daniel', name: 'Daniel Brooks', initials: 'DB', title: 'HR Operations Lead', email: 'daniel.brooks@codeneptune.com', teamId: 'team-people', role: 'reporter', projectIds: ['p-leave', 'p-payroll', 'p-directory', 'p-time'] }];