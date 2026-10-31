import React from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'danger-outline';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas',
  ghost: 'text-ink-muted hover:bg-neutral-soft hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-ink',
  success: 'bg-success text-white hover:bg-success-ink',
  'danger-outline': 'bg-surface text-danger-ink border border-danger-line hover:bg-danger-soft'
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2'
};

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={twMerge(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}>
      
      {icon}
      {children}
    </button>);

}