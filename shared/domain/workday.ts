/**
 * The company workday: office hours and the three fixed breaks.
 *
 * Kept in one place so the reminder card, the browser notification and any future
 * report all agree on the same times. Times are the company's local wall clock,
 * formatted as 24-hour `HH:MM`.
 */

export type BreakKind = 'break' | 'lunch';

export interface WorkdayBreak {
  id: string;
  label: string;
  kind: BreakKind;
  /** When the break starts, 24-hour `HH:MM`. */
  start: string;
  /** How long the break lasts, in minutes. */
  minutes: number;
}

export const OFFICE_HOURS = { start: '10:00', end: '19:00' } as const;

export const WORKDAY_BREAKS: WorkdayBreak[] = [
  { id: 'break-first', label: 'First break', kind: 'break', start: '12:00', minutes: 15 },
  { id: 'lunch', label: 'Lunch break', kind: 'lunch', start: '14:00', minutes: 45 },
  { id: 'break-second', label: 'Second break', kind: 'break', start: '17:00', minutes: 15 }
];

/** How many minutes before a break the reminder fires. */
export const REMINDER_LEAD_MINUTES = 5;

/**
 * How long after its scheduled minute a reminder can still fire. This covers a
 * laptop waking up, a tab becoming visible again, or the app being opened at 12:02.
 */
export const REMINDER_GRACE_MINUTES = 2;

export interface DueReminder extends WorkdayBreak {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  /** Unique per day, used to remember that a reminder already fired. */
  key: string;
  /** Minutes from midnight when the reminder is due. */
  reminderAt: number;
  /** Minutes from midnight when the break starts. */
  startsAt: number;
  /** Minutes from midnight when the break ends. */
  endsAt: number;
  /** Minutes left until the break starts (0 while the grace window is open). */
  minutesLeft: number;
}

/** Minutes from midnight for a 24-hour `HH:MM` string. */
export function clockMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A local `YYYY-MM-DD` key. */
export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Minutes from midnight, including the fraction of the current minute. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** `HH:MM` for a count of minutes from midnight. */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Reminders whose 5-minutes-before moment is now (or was, within the grace window)
 * and that have not fired yet today.
 */
export function dueBreakReminders(now: Date, fired: Iterable<string> = []): DueReminder[] {
  const day = dayKeyOf(now);
  const done = new Set(fired);
  const minute = minutesOfDay(now);

  return WORKDAY_BREAKS.flatMap((b) => {
    const startsAt = clockMinutes(b.start);
    const reminderAt = startsAt - REMINDER_LEAD_MINUTES;
    const key = `${day}:${b.id}`;
    if (done.has(key)) return [];
    if (minute < reminderAt || minute >= reminderAt + REMINDER_GRACE_MINUTES) return [];
    return [{
      ...b,
      day,
      key,
      reminderAt,
      startsAt,
      endsAt: startsAt + b.minutes,
      minutesLeft: Math.max(0, Math.ceil(startsAt - minute))
    }];
  });
}

/** The next break that has not started yet, used for the "up next" hint. */
export function nextBreak(now: Date): WorkdayBreak | null {
  const minute = minutesOfDay(now);
  return WORKDAY_BREAKS.find((b) => minute < clockMinutes(b.start)) ?? null;
}
