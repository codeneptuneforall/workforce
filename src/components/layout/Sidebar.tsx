import { Link, useLocation } from 'react-router-dom';
import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '../../data/navigation';
import { cn } from '../../utils/cn';
import { Logo } from '../ui/Logo';

export function activeNavTo(pathname: string, groups: NavGroup[]): string | undefined {
  const all = groups.flatMap((g) => g.items);
  return all.
  filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)).
  sort((a, b) => b.to.length - a.to.length).
  find((i) => !(i.to.endsWith('/leaves') && pathname.endsWith('/apply')))?.to;
}

interface SidebarProps {
  groups: NavGroup[];
  collapsed: boolean;
  onToggle: () => void;
  badges: Partial<Record<NonNullable<NavItem['badgeKey']>, number>>;
  homeTo: string;
}

export function Sidebar({ groups, collapsed, onToggle, badges, homeTo }: SidebarProps) {
  const { pathname } = useLocation();
  const active = activeNavTo(pathname, groups);
  return (
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-[width] duration-200 ease-out lg:flex', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Link to={homeTo} aria-label="Code Neptune home">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {groups.map((g) =>
        <div key={g.label} className="mb-4">
            {!collapsed && <p className="mb-1 px-3 text-[11px] font-medium text-ink-faint">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
              const isActive = active === item.to;
              const count = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                    <Link
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-2 hover:bg-canvas hover:text-ink'
                    )}>
                    
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-700' : 'text-ink-muted group-hover:text-ink-2')} aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {count > 0 && (
                    collapsed ?
                    <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-brand-600" aria-label={`${count} pending`} /> :

                    <span className="ml-auto rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold text-brand-800 tnum">{count}</span>)
                    }
                    </Link>
                  </li>);

            })}
            </ul>
          </div>
        )}
      </nav>
      <div className="border-t border-line p-3">
        {!collapsed && <p className="mb-2 px-2 text-[11px] leading-snug text-ink-faint">Code Neptune Technologies Pvt. Ltd. · Internal use only</p>}
        <button onClick={onToggle} className={cn('flex h-9 w-full items-center gap-2 rounded-lg text-sm text-ink-muted hover:bg-canvas hover:text-ink', collapsed ? 'justify-center' : 'px-3')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRightIcon className="h-4 w-4" /> : <><ChevronsLeftIcon className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>);

}