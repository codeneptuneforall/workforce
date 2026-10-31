import React, { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
          className="absolute inset-0 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          aria-hidden="true" />
        
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative flex max-h-[92vh] w-full flex-col rounded-t-xl bg-surface shadow-pop sm:rounded-xl ${sizeClasses[size]}`}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 4 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
          
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
              </div>
              <button
              type="button"
              onClick={onClose}
              className="-mr-1 rounded-md p-1.5 text-ink-faint transition-colors duration-150 hover:bg-neutral-soft hover:text-ink"
              aria-label="Close dialog">
              
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}