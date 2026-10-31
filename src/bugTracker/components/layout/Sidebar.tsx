import React from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { BugIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerNav, workforceNav } from '../../data/navigation';
import { isOpenStatus, QA_STATUSES } from '../../utils/workflow';
import { Avatar } from '../ui/Avatar';
import { ProjectSelector } from './ProjectSelector';

interface SidebarProps {
  onNavigate?: () => void;
  showProjectSelector?: boolean;
}

export function Sidebar({ onNavigate, showProjectSelector = false }: SidebarProps) {
  const { currentUser, visibleIssues, permissions } = useBugTracker();
  const myOpen = visibleIssues.filter((i) => i.assigneeId === currentUser.id && isOpenStatus(i.status)).length;
  const qaQueue = visibleIssues.filter((i) => QA_STATUSES.includes(i.status)).length;
  const counts: Record<string, number> = { 'my-issues': myOpen, qa: qaQueue };
  const items = bugTrackerNav.filter((item) => !item.permission || permissions[item.permission]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-line px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">W</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Workforce</p>
          <p className="text-[11px] text-sidebar-muted">Code Neptune Technologies</p>
        </div>
      </div>

      {showProjectSelector &&
      <div className="border-b border-sidebar-line px-4 py-3">
          <ProjectSelector tone="dark" />
        </div>
      }

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <div>
          <p className="mb-1 px-2 text-[11px] font-medium text-sidebar-muted">Workforce</p>
          <ul className="space-y-0.5">
            {workforceNav.map(({ label, icon: Icon }) =>
            <li key={label}>
                <button
                type="button"
                onClick={() => toast(`${label} is part of the existing Workforce app`, { description: 'Only the Bug Tracker module is included in this preview.' })}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-text">
                
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-medium text-sidebar-muted">
            <BugIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Bug Tracker
          </p>
          <ul className="space-y-0.5">
            {items.map(({ id, label, to, icon: Icon, end }) =>
            <li key={id}>
                <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'}`

                }>
                
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{label}</span>
                  {counts[id] ? <span className="rounded bg-sidebar-hover px-1.5 text-[11px] font-semibold tabular-nums text-sidebar-text">{counts[id]}</span> : null}
                </NavLink>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-sidebar-line px-4 py-3">
        <Avatar employee={currentUser} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-medium text-white">{currentUser.name}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{currentUser.title}</p>
        </div>
      </div>
    </div>);

}