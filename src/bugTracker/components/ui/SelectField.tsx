import React from 'react';
import { ChevronDownIcon } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SelectField({ id, label, value, onChange, options, placeholder, required, error, hint, disabled, compact, ariaLabel, className = '' }: SelectFieldProps) {
  return (
    <div className={className}>
      {label &&
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      }
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full appearance-none rounded-md border bg-surface pl-3 pr-8 text-ink transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint ${
          compact ? 'h-9 text-[13px]' : 'h-10 text-sm'} ${
          error ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-accent'} ${value === '' ? 'text-ink-subtle' : ''}`}>
          
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) =>
          <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      </div>
      {error ?
      <p id={`${id}-error`} className="mt-1 text-xs text-danger-ink">
          {error}
        </p> :
      hint ?
      <p id={`${id}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p> :
      null}
    </div>);

}