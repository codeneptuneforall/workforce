import cron from 'node-cron';
import { SessionModel } from '../models';
import { invalidateCache } from '../store';
import { isBreakTime } from '@shared/domain/workday';
import { WORKDAY_BREAKS } from '@shared/domain/workday';
import { clockMinutes, nowIST, minutesOfDayIST } from '@shared/domain/workday';

/**
 * Auto-pause any running sessions during break hours (IST).
 * Runs every minute. Pauses all Working sessions when the current IST time
 * falls inside a break window, so timers don't keep running through lunch
 * or breaks even when no API request is made.
 */
async function autoPauseDuringBreaks(): Promise<{ paused: number }> {
  if (!isBreakTime(Date.now())) return { paused: 0 };

  const now = new Date();
  const ist = nowIST(now.getTime());
  const minute = minutesOfDayIST(ist);

  // Find the active break window
  const activeBreak = WORKDAY_BREAKS.find((b) => {
    const startsAt = clockMinutes(b.start);
    const endsAt = startsAt + b.minutes;
    return minute >= startsAt && minute < endsAt;
  });
  if (!activeBreak) return { paused: 0 };

  const isoNow = now.toISOString();

  // Find all Working sessions and pause them
  const workingSessions = await SessionModel.find({ status: 'Working' }).lean();
  let paused = 0;

  for (const session of workingSessions) {
    const intervals = (session.intervals ?? []).map((iv: any, i: number) => {
      const last = i === (session.intervals ?? []).length - 1 && !iv.end;
      return last ? { ...iv, end: isoNow } : iv;
    });

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { status: 'Paused', intervals } }
    );
    paused++;
  }

  if (paused > 0) {
    invalidateCache();
    const startsAt = clockMinutes(activeBreak.start);
    console.log(`[auto-pause] Paused ${paused} session(s) during ${activeBreak.label} (${startsAt}–${startsAt + activeBreak.minutes})`);
  }

  return { paused };
}

/**
 * Start the auto-pause cron job. Runs every minute to check break windows.
 */
export function startAutoPauseCron(): void {
  // Run immediately on startup to catch any sessions left running
  autoPauseDuringBreaks().catch((err) => console.error('[auto-pause] Startup run failed:', err));

  // Schedule every minute
  cron.schedule('* * * * *', async () => {
    await autoPauseDuringBreaks().catch((err) => console.error('[auto-pause] Scheduled run failed:', err));
  });

  console.log('[auto-pause] Cron scheduled: every minute');
}

export default autoPauseDuringBreaks;
