import type * as React from 'react';
import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

const ease = [0.23, 1, 0.32, 1] as const;

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

const modalSizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };
const drawerSizes = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: OverlayProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (open) setTimeout(() => panelRef.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 50);
  }, [open]);
  return (
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-xl', modalSizes[size])}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ duration: 0.2, ease }}>
          
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id={id} className="text-base font-semibold text-ink">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
              </div>
              <button onClick={onClose} className="-mr-1 rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}

export function Drawer({ open, onClose, title, description, children, footer, size = 'md' }: OverlayProps) {
  const id = useId();
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          className={cn('relative flex h-full w-full flex-col bg-white shadow-pop', drawerSizes[size])}
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.25, ease }}>
          
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 id={id} className="text-base font-semibold text-ink">{title}</h2>
                {description && <div className="mt-0.5 text-sm text-ink-muted">{description}</div>}
              </div>
              <button onClick={onClose} className="-mr-1 rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.aside>
        </div>
      }
    </AnimatePresence>);

}