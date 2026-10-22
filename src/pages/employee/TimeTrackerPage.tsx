import { SessionsTable } from '../../components/shared/SessionsTable';
import { DailyTargetCard } from '../../components/time/DailyTargetCard';
import { PageHeader, Panel } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useNow } from '../../hooks/useNow';
import { dayKey } from '@shared/domain/compliance';
import { fmtMin, todayKey } from '@shared/domain/time';

export function TimeTrackerPage() {
  const emp = useCurrentEmployee();
  const { ctx, state } = useData();
  const now = useNow(30000);
  const today = todayKey(now);
  const sessions = ctx.sessionsByKey.get(dayKey(emp.id, today)) ?? [];
  const rules = [
  'You can start and stop work at any time of the day — there is no fixed start or end time.',
  `By the end of the day you must have completed ${fmtMin(state.settings.dailyTargetMinutes)} of tracked time.`,
  'Only active time counts toward your daily target — paused time is excluded.',
  state.settings.allowOverlap ? 'Overlapping timers are allowed by company policy.' : 'One timer at a time. Pause or end the current session before starting another.',
  'Ending a session never marks the task complete.',
  'If you refresh or sign out, a running timer is restored from its saved start time.',
  `Your day’s shortfall is only final after ${state.settings.dayEndTime}.`];

  return (
    <div>
      <PageHeader title="Time Tracker" description="Pick a project, choose a new or existing task, describe the work, then start the timer." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DailyTargetCard employee={emp} />
        </div>
        <Panel title="How time is counted" className="lg:col-span-2 self-start">
          <ul className="space-y-3">
            {rules.map((r) =>
            <li key={r} className="flex gap-3 text-sm text-ink-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                {r}
              </li>
            )}
          </ul>
        </Panel>
      </div>
      <Panel title="Today’s sessions" className="mt-6" flush>
        <SessionsTable sessions={sessions} emptyTitle="No sessions yet today" />
      </Panel>
    </div>);

}