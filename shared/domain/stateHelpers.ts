import type { AppState, AuditEntry, Tone } from '../types';
import { uid } from './random';

export type Mutation = AppState | {error: string;};
export type Mutator = (s: AppState, actor: string, now: number) => Mutation;

export const isoNow = (now: number): string => new Date(now).toISOString();

export function withAudit(
s: AppState,
now: number,
entry: Omit<AuditEntry, 'id' | 'at'>)
: AppState {
  return { ...s, audit: [{ ...entry, id: uid('a'), at: isoNow(now) }, ...s.audit] };
}

export function withNotification(
s: AppState,
now: number,
n: {audience: string;title: string;body: string;link: string;tone: Tone;})
: AppState {
  return {
    ...s,
    notifications: [{ ...n, id: uid('n'), createdAt: isoNow(now), read: false }, ...s.notifications]
  };
}

export function fail(error: string): {error: string;} {
  return { error };
}