import { randomInt } from 'node:crypto';
import type { Employee } from '../shared/types';
import { hashPassword } from './auth';
import { UserModel } from './models';

/**
 * Account provisioning.
 *
 * Employee records and user accounts live in separate collections: an employee is a
 * person in the directory, an account is a credential that can sign in. Creating an
 * employee therefore also creates the account they use to sign in, and deactivating an
 * employee disables that account.
 */

const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // no l
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
const DIGITS = '23456789'; // no 0 or 1

/**
 * A random password that satisfies the sign-in policy (upper, lower and a digit, at
 * least eight characters). Ambiguous characters are left out so it can be read aloud
 * or copied reliably when handed to an employee.
 */
export function generatePassword(length = 12): string {
  const groups = [LOWER, UPPER, DIGITS];
  const all = groups.join('');
  const chars = groups.map((g) => g[randomInt(g.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Creates (or refreshes) the sign-in account that belongs to an employee record.
 *
 * A newly created account gets a generated password which is returned once; only its
 * hash is stored. Any other outcome returns no password.
 */
export async function provisionEmployeeAccount(employee: Employee, isNew: boolean): Promise<{ password?: string }> {
  const email = (employee.email ?? '').trim().toLowerCase();
  if (!email) return {};

  const existing = await UserModel.findOne({ $or: [{ employeeId: employee.id }, { email }] }).lean();
  if (existing) {
    await UserModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: employee.name,
          email,
          title: employee.designation,
          active: employee.status === 'Active'
        }
      }
    );
    return {};
  }

  if (!isNew) return {}; // never create a late account for an employee that already existed

  const password = generatePassword();
  await UserModel.create({
    _id: `u-${employee.id}`,
    name: employee.name,
    email,
    passwordHash: await hashPassword(password),
    role: 'employee',
    title: employee.designation,
    employeeId: employee.id,
    canManagePayroll: false,
    mustChangePassword: true,
    active: true
  });
  return { password };
}

/**
 * Issues a fresh temporary password for an existing employee account and forces a
 * change at next sign-in. Returns the plaintext once so management can hand it over.
 */
export async function resetEmployeePassword(employee: Employee): Promise<string> {
  const email = (employee.email ?? '').trim().toLowerCase();
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const result = await UserModel.updateOne(
    { $or: [{ employeeId: employee.id }, { email }] },
    { $set: { passwordHash, mustChangePassword: true, active: employee.status === 'Active' } }
  );
  if (result.matchedCount === 0) {
    await UserModel.create({
      _id: `u-${employee.id}`,
      name: employee.name,
      email,
      passwordHash,
      role: 'employee',
      title: employee.designation,
      employeeId: employee.id,
      canManagePayroll: false,
      mustChangePassword: true,
      active: employee.status === 'Active'
    });
  }
  return password;
}

/** Disables the account of a deactivated employee (and re-enables it when reactivated). */
export async function setEmployeeAccountActive(employee: Employee, active: boolean): Promise<void> {
  await UserModel.updateOne({ employeeId: employee.id }, { $set: { active } });
}
