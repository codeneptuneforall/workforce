import { addDays, endOfMonth, format, parseISO, startOfWeek } from 'date-fns';
import type { WorkSession } from '../types';

export const MINUTE = 60_000;

export const toDateKey = (d: Date): string => format(d, 'yyyy-MM-dd');

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = (now: number = Date.now()): string => toDateKey(new Date(now));

export function fmtMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${String(r).padStart(2, '0')}m`;
}

export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor(t % 3600 / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export const fmtTime = (iso?: string): string => iso ? format(parseISO(iso), 'HH:mm') : '—';
export const fmtDate = (key: string, pattern = 'd MMM yyyy'): string => format(fromDateKey(key), pattern);
export const fmtDateTime = (iso: string): string => format(parseISO(iso), 'd MMM yyyy, HH:mm');

export const weekStartKey = (key: string): string =>
toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn: 1 }));

export const weekDates = (weekStart: string): string[] =>
Array.from({ length: 7 }, (_, i) => toDateKey(addDays(fromDateKey(weekStart), i)));

export function eachDateKey(start: string, end: string): string[] {
  const out: string[] = [];
  let d = fromDateKey(start);
  const last = fromDateKey(end);
  while (d <= last && out.length < 800) {
    out.push(toDateKey(d));
    d = addDays(d, 1);
  }
  return out;
}

export function monthDates(month: string): string[] {
  const start = fromDateKey(`${month}-01`);
  return eachDateKey(toDateKey(start), toDateKey(endOfMonth(start)));
}

export function unionMs(ranges: [number, number][]): number {
  if (!ranges.length) return 0;
  const sorted = [...ranges].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of sorted) {
    if (!cur) cur = [...r] as [number, number];else
    if (r[0] <= cur[1]) cur[1] = Math.max(cur[1], r[1]);else
    {
      total += cur[1] - cur[0];
      cur = [...r] as [number, number];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

export function sessionRanges(s: WorkSession, now: number): [number, number][] {
  const isLiveToday = s.status === 'Working' && s.date === todayKey(now);
  const out: [number, number][] = [];
  for (const iv of s.intervals) {
    const st = +new Date(iv.start);
    if (iv.end) out.push([st, +new Date(iv.end)]);else
    if (isLiveToday) out.push([st, now]);
  }
  return out;
}

export const sessionActiveMs = (s: WorkSession, now: number): number => unionMs(sessionRanges(s, now));

export function sessionStartIso(s: WorkSession): string | undefined {
  return s.intervals[0]?.start;
}

export function sessionEndIso(s: WorkSession): string | undefined {
  if (s.status !== 'Completed') return undefined;
  return s.intervals[s.intervals.length - 1]?.end;
}

export function sessionPausedMs(s: WorkSession, now: number): number {
  if (!s.intervals.length) return 0;
  const first = +new Date(s.intervals[0].start);
  const live = (s.status === 'Working' || s.status === 'Paused') && s.date === todayKey(now);
  const lastClosed = [...s.intervals].reverse().find((i) => i.end)?.end;
  const lastEnd = live ? now : lastClosed ? +new Date(lastClosed) : first;
  return Math.max(0, lastEnd - first - sessionActiveMs(s, now));
}

export function parseHM(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (min > 59 || h > 24) return null;
  return h * 60 + min;
}

export function toHM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}