import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-soft text-ink-subtle">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>;
}