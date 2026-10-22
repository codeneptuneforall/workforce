import type * as React from 'react';
import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { controlClass } from './control';

/**
 * A modern dropdown.
 *
 * The native `<select>` cannot be styled: its arrow, its list and its behaviour differ
 * on every browser, and it offers nothing on a long list. This one behaves the same
 * everywhere — a button that shows the current choice, a floating panel with the
 * options, a search box for long lists, full keyboard support and one consistent look.
 *
 * The options are still written as plain `<option>` children, so every caller keeps
 * reading like ordinary markup:
 *
 * ```tsx
 * <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
 *   <option value="">All teams</option>
 *   {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
 * </Select>
 * ```
 */

/** The event the dropdown hands back — the same shape a native select produces. */
export interface SelectChangeEvent {
  target: { value: string; name: string; };
}

export interface SelectProps {
  id?: string;
  name?: string;
  /** The selected value. Numbers are accepted and compared as strings. */
  value?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  className?: string;
  /** Shown when nothing is selected and no empty option exists. */
  placeholder?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** One entry of the dropdown, read from the `<option>` children of the caller. */
interface OptionSpec {
  value: string;
  label: string;
  disabled: boolean;
}

/** Reads the text of a label — a string, a number, or an array of them. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
}

/** Reads the options out of the `<option>` children. */
function readOptions(children: React.ReactNode): OptionSpec[] {
  const out: OptionSpec[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    const label = textOf(props.children);
    const value = props.value !== undefined ? String(props.value) : label;
    out.push({ value, label: label || value, disabled: !!props.disabled });
  });
  return out;
}

/** From this many options the list gets a search box. */
const SEARCH_FROM = 8;

export function Select({
  id,
  name,
  value,
  onChange,
  children,
  disabled,
  invalid,
  required,
  className,
  placeholder = 'Select…',
  ...rest
}: SelectProps) {
  const listId = useId();
  const options = readOptions(children);
  const current = value === undefined || value === null ? '' : String(value);
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle)) : options),
    [options, needle]
  );

  /** Places the panel next to the trigger, flipping it up when there is no room below. */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
    const height = panelRef.current?.offsetHeight ?? 280;
    const below = window.innerHeight - rect.bottom;
    const top = below > height + 16 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPos({ top, left, width });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  const choose = useCallback((option: OptionSpec | undefined) => {
    if (!option || option.disabled) return;
    onChange?.({ target: { value: option.value, name: name ?? '' } });
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, [onChange, name]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => Math.min(Math.max(i + step, 0), Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : Math.max(filtered.length - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        choose(filtered[active]);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, filtered, active, choose, close]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    if (searchRef.current) searchRef.current.focus();
    else listRef.current?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, needle]);

  useEffect(() => {
    if (active < filtered.length) return;
    setActive(Math.max(filtered.length - 1, 0));
  }, [active, filtered.length]);

  const openMenu = () => {
    if (disabled) return;
    const index = filtered.findIndex((o) => o.value === current);
    setActive(index >= 0 ? index : 0);
    setQuery('');
    setOpen(true);
  };

  const panel = (
    <div
    ref={panelRef}
    className="fixed z-[60] overflow-hidden rounded-xl border border-line bg-white shadow-pop"
    style={{ top: pos.top, left: pos.left, width: pos.width }}>
      {options.length >= SEARCH_FROM &&
      <div className="border-b border-line p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
          ref={searchRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          placeholder="Search…"
          aria-label="Search options"
          className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-brand-500 focus:bg-white"
          />
        </div>
      </div>}
      <ul
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
      className="max-h-[280px] overflow-y-auto p-1 outline-none">
        {filtered.length === 0 ?
        <li className="px-3 py-6 text-center text-sm text-ink-muted">No matches</li> :
        filtered.map((o, i) => {
          const isSelected = o.value === current;
          return (
            <li
            key={`${o.value}-${i}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={o.disabled || undefined}
            data-active={i === active ? 'true' : undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-100',
              o.disabled && 'cursor-not-allowed opacity-50',
              isSelected ? 'bg-brand-50 font-medium text-brand-800' : 'text-ink hover:bg-canvas',
              !isSelected && i === active && 'bg-canvas'
            )}>
              <span className="truncate">{o.label}</span>
              {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-brand-700" />}
            </li>);

        })}
      </ul>
    </div>
  );

  return (
    <>
      <button
      type="button"
      id={id}
      ref={triggerRef}
      disabled={disabled}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listId}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      aria-label={rest['aria-label']}
      aria-describedby={rest['aria-describedby']}
      onClick={() => (open ? setOpen(false) : openMenu())}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          openMenu();
        }
      }}
      className={cn(
        controlClass,
        'flex h-10 items-center justify-between gap-2 text-left',
        invalid && 'border-bad focus:border-bad focus:ring-bad-bg',
        className
      )}>
        <span className={cn('truncate', !selected && !current && 'text-ink-faint')}>
          {selected ? selected.label : current || placeholder}
        </span>
        <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );

}
