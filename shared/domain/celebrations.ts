import type { Employee } from '../types';

/**
 * Birthday helpers.
 *
 * A birthday only depends on the month and day, so the stored year is ignored.
 * `dateOfBirth` is a plain `YYYY-MM-DD` string and is parsed as local time, which
 * keeps the comparison stable no matter what the browser's timezone is.
 */

/** `MM-DD` for a date string or Date. Returns '' for anything unparseable. */
export function monthDayKey(value: string | Date | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : value;
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Active employees whose birthday falls on `now`'s calendar day. */
export function birthdaysOn(employees: Employee[], now: Date = new Date()): Employee[] {
  const today = monthDayKey(now);
  if (!today) return [];
  return employees.filter(
    (e) => e.status === 'Active' && !!e.dateOfBirth && monthDayKey(e.dateOfBirth) === today
  );
}

/** How old the person turns today, or undefined when the birth year is unknown. */
export function turningAge(dateOfBirth: string | undefined, now: Date = new Date()): number | undefined {
  if (!dateOfBirth) return undefined;
  const born = new Date(`${dateOfBirth.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(born.getTime())) return undefined;
  const age = now.getFullYear() - born.getFullYear();
  return age > 0 && age < 130 ? age : undefined;
}
