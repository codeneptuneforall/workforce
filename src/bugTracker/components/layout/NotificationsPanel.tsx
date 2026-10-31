import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, BellOffIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { useClickOutside } from '../../hooks/useClickOutside';
import { relativeTime } from '../../utils/dates';

export function NotificationsPanel() {
  const { notifications, markNotificationsRead } = useBugTracker();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-neutral-soft hover:text-ink">
        
        <BellIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 &&
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread}</span>
        }
      </button>
      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-x-3 top-16 z-40 origin-top-right overflow-hidden rounded-lg border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              {unread > 0 &&
            <button type="button" onClick={markNotificationsRead} className="text-xs font-medium text-accent hover:text-accent-hover">
                  Mark all as read
                </button>
            }
            </div>
            {notifications.length === 0 ?
          <div className="flex flex-col items-center px-4 py-10 text-center">
                <BellOffIcon className="h-5 w-5 text-ink-faint" aria-hidden="true" />
                <p className="mt-2 text-sm text-ink-subtle">You’re all caught up.</p>
              </div> :

          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {notifications.map((n) =>
            <li key={n.id}>
                    <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (n.issueKey) navigate(bugTrackerRoutes.issue(n.issueKey));
                }}
                className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas">
                
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-muted">{n.body}</span>
                        <span className="mt-1 block text-xs text-ink-faint">{relativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
            )}
              </ul>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}