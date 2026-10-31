import React from 'react';

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  type?: 'text' | 'date';
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function TextField({ id, label, value, onChange, placeholder, required, error, hint, type = 'text', multiline, rows = 4, disabled, className = '' }: TextFieldProps) {
  const shared = `w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:bg-canvas ${
  error ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-accent'}`;

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {multiline ?
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${shared} resize-y py-2 leading-relaxed`} /> :


      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${shared} h-10`} />

      }
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