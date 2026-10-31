import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

/**
 * Prototype application shell. In Workforce, render the Bug Tracker routes inside the
 * existing root layout and add `bugTrackerNav` to the existing sidebar instead.
 */
export function BugTrackerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas font-sans text-ink">
      <aside className="hidden w-60 shrink-0 lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {mobileOpen &&
        <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true" />
          
            <motion.aside
            className="relative h-full w-72 max-w-[85vw]"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            aria-label="Navigation">
            
              <Sidebar onNavigate={() => setMobileOpen(false)} showProjectSelector />
              <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3.5 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              aria-label="Close navigation">
              
                <XIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </motion.aside>
          </div>
        }
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>);

}