import type * as React from 'react';
import { Link } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-canvas active:bg-line',
  ghost: 'text-ink-2 hover:bg-canvas hover:text-ink',
  danger: 'bg-bad text-white hover:bg-red-800',
  success: 'bg-ok text-white hover:bg-green-800'
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none', 'transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98]', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2', 'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100', variants[variant], sizes[size], className);
}
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>;
}
interface ButtonLinkProps {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}
export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children
}: ButtonLinkProps) {
  return <Link to={to} className={buttonClass(variant, size, className)}>
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </Link>;
}