import React from 'react';
import { Select } from '../../../components/ui/Dropdown';

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
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        invalid={Boolean(error)}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={compact ? 'h-9 text-[13px]' : undefined}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) =>
        <option key={o.value} value={o.value}>
            {o.label}
          </option>
        )}
      </Select>
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