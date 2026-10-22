import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordChangeGate } from '../auth/PasswordChangeGate';
import { SessionLoading } from '../auth/SessionLoading';
import type { Role } from '@shared/types';

/** The landing page of the portal the signed-in account belongs to. */
export function homeFor(role: Role): string {
  return role === 'management' ? '/management/dashboard' : '/employee/dashboard';
}

/**
 * Sends a signed-in account back to the portal it belongs to.
 *
 * A role mismatch is never a permission problem the user can solve — it means the URL
 * belongs to the other portal (a stale link, the browser back button or a bookmark).
 * Landing such a request on an "Access denied" page is a dead end with no way forward,
 * so the account is taken to its own dashboard and told why.
 */
function PortalRedirect({ to, label }: {to: string;label: string;}) {
  useEffect(() => {
    toast.info(`That section belongs to the ${label} portal.`);
  }, [label]);
  return <Navigate to={to} replace />;
}

export function RequireRole({ role }: {role: Role;}) {
  const { user, initialising } = useAuth();
  const location = useLocation();
  // The account is unknown until the session has been checked. Redirecting before that
  // would sign the user out on every page reload, even with a valid session cookie.
  if (initialising) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <PasswordChangeGate />;
  if (user.role !== role) {
    return <PortalRedirect to={homeFor(user.role)} label={role === 'management' ? 'management' : 'employee'} />;
  }
  return <Outlet />;
}

export function RequirePayroll() {
  const { user, initialising } = useAuth();
  const location = useLocation();
  if (initialising) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <PasswordChangeGate />;
  if (!user.canManagePayroll) return <Navigate to="/access-denied" replace state={{ from: location.pathname, reason: 'payroll' }} />;
  return <Outlet />;
}

export function RootRedirect() {
  const { user, initialising } = useAuth();
  if (initialising) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <PasswordChangeGate />;
  return <Navigate to={homeFor(user.role)} replace />;
}
