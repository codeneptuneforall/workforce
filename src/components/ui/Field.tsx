import * as React from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';
import { controlClass } from './control';

/** The shared look of every form control, so custom inputs match the native ones. */
export { controlClass };

/** The modern dropdown — a styled replacement for the native `<select>`. */
export { Select } from './Dropdown';
export type { SelectChangeEvent, SelectProps } from './Dropdown';

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const descId = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-bad" aria-hidden>*</span>}
      </label>
      {children(id, descId)}
      {error ?
      <p id={descId} className="text-xs text-bad" role="alert">{error}</p> :
      hint ?
      <p id={descId} className="text-xs text-ink-muted">{hint}</p> :
      null}
    </div>);

}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & {invalid?: boolean;}>(
  ({ className, invalid, ...rest }, ref) =>
  <input ref={ref} className={cn(controlClass, 'h-10', invalid && 'border-bad focus:border-bad focus:ring-bad-bg', className)} aria-invalid={invalid || undefined} {...rest} />
);
Input.displayName = 'Input';

export function Textarea({ className, invalid, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {invalid?: boolean;}) {
  return <textarea className={cn(controlClass, 'min-h-[88px] py-2', invalid && 'border-bad', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Checkbox({ label, description, checked, onChange, disabled }: {label: string;description?: string;checked: boolean;onChange: (v: boolean) => void;disabled?: boolean;}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand-700 focus:ring-brand-500" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
    </label>);

}
