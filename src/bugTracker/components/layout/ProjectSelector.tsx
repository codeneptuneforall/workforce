import React from 'react';
import { ChevronDownIcon, FolderIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';

export function ProjectSelector({ tone = 'light' }: {tone?: 'light' | 'dark';}) {
  const { accessibleProjects, projectScope, setProjectScope } = useBugTracker();
  const dark = tone === 'dark';
  return (
    <div className="relative">
      <FolderIcon className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? 'text-sidebar-muted' : 'text-ink-faint'}`} aria-hidden="true" />
      <select
        value={projectScope}
        onChange={(e) => setProjectScope(e.target.value)}
        aria-label="Project"
        className={`h-9 w-full appearance-none rounded-md border pl-8 pr-8 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 ${
        dark ? 'border-sidebar-line bg-sidebar-hover text-white' : 'border-line-strong bg-surface text-ink'}`
        }>
        
        <option value="all">All projects</option>
        {accessibleProjects.map((p) =>
        <option key={p.id} value={p.id}>
            {p.name}
          </option>
        )}
      </select>
      <ChevronDownIcon className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${dark ? 'text-sidebar-muted' : 'text-ink-faint'}`} aria-hidden="true" />
    </div>);

}