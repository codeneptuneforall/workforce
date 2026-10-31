import React from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';

interface ButtonLinkProps {
  to: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas'
};

export function ButtonLink({ to, variant = 'secondary', icon, children, className }: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={twMerge(
        'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        variants[variant],
        className
      )}>
      
      {icon}
      {children}
    </Link>);

}