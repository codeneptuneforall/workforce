import type * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, addMonths, endOfDay, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { controlClass } from './Field';
import { fromDateKey, toDateKey, todayKey } from '@shared/domain/time';

/**
 * A modern date picker.
 *
 * The native `<input type="date">` control looks different on every browser and can
 * only be typed into. This one behaves like a proper picker everywhere: a calendar
 * grid, month navigation, keyboard support and a single, consistent look.
 *
 * The value is always a plain `yyyy-MM-dd` key — the same shape the rest of the
 * domain uses for dates.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PANEL_WIDTH = 320;

export interface DatePickerProps {
  id?: string;
  /** The selected date as a `yyyy-MM-dd` key, or an empty string. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date (`yyyy-MM-dd`). */
  min?: string;
  /** Latest selectable date (`yyyy-MM-dd`). */
  max?: string;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  placeholder = 'Select date',
  disabled,
  className,
  ...rest
}: DatePickerProps) {
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromDateKey(value || today)));
  const [focused, setFocused] = useState(value || today);
  const [pos, setPos] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selected = value ? fromDateKey(value) : null;
  const minDate = min ? startOfDay(fromDateKey(min)) : null;
  const maxDate = max ? endOfDay(fromDateKey(max)) : null;
  const outOfRange = (d: Date) => (minDate ? d < minDate : false) || (maxDate ? d > maxDate : false);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [viewMonth]);

  /** Positions the calendar next to the trigger, flipping up when there is no room. */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 360;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom;
    const top = below > height + 16 ? rect.bottom + 8 : Math.max(8, rect.top - height - 8);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, place]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [open, place]);

  const pick = (d: Date) => {
    if (outOfRange(d)) return;
    onChange(toDateKey(d));
    setFocused(toDateKey(d));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveFocus = (d: Date) => {
    const key = toDateKey(d);
    setFocused(key);
    if (!isSameMonth(d, viewMonth)) setViewMonth(startOfMonth(d));
    window.requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${key}"]`)?.focus();
    });
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(addDays(fromDateKey(focused), step[e.key]));
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      moveFocus(addMonths(fromDateKey(focused), e.key === 'PageUp' ? -1 : 1));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(fromDateKey(focused));
    }
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose a date"
      className="fixed z-[60] rounded-xl border border-line bg-white p-3 shadow-pop"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      onKeyDown={onGridKey}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} aria-label="Previous month"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-ink" aria-live="polite">{format(viewMonth, 'MMMM yyyy')}</p>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {WEEKDAYS.map((d) =>
        <div key={d} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint">{d.slice(0, 2)}</div>)}
        {days.map((d) => {
          const key = toDateKey(d);
          const inMonth = isSameMonth(d, viewMonth);
          const isSelected = selected ? isSameDay(d, selected) : false;
          const isToday = isSameDay(d, fromDateKey(today));
          const disabled = outOfRange(d);
          return (
            <button
            key={key}
            type="button"
            data-key={key}
            data-focused={key === focused}
            tabIndex={key === focused ? 0 : -1}
            disabled={disabled}
            aria-label={format(d, 'd MMMM yyyy')}
            aria-selected={isSelected}
            onClick={() => pick(d)}
            onFocus={() => setFocused(key)}
            className={cn(
              'flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors duration-100',
              !inMonth && 'text-ink-faint',
              inMonth && !isSelected && !disabled && 'text-ink hover:bg-brand-50',
              isSelected && 'bg-brand-700 font-semibold text-white hover:bg-brand-700',
              !isSelected && isToday && 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-200',
              disabled && 'cursor-not-allowed text-ink-faint/50 line-through hover:bg-transparent'
            )}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button type="button" onClick={() => pick(fromDateKey(today))} className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50">
          Today
        </button>
        {value &&
        <button type="button" onClick={() => {onChange('');setOpen(false);triggerRef.current?.focus();}} className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink">
            Clear
          </button>}
      </div>
    </div>
  );

  return (
    <>
      <button
      type="button"
      id={id}
      ref={triggerRef}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      aria-describedby={rest['aria-describedby']}
      aria-label={rest['aria-label']}
      onClick={() => setOpen((o) => !o)}
      className={cn(controlClass, 'flex h-10 items-center justify-between gap-2 text-left', invalid && 'border-bad focus:border-bad focus:ring-bad-bg', className)}>
        <span className={cn('truncate', !value && 'text-ink-faint')}>{value && selected ? format(selected, 'd MMM yyyy') : placeholder}</span>
        <CalendarDaysIcon className="h-4 w-4 shrink-0 text-ink-muted" />
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );

}
