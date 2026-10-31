import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, ChevronDownIcon, KeyRoundIcon, Loader2Icon, LogOutIcon, MenuIcon, RotateCcwIcon, UserIcon, XIcon } from 'lucide-react';
import { employeeMobileTabs, employeeNav, managementMobileTabs, managementNav } from '../../data/navigation';

const BUG_TRACKER_ENABLED = import.meta.env.VITE_BUG_TRACKER_ENABLED !== 'false';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import type { Role } from '@shared/types';
import { cn } from '../../utils/cn';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';
import { Modal } from '../ui/Overlay';
import { Avatar } from '../ui/Primitives';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { Sidebar, activeNavTo } from './Sidebar';
import { WorkdayRituals } from '../rituals/WorkdayRituals';

export function AppShell({ portal }: {portal: Role;}) {
  const { user, logout } = useAuth();
  const { state, loading, loadError, refresh } = useData();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cn-sidebar') === '1');
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const groups = portal === 'management' ? managementNav : employeeNav;
  const visibleGroups = groups.
  map((g) => ({ ...g, items: g.items.filter((i) => !i.payrollOnly || user?.canManagePayroll) })).
  filter((g) => g.items.length && (BUG_TRACKER_ENABLED || g.label !== 'Bug Tracker'));
  const tabs = portal === 'management' ? managementMobileTabs : employeeMobileTabs;
  const audience = portal === 'management' ? 'management' : user?.employeeId ?? '';
  const unread = state.notifications.filter((n) => n.audience === audience && !n.read).length;
  const badges = {
    notifications: unread,
    leaves: portal === 'management' ? state.leaves.filter((l) => l.status === 'Pending Approval').length : 0,
    timesheets: portal === 'management' ? state.timesheets.filter((t) => t.status === 'Submitted' || t.status === 'Under Review').length : 0
  };
  const home = portal === 'management' ? '/management/dashboard' : '/employee/dashboard';
  const notificationsTo = `/${portal}/notifications`;

  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem('cn-sidebar', c ? '0' : '1');
      return !c;
    });
  };
  const activeTab = activeNavTo(location.pathname, [{ label: '', items: tabs }]);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar groups={visibleGroups} collapsed={collapsed} onToggle={toggle} badges={badges} homeTo={home} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to={home} className="lg:hidden" aria-label="Home"><Logo compact /></Link>
            <span className="hidden text-sm text-ink-muted sm:inline">{portal === 'management' ? 'Management Portal' : 'Employee Portal'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Link to={notificationsTo} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-canvas" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <BellIcon className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white tnum">{unread}</span>}
            </Link>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-lg px-2 hover:bg-canvas" aria-haspopup="menu" aria-expanded={menuOpen}>
                <Avatar name={user?.name ?? ''} size="sm" />
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium leading-tight text-ink">{user?.name}</span>
                  <span className="block text-xs leading-tight text-ink-muted">{user?.title}</span>
                </span>
                <ChevronDownIcon className="hidden h-4 w-4 text-ink-muted md:block" />
              </button>
              <AnimatePresence>
                {menuOpen &&
                <motion.div role="menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }} className="absolute right-0 mt-1 w-56 origin-top-right rounded-lg border border-line bg-white p-1 shadow-pop">
                    <div className="border-b border-line px-3 py-2">
                      <p className="truncate text-sm font-medium">{user?.name}</p>
                      <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                    </div>
                    {portal === 'employee' &&
                  <Link role="menuitem" to="/employee/profile" className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-ink-2 hover:bg-canvas"><UserIcon className="h-4 w-4" /> My profile</Link>
                  }
                    <button role="menuitem" onClick={() => {setMenuOpen(false);setPwOpen(true);}} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-ink-2 hover:bg-canvas"><KeyRoundIcon className="h-4 w-4" /> Change password</button>
                    <button role="menuitem" onClick={logout} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-bad hover:bg-bad-bg"><LogOutIcon className="h-4 w-4" /> Sign out</button>
                  </motion.div>
                }
              </AnimatePresence>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">
            {loading ?
              <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
                <Loader2Icon className="h-6 w-6 animate-spin text-brand-700" />
                <span className="sr-only">Loading your data…</span>
              </div> :
              loadError ?
                <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6 text-center">
                  <p className="text-sm font-medium text-ink">Your data could not be loaded</p>
                  <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
                  <Button variant="secondary" className="mt-4" icon={RotateCcwIcon} onClick={() => void refresh()}>Try again</Button>
                </div> :
                <Outlet />}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.to;
          return (
            <Link key={t.to} to={t.to} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-ink-muted')} aria-current={isActive ? 'page' : undefined}>
              <Icon className="h-5 w-5" /> {t.label}
            </Link>);

        })}
        <button onClick={() => setMoreOpen(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-muted">
          <MenuIcon className="h-5 w-5" /> More
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen &&
        <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} />
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">All sections</p>
                <button onClick={() => setMoreOpen(false)} className="rounded-md p-2 text-ink-muted" aria-label="Close menu"><XIcon className="h-5 w-5" /></button>
              </div>
              {visibleGroups.map((g) =>
            <div key={g.label} className="mb-3">
                  <p className="mb-1 text-[11px] font-medium text-ink-faint">{g.label}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {g.items.map((i) => {
                  const Icon = i.icon;
                  return (
                    <Link key={i.to} to={i.to} className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink-2 hover:bg-canvas">
                          <Icon className="h-4 w-4 text-ink-muted" /> <span className="truncate">{i.label}</span>
                        </Link>);

                })}
                  </div>
                </div>
            )}
            </motion.div>
          </div>
        }
      </AnimatePresence>

      <WorkdayRituals />

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" size="sm">
        <ChangePasswordForm onDone={() => setPwOpen(false)} />
      </Modal>
    </div>);

}