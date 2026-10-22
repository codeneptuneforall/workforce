import type { Role } from '../types';

/** An account created by the seed script. */
export interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  employeeId?: string;
  canManagePayroll: boolean;
}
