import type { SeedUser } from './types';

/**
 * Accounts created by the seed script. Passwords are never stored here — the seed
 * script hashes a single password from the environment for every account it creates.
 */
export const users: SeedUser[] = [
{
  id: 'u-neha',
  name: 'Neha Kapoor',
  email: 'neha.kapoor@example.com',
  role: 'management',
  title: 'HR & Payroll Manager',
  canManagePayroll: true
},
{
  id: 'u-arjun',
  name: 'Arjun Mehta',
  email: 'arjun.mehta@example.com',
  role: 'management',
  title: 'Engineering Manager',
  canManagePayroll: true
},
{
  id: 'u-priya',
  name: 'Priya Sharma',
  email: 'priya.sharma@example.com',
  role: 'employee',
  title: 'Frontend Developer',
  employeeId: 'e1',
  canManagePayroll: false
},
{
  id: 'u-rahul',
  name: 'Rahul Verma',
  email: 'rahul.verma@example.com',
  role: 'employee',
  title: 'Senior Backend Developer',
  employeeId: 'e2',
  canManagePayroll: false
}];
