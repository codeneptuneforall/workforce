import type { Role } from '../types/bugTracker';

// UI preview only — this is NOT authentication. Each role maps to a sample person.
export const rolePreviews: {role: Role;label: string;userId: string;summary: string;}[] = [
{ role: 'admin', label: 'Admin', userId: 'emp-priya', summary: 'Configures the tracker, manages access and settings' },
{ role: 'manager', label: 'Team Leader / Manager', userId: 'emp-arjun', summary: 'Triages, assigns developers, sets priority and due dates' },
{ role: 'developer', label: 'Developer / Employee', userId: 'emp-rahul', summary: 'Works assigned issues, comments and submits fixes' },
{ role: 'qa', label: 'QA / Tester', userId: 'emp-sneha', summary: 'Verifies fixes, passes or fails, reopens with reasons' },
{ role: 'reporter', label: 'Reporter', userId: 'emp-daniel', summary: 'Submits bugs, tracks own reports, adds clarifications' }];