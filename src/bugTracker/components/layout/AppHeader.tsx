import React, { useEffect, useState } from 'react';
import { MenuIcon, SearchIcon } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { bugTrackerRoutes } from '../../data/navigation';
import { NotificationsPanel } from './NotificationsPanel';
import { ProjectSelector } from './ProjectSelector';
import { RolePreviewSwitcher } from './RolePreviewSwitcher';

export function AppHeader({ onOpenMenu }: {onOpenMenu: () => void;}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (location.pathname === bugTrackerRoutes.issues) setQuery(params.get('q') ?? '');
  }, [location.pathname, params]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${bugTrackerRoutes.issues}?q=${encodeURIComponent(q)}` : bugTrackerRoutes.issues);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-neutral-soft lg:hidden"
        aria-label="Open navigation">
        
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="hidden w-52 sm:block">
        <ProjectSelector />
      </div>
      <form onSubmit={submit} role="search" className="relative min-w-0 flex-1 md:max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issues by key, title or label"
          aria-label="Search issues"
          className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30" />
        
      </form>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <RolePreviewSwitcher />
        <NotificationsPanel />
      </div>
    </header>);

}