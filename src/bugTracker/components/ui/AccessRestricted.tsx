import React from 'react';
import { LockIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bugTrackerRoutes } from '../../data/navigation';
import { rolePreviews } from '../../data/rolePreview';
import { useBugTracker } from '../../contexts/BugTrackerContext';

export function AccessRestricted({ area }: {area: string;}) {
  const { role } = useBugTracker();
  const roleLabel = rolePreviews.find((r) => r.role === role)?.label ?? role;
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-neutral-soft text-ink-subtle">
        <LockIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-base font-semibold text-ink">{area} isn’t available for this role</h1>
      <p className="mt-1 text-sm text-ink-subtle">
        You’re previewing as <span className="font-medium text-ink">{roleLabel}</span>. Switch roles from “Preview as” in the header to see this screen.
      </p>
      <Link to={bugTrackerRoutes.overview} className="mt-5 inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-canvas">
        Back to overview
      </Link>
    </div>);

}