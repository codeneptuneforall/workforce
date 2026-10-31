import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon, PencilIcon, UserPlusIcon } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { Issue } from '../../types/bugTracker';
import { statusStyles } from '../../utils/issueStyles';
import type { WorkflowTransition } from '../../utils/workflow';
import { Button } from '../ui/Button';

interface IssueActionBarProps {
  issue: Issue;
  transitions: WorkflowTransition[];
  canEdit: boolean;
  canAssign: boolean;
  onTransition: (t: WorkflowTransition) => void;
  onEdit: () => void;
  onAssign: () => void;
}

const toneToVariant = { primary: 'primary', success: 'success', danger: 'danger-outline', neutral: 'secondary' } as const;

export function IssueActionBar({ issue, transitions, canEdit, canAssign, onTransition, onEdit, onAssign }: IssueActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenuOpen(false), []);
  useClickOutside(ref, close, menuOpen);

  const primary = transitions.filter((t) => t.id !== 'assign').slice(0, 2);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit &&
      <Button size="sm" onClick={onEdit} icon={<PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
          Edit
        </Button>
      }
      {canAssign &&
      <Button size="sm" onClick={onAssign} icon={<UserPlusIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
          {issue.assigneeId ? 'Reassign' : 'Assign'}
        </Button>
      }
      {transitions.length > 0 &&
      <div ref={ref} className="relative">
          <Button size="sm" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
            Change status
            <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <AnimatePresence>
            {menuOpen &&
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 z-30 mt-1.5 w-60 origin-top-right rounded-lg border border-line bg-surface py-1 shadow-pop">
            
                <li className="px-3 pb-1.5 pt-1 text-xs text-ink-subtle">Available from {issue.status}</li>
                {transitions.map((t) =>
            <li key={t.id}>
                    <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTransition(t);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-ink transition-colors duration-150 hover:bg-canvas">
                
                      {t.label}
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusStyles[t.to].dot}`} aria-hidden="true" />
                        {t.to}
                      </span>
                    </button>
                  </li>
            )}
              </motion.ul>
          }
          </AnimatePresence>
        </div>
      }
      {primary.map((t) =>
      <Button key={t.id} size="sm" variant={toneToVariant[t.tone]} onClick={() => onTransition(t)}>
          {t.label}
        </Button>
      )}
    </div>);

}