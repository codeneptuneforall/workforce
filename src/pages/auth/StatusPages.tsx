import { useLocation } from 'react-router-dom';
import { ClockIcon, ShieldAlertIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { ButtonLink } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export function SessionExpiredPage() {
  return (
    <AuthLayout>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-warn-bg text-warn"><ClockIcon className="h-5 w-5" /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Your session has expired</h1>
      <p className="mt-2 text-sm text-ink-muted">For your security, you were signed out after a period of inactivity. Any running timer is saved with its start time and will be restored when you sign back in.</p>
      <ButtonLink to="/login" variant="primary" className="mt-6">Sign in again</ButtonLink>
    </AuthLayout>);

}

export function AccessDeniedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const state = location.state as {reason?: string;from?: string;} | null;
  const home = !user ? '/login' : user.role === 'management' ? '/management/dashboard' : '/employee/dashboard';
  const payroll = state?.reason === 'payroll';
  return (
    <AuthLayout>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bad-bg text-bad"><ShieldAlertIcon className="h-5 w-5" /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {payroll ?
        'Payroll, salary structures, bank details and payslip administration are restricted to authorised payroll managers.' :
        'Your account doesn’t have permission to view this page. If you think this is a mistake, contact your administrator.'}
      </p>
      {state?.from && <p className="mt-1 text-sm text-ink-muted">Requested section: <span className="font-medium text-ink-2">{state.from}</span></p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink to={home} variant="primary">{user ? 'Go to my dashboard' : 'Sign in'}</ButtonLink>
        {payroll && <ButtonLink to="/management/attendance" variant="secondary">Back to Attendance &amp; Hours</ButtonLink>}
      </div>
    </AuthLayout>);

}