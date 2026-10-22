import type { AppState } from '../types';
import { MINUTE, sessionActiveMs, weekStartKey } from './time';

/**
 * The numbers behind a project: who worked on it, how long they were on it and which
 * task swallowed the time.
 *
 * The computation is pure and lives in the domain, so the management screens, the
 * reports and any future export all read the same figures.
 */

/** How one person contributed to a project. */
export interface ContributorStat {
  employeeId: string;
  minutes: number;
  sessions: number;
  /** The longest single session this person recorded on the project. */
  longestSessionMinutes: number;
  averageSessionMinutes: number;
  firstDate: string;
  lastDate: string;
  /** Share of the project's total time, 0–1. */
  share: number;
}

/** How much time one task took. */
export interface TaskTimeStat {
  taskId: string;
  title: string;
  minutes: number;
  sessions: number;
  longestSessionMinutes: number;
  averageSessionMinutes: number;
  /** Share of the project's total time, 0–1. */
  share: number;
}

export interface ProjectStats {
  totalMinutes: number;
  sessionCount: number;
  contributorCount: number;
  /** How many of the project's tasks carry time. */
  tasksTouched: number;
  averageSessionMinutes: number;
  longestSessionMinutes: number;
  /** People, most time first. */
  contributors: ContributorStat[];
  /** Tasks, most time first. */
  tasks: TaskTimeStat[];
  /** Hours per week, oldest first. */
  weekly: { week: string; minutes: number; }[];
  /** Hours per day, oldest first. */
  daily: { date: string; minutes: number; }[];
}

/**
 * Reads the time recorded on one project.
 *
 * `since` is a `yyyy-MM-dd` key — sessions before that day are left out, which is how
 * the period filter on the project screen works.
 */
export function projectStats(state: AppState, projectId: string, since?: string, now: number = Date.now()): ProjectStats {
  const sessions = state.sessions.filter((s) => s.projectId === projectId && (!since || s.date >= since));
  const minutesOf = (s: (typeof sessions)[number]) => Math.floor(sessionActiveMs(s, now) / MINUTE);

  let totalMinutes = 0;
  let longestSessionMinutes = 0;
  const people = new Map<string, { minutes: number; sessions: number; longest: number; first: string; last: string; }>();
  const taskTimes = new Map<string, { minutes: number; sessions: number; longest: number; }>();
  const weeks = new Map<string, number>();
  const days = new Map<string, number>();

  for (const s of sessions) {
    const m = minutesOf(s);
    totalMinutes += m;
    longestSessionMinutes = Math.max(longestSessionMinutes, m);

    const person = people.get(s.employeeId) ?? { minutes: 0, sessions: 0, longest: 0, first: s.date, last: s.date };
    person.minutes += m;
    person.sessions += 1;
    person.longest = Math.max(person.longest, m);
    if (s.date < person.first) person.first = s.date;
    if (s.date > person.last) person.last = s.date;
    people.set(s.employeeId, person);

    if (s.taskId) {
      const t = taskTimes.get(s.taskId) ?? { minutes: 0, sessions: 0, longest: 0 };
      t.minutes += m;
      t.sessions += 1;
      t.longest = Math.max(t.longest, m);
      taskTimes.set(s.taskId, t);
    }

    const week = weekStartKey(s.date);
    weeks.set(week, (weeks.get(week) ?? 0) + m);
    days.set(s.date, (days.get(s.date) ?? 0) + m);
  }

  const contributors: ContributorStat[] = [...people.entries()]
    .map(([employeeId, p]) => ({
      employeeId,
      minutes: p.minutes,
      sessions: p.sessions,
      longestSessionMinutes: p.longest,
      averageSessionMinutes: p.sessions ? Math.round(p.minutes / p.sessions) : 0,
      firstDate: p.first,
      lastDate: p.last,
      share: totalMinutes ? p.minutes / totalMinutes : 0
    }))
    .sort((a, b) => b.minutes - a.minutes || a.employeeId.localeCompare(b.employeeId));

  const tasks: TaskTimeStat[] = [...taskTimes.entries()]
    .map(([taskId, t]) => ({
      taskId,
      title: state.tasks.find((x) => x.id === taskId)?.title ?? 'Untitled task',
      minutes: t.minutes,
      sessions: t.sessions,
      longestSessionMinutes: t.longest,
      averageSessionMinutes: t.sessions ? Math.round(t.minutes / t.sessions) : 0,
      share: totalMinutes ? t.minutes / totalMinutes : 0
    }))
    .sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title));

  const weekly = [...weeks.entries()].map(([week, minutes]) => ({ week, minutes })).sort((a, b) => a.week.localeCompare(b.week));
  const daily = [...days.entries()].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalMinutes,
    sessionCount: sessions.length,
    contributorCount: contributors.length,
    tasksTouched: tasks.length,
    averageSessionMinutes: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
    longestSessionMinutes,
    contributors,
    tasks,
    weekly,
    daily
  };
}
