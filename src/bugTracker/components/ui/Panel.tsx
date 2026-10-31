import React from 'react';

interface PanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, description, action, children, className = '', bodyClassName = 'p-4' }: PanelProps) {
  return (
    <section className={`rounded-lg border border-line bg-surface shadow-card ${className}`}>
      {title &&
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
          </div>
          {action}
        </div>
      }
      <div className={bodyClassName}>{children}</div>
    </section>);

}