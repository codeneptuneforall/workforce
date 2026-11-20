import React from 'react';

/**
 * Generic placeholder shown while Bug Tracker data is still loading, so pages
 * never flash an empty state ("Nothing assigned to you", "Queue is clear", …)
 * before issues have arrived.
 */
export function PageLoadingSkeleton({ title, rows = 6 }: {title?: string;rows?: number;}) {
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        {title ?
        <h1 className="text-xl font-semibold text-ink">{title}</h1> :
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-soft" />
        }
        <div className="h-3 w-72 animate-pulse rounded bg-neutral-soft" />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <ul className="divide-y divide-line">
          {Array.from({ length: rows }, (_, i) =>
          <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-3 w-16 animate-pulse rounded bg-neutral-soft" />
              <div className="h-3 flex-1 animate-pulse rounded bg-neutral-soft" />
              <div className="h-3 w-20 animate-pulse rounded bg-neutral-soft" />
            </li>
          )}
        </ul>
      </div>
      <span className="sr-only">Loading…</span>
    </div>);

}
