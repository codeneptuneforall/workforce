import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CakeIcon, SparklesIcon, XIcon } from 'lucide-react';
import type { Employee } from '@shared/types';
import { birthdaysOn, turningAge } from '@shared/domain/celebrations';
import { dayKeyOf } from '@shared/domain/workday';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { LottieMark } from '../ui/LottieMark';
import birthdayAnimation from '../../assets/lottie/birthday.json';

/** Round photo with an initials fallback, used only inside the greeting. */
function PersonPhoto({ employee }: { employee: Employee; }) {
  const [broken, setBroken] = useState(false);
  const initials = employee.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-semibold text-brand-800 ring-4 ring-white">
      {employee.photoUrl && !broken ?
        <img
          src={employee.photoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)} /> :

        <span aria-hidden>{initials}</span>}
    </span>);
}

/**
 * The birthday greeting.
 *
 * On the first visit of the day, every signed-in person sees a popup for each
 * colleague whose birthday it is. Closing it leaves a small floating button in
 * the bottom-right corner for the rest of the day, so the greeting can be
 * reopened. "Seen" is remembered per user, per day, in `localStorage`.
 */
export function BirthdayCelebration() {
  const { user } = useAuth();
  const { state } = useData();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const day = dayKeyOf(new Date());
  const birthdays = useMemo(() => birthdaysOn(state.employees), [state.employees]);
  const storageKey = user ? `cn.birthday.seen.${user.id}.${day}` : '';

  useEffect(() => {
    if (!storageKey || birthdays.length === 0) return;
    let seen: string[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) seen = parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      // A blocked or corrupt store just means the greeting shows again.
    }
    if (birthdays.some((b) => !seen.includes(b.id))) setOpen(true);
  }, [storageKey, birthdays]);

  const dismiss = useCallback(() => {
    setOpen(false);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(birthdays.map((b) => b.id)));
    } catch {
      // Ignore a full/blocked store; the button still stays available this session.
    }
  }, [storageKey, birthdays]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (birthdays.length === 0) return null;

  const firstNames = birthdays.map((b) => b.name.split(' ')[0]);
  const heading =
    firstNames.length === 1 ? firstNames[0] :
    firstNames.length === 2 ? `${firstNames[0]} & ${firstNames[1]}` :
    `${firstNames.slice(0, -1).join(', ')} & ${firstNames[firstNames.length - 1]}`;

  return (
    <>
      <AnimatePresence>
        {open &&
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismiss} />

            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="birthday-heading"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-pop outline-none">

              <button
                onClick={dismiss}
                className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close birthday greeting">
                <XIcon className="h-4 w-4" />
              </button>

              <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-fuchsia-500 px-6 pb-5 pt-1 text-center text-white">
                <LottieMark
                  src={birthdayAnimation}
                  className="mx-auto h-36 w-36"
                  fallback={<CakeIcon className="h-12 w-12 text-white/80" />} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/75">
                  Happy birthday
                </p>
                <h2 id="birthday-heading" className="mt-1 text-2xl font-semibold tracking-tight">
                  {heading}
                </h2>
              </div>

              <div className="px-5 py-5">
                <div className={cn('grid gap-3', birthdays.length > 1 && 'sm:grid-cols-2')}>
                  {birthdays.map((person) => {
                    const age = turningAge(person.dateOfBirth);
                    return (
                      <div key={person.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/70 p-3">
                        <PersonPhoto employee={person} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
                          <p className="truncate text-xs text-ink-muted">{person.designation}</p>
                          {age !== undefined && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700">
                              <SparklesIcon className="h-3 w-3" /> Turning {age} today
                            </p>
                          )}
                        </div>
                      </div>);
                  })}
                </div>

                <p className="mt-4 text-center text-sm text-ink-2">
                  Take a moment to wish {firstNames.length === 1 ? firstNames[0] : 'them all'} a wonderful day.
                </p>
                <p className="mt-1 text-center text-[11px] text-ink-faint">
                  This greeting stays in the corner so you can open it again later.
                </p>
              </div>

              <div className="flex justify-end border-t border-line px-5 py-3">
                <Button onClick={dismiss} icon={SparklesIcon}>Let&apos;s celebrate</Button>
              </div>
            </motion.div>
          </div>}
      </AnimatePresence>

      {!open &&
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-pop ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:bottom-6"
          aria-label={`Open today's birthday greeting for ${heading}`}>
          <span className="absolute inset-0 rounded-full bg-fuchsia-400/30 motion-safe:animate-ping" />
          <LottieMark src={birthdayAnimation} className="relative h-14 w-14" fallback={<CakeIcon className="h-7 w-7 text-fuchsia-500" />} />
          {birthdays.length > 1 &&
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
              {birthdays.length}
            </span>}
        </button>}
    </>);
}
