import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRingIcon, CoffeeIcon, UtensilsCrossedIcon, XIcon } from 'lucide-react';
import { isScheduled } from '@shared/domain/compliance';
import { dayKeyOf, dueBreakReminders, REMINDER_LEAD_MINUTES, type DueReminder } from '@shared/domain/workday';
import { todayKey } from '@shared/domain/time';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Button } from '../ui/Button';

/**
 * Bearings for the reminder clock.
 *
 * The in-app card and the browser notification are two views of the same event:
 * `dueBreakReminders` says what is five minutes away, and a per-day key in
 * `localStorage` keeps a reload from announcing it twice.
 */
export function BreakReminder() {
  const { user } = useAuth();
  const { state } = useData();
  const [reminder, setReminder] = useState<DueReminder | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const day = dayKeyOf(new Date());
  const firedKey = `cn.break.fired.${day}`;
  const firedRef = useRef<Set<string>>(new Set());

  // Restore the reminders that already fired today.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(firedKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        firedRef.current = new Set(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      firedRef.current = new Set();
    }
  }, [firedKey]);

  const workingToday = useMemo(() => {
    const now = new Date();
    const weekday = now.getDay();
    const settings = state.settings;
    const employee = user?.employeeId ? state.employees.find((e) => e.id === user.employeeId) : undefined;
    if (employee) return isScheduled(employee, todayKey(), settings);
    if (weekday === 6) {
      const workingSaturdays = settings.workingSaturdays ?? [1, 3];
      return workingSaturdays.includes(Math.ceil(now.getDate() / 7));
    }
    return settings.workingDays.includes(weekday);
  }, [state.settings, state.employees, user?.employeeId]);

  const remember = useCallback((items: DueReminder[]) => {
    items.forEach((item) => firedRef.current.add(item.key));
    try {
      window.localStorage.setItem(firedKey, JSON.stringify([...firedRef.current]));
    } catch {
      // Storage being unavailable only costs us the de-duplication.
    }
  }, [firedKey]);

  const announceInBrowser = useCallback((item: DueReminder) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const notification = new Notification(`${item.label} in ${REMINDER_LEAD_MINUTES} minutes`, {
        body: `${item.label} starts at ${item.start} and lasts ${item.minutes} minutes.`,
        icon: '/favicon.png',
        tag: `cn-break-${item.key}`
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Mobile browsers only allow notifications from a service worker; the
      // in-app card still appears, so nothing is lost.
    }
  }, []);

  // Ask for desktop alerts on the first interaction, which is the only moment
  // browsers allow the permission prompt.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const ask = () => {
      void Notification.requestPermission().then(setPermission);
    };
    window.addEventListener('pointerdown', ask, { once: true });
    window.addEventListener('keydown', ask, { once: true });
    return () => {
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
    };
  }, []);

  // Poll the clock. Twenty seconds is frequent enough to catch the two-minute
  // window without waking the tab every second.
  useEffect(() => {
    if (!workingToday) return;

    const check = () => {
      const due = dueBreakReminders(new Date(), firedRef.current);
      if (due.length === 0) return;
      remember(due);
      setReminder(due[0]);
      due.forEach(announceInBrowser);
    };

    check();
    const timer = window.setInterval(check, 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workingToday, remember, announceInBrowser]);

  const requestPermission = () => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then(setPermission);
  };

  const Icon = reminder?.kind === 'lunch' ? UtensilsCrossedIcon : CoffeeIcon;
  const isLunch = reminder?.kind === 'lunch';

  return (
    <AnimatePresence>
      {reminder &&
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-x-4 bottom-40 z-40 mx-auto max-w-sm rounded-xl border border-line bg-white p-4 shadow-pop lg:inset-x-auto lg:bottom-24 lg:right-6">

          <div className="flex items-start gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isLunch ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {reminder.label} in {REMINDER_LEAD_MINUTES} minutes
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Starts at {reminder.start} · {reminder.minutes} minutes
              </p>
              {permission === 'default' &&
                <button
                  onClick={requestPermission}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 underline-offset-2 hover:underline">
                  <BellRingIcon className="h-3 w-3" /> Enable desktop alerts
                </button>}
              {permission === 'denied' &&
                <p className="mt-2 text-[11px] text-ink-faint">
                  Desktop alerts are blocked. Allow notifications for this site in your browser settings.
                </p>}
            </div>
            <button
              onClick={() => setReminder(null)}
              className="-mr-1 -mt-1 rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label="Dismiss break reminder">
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setReminder(null)}>Got it</Button>
          </div>
        </motion.div>}
    </AnimatePresence>);
}
