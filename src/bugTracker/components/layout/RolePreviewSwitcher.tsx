import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronDownIcon, EyeIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { rolePreviews } from '../../data/rolePreview';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function RolePreviewSwitcher() {
  const { role, setRole, getEmployee, resetPreviewData } = useBugTracker();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const current = rolePreviews.find((r) => r.role === role);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-2.5 text-[13px] text-ink-muted transition-colors duration-150 hover:bg-canvas">
        
        <EyeIcon className="h-4 w-4 text-ink-faint" aria-hidden="true" />
        <span className="hidden lg:inline">Preview as</span>
        <span className="font-medium text-ink">{current?.label.split(' / ')[0]}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open &&
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="absolute right-0 z-40 mt-2 w-80 origin-top-right overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          
            <div className="border-b border-line bg-warning-soft px-3 py-2">
              <p className="text-xs font-medium text-warning-ink">UI preview only — not real sign-in or permissions</p>
            </div>
            <ul className="py-1">
              {rolePreviews.map((preview) => {
              const person = getEmployee(preview.userId);
              const selected = preview.role === role;
              return (
                <li key={preview.role}>
                    <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setRole(preview.role);
                      setOpen(false);
                      toast(`Previewing as ${preview.label}`, { description: person?.name });
                    }}
                    className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 ${selected ? 'bg-accent-soft' : 'hover:bg-canvas'}`}>
                    
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-accent">{selected && <CheckIcon className="h-4 w-4" aria-hidden="true" />}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{preview.label}</span>
                        <span className="block text-xs text-ink-subtle">
                          {person?.name} · {preview.summary}
                        </span>
                      </span>
                    </button>
                  </li>);

            })}
            </ul>
            <div className="border-t border-line p-1">
              <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmReset(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-muted transition-colors duration-150 hover:bg-canvas hover:text-ink">
              
                <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
                Reset sample data
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset sample data?"
        message="Issues, comments and assignments you changed in this preview will return to the original sample data."
        confirmLabel="Reset data"
        onConfirm={() => {
          resetPreviewData();
          toast.success('Sample data restored');
        }} />
      
    </div>);

}