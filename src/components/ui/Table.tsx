import type * as React from 'react';
import { cn } from '../../utils/cn';

export function Table({ children, className }: {children: React.ReactNode;className?: string;}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>);

}

export function Th({ children, className, align = 'left' }: {children?: React.ReactNode;className?: string;align?: 'left' | 'right' | 'center';}) {
  return (
    <th scope="col" className={cn('whitespace-nowrap border-b border-line bg-canvas/60 px-4 py-2.5 text-xs font-medium text-ink-muted', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </th>);

}

export function Td({ children, className, align = 'left', colSpan }: {children?: React.ReactNode;className?: string;align?: 'left' | 'right' | 'center';colSpan?: number;}) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-line px-4 py-3 align-middle text-ink', align === 'right' && 'tnum text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>);

}

export function Tr({ children, onClick, className, selected }: {children: React.ReactNode;onClick?: () => void;className?: string;selected?: boolean;}) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(onClick && 'cursor-pointer transition-colors duration-150 hover:bg-canvas focus:bg-canvas focus:outline-none', selected && 'bg-brand-50', className)}>
      
      {children}
    </tr>);

}