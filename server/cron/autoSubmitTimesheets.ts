import cron from 'node-cron';
import { connectDatabase, disconnectDatabase } from '../db';
import { EmployeeModel } from '../models';
import { TimesheetModel } from '../models';
import { SessionModel } from '../models';
import { weekStartKey, weekDates, todayKey } from '@shared/domain/time';

/**
 * Auto-submit timesheets for weeks that have ended and have no incomplete sessions.
 * Runs on server startup (to catch existing weeks) and every Saturday at 00:00.
 *
 * Eligibility:
 *   - Timesheet status is 'Draft'
 *   * Week has ended (Sunday of that week is before today)
 *   - No incomplete sessions (Interrupted, or Working/Paused with date in the past)
 */
async function autoSubmitTimesheets(): Promise<{ submitted: number; skipped: number }> {
  await connectDatabase();
  let submitted = 0;
  let skipped = 0;

  try {
    const today = todayKey(); // YYYY-MM-DD

    // ── 1) Existing Draft timesheets that should be submitted ──────────────
    const draftTimesheets = await TimesheetModel.find({ status: 'Draft' }).lean();

    // Get all active employees (for names in logs)
    const employees = await EmployeeModel.find({ status: 'Active' }).lean();
    const employeeMap = new Map(employees.map((e: any) => [e._id, e]));

    // Get all work sessions, grouped by employeeId + weekStart
    const sessions = await SessionModel.find({}).lean();
    const sessionsByEmpWeek = new Map<string, any[]>();
    for (const s of sessions) {
      const wk = weekStartKey(s.date);
      const key = `${s.employeeId}|${wk}`;
      if (!sessionsByEmpWeek.has(key)) sessionsByEmpWeek.set(key, []);
      sessionsByEmpWeek.get(key)!.push(s);
    }

    for (const ts of draftTimesheets) {
      const emp = employeeMap.get(ts.employeeId);
      if (!emp) {
        skipped++;
        continue;
      }

      // Check if week has ended (Sunday of that week is before today)
      const weekEndDates = weekDates(ts.weekStart);
      const weekEnd = weekEndDates[weekEndDates.length - 1]; // Sunday
      if (weekEnd >= today) {
        skipped++; // Week not ended yet
        continue;
      }

      // Check for incomplete sessions in this week
      const key = `${ts.employeeId}|${ts.weekStart}`;
      const weekSessions = sessionsByEmpWeek.get(key) || [];

      const hasIncomplete = weekSessions.some((s) => {
        if (s.status === 'Interrupted') return true;
        if ((s.status === 'Working' || s.status === 'Paused') && s.date < today) return true;
        return false;
      });

      if (hasIncomplete) {
        skipped++;
        continue;
      }

      // Submit the timesheet
      await TimesheetModel.updateOne(
        { _id: ts._id },
        {
          $set: {
            status: 'Submitted',
            submittedAt: new Date().toISOString(),
          },
          $push: {
            history: {
              id: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              actorId: 'system',
              message: 'Auto-submitted by system (week ended)',
              createdAt: new Date().toISOString(),
            },
          },
        }
      );

      submitted++;
      console.log(
        `[auto-submit] Submitted timesheet ${ts._id} for employee ${emp.name} (${ts.employeeId}) week ${ts.weekStart}`
      );
    }

    // ── 2) Employees with sessions but NO timesheet record for ended weeks ─
    const empWeekSessions = new Map<string, any[]>();
    for (const s of sessions) {
      const wk = weekStartKey(s.date);
      const weekEnd = weekDates(wk)[weekDates(wk).length - 1];
      if (weekEnd >= today) continue; // Week not ended yet

      const key = `${s.employeeId}|${wk}`;
      if (!empWeekSessions.has(key)) empWeekSessions.set(key, []);
      empWeekSessions.get(key)!.push(s);
    }

    const existingTsKeys = new Set(draftTimesheets.map((t) => `${t.employeeId}|${t.weekStart}`));

    for (const [key, weekSessions] of empWeekSessions.entries()) {
      if (existingTsKeys.has(key)) continue; // Already has a timesheet record

      const [employeeId, weekStart] = key.split('|');
      const emp = employeeMap.get(employeeId);
      if (!emp) continue;

      // Check for incomplete sessions
      const hasIncomplete = weekSessions.some((s) => {
        if (s.status === 'Interrupted') return true;
        if ((s.status === 'Working' || s.status === 'Paused') && s.date < today) return true;
        return false;
      });

      if (hasIncomplete) continue;

      // Create and submit the timesheet
      const tsId = `ts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      await TimesheetModel.create({
        _id: tsId,
        employeeId,
        weekStart,
        status: 'Submitted',
        submittedAt: new Date().toISOString(),
        history: [
          {
            id: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            actorId: 'system',
            message: 'Auto-submitted by system (week ended)',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      submitted++;
      console.log(
        `[auto-submit] Created and submitted timesheet ${tsId} for employee ${emp.name} (${employeeId}) week ${weekStart}`
      );
    }

    console.log(`[auto-submit] Complete: ${submitted} submitted, ${skipped} skipped`);
    return { submitted, skipped };
  } finally {
    await disconnectDatabase();
  }
}

/**
 * Start the auto-submit cron job.
 * Runs immediately on startup to catch existing weeks, then every Saturday at 00:00.
 */
export function startAutoSubmitCron(): void {
  // Run immediately on startup to catch existing weeks
  autoSubmitTimesheets().catch((err) => console.error('[auto-submit] Startup run failed:', err));

  // Schedule every Saturday at 00:00 (midnight)
  cron.schedule('0 0 * * 6', async () => {
    console.log('[auto-submit] Running scheduled Saturday submission...');
    await autoSubmitTimesheets();
  });

  console.log('[auto-submit] Cron scheduled: every Saturday at 00:00');
}

export default autoSubmitTimesheets;