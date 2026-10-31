/**
 * Bug Tracker utility functions.
 *
 * Issue data access is handled by `api/bugTrackerApi.ts` (Workforce API).
 * This module retains only the `createId` helper used by the client context.
 */

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
