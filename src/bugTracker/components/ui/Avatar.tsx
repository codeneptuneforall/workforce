import React from 'react';
import type { Employee } from '../../types/bugTracker';

interface AvatarProps {
  employee?: Employee;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs' };

export function Avatar({ employee, size = 'sm', className = '' }: AvatarProps) {
  if (!employee) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-faint ${sizes[size]} ${className}`}
        aria-label="Unassigned"
        title="Unassigned">
        
        ?
      </span>);

  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink ${sizes[size]} ${className}`}
      title={employee.name}
      aria-hidden="true">
      
      {employee.initials}
    </span>);

}