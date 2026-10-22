import type { SeedUser } from './types';

/**
 * Accounts created by the seed script. Passwords are never stored here — the seed
 * script hashes a single password from the environment for every account it creates.
 */
export const users: SeedUser[] = [
{
  id: 'u-neha',
  name: 'Neha Kapoor',
  email: 'neha.kapoor@codeneptune.in',
  role: 'management',
  title: 'HR & Payroll Manager',
  canManagePayroll: true
},
{
  id: 'u-arjun',
  name: 'Arjun Mehta',
  email: 'arjun.mehta@codeneptune.in',
  role: 'management',
  title: 'Engineering Manager',
  canManagePayroll: false
},
{
  id: 'u-priya',
  name: 'Priya Sharma',
  email: 'priya.sharma@codeneptune.in',
  role: 'employee',
  title: 'Frontend Developer',
  employeeId: 'e1',
  canManagePayroll: false
},
{
  id: 'u-rahul',
  name: 'Rahul Verma',
  email: 'rahul.verma@codeneptune.in',
  role: 'employee',
  title: 'Senior Backend Developer',
  employeeId: 'e2',
  canManagePayroll: false
}];
