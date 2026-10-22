import { useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { ChangePasswordForm } from './ChangePasswordForm';
import { Banner } from '../ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Shown instead of the app when the signed-in account still uses its issued password.
 *
 * The server refuses every state mutation for such an account, so this gate is not just
 * a convenience — the app is unusable until the password is changed.
 */
export function PasswordChangeGate() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Set a new password</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {user?.name ? `Hi ${user.name} — ` : ''}this account still uses the password it was issued with.
        Choose your own before you continue.
      </p>
      <Banner tone="info" className="mt-6">
        Your time, leave and payroll data stay hidden until the password is changed.
      </Banner>
      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <ChangePasswordForm />
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={signOut} className="text-sm font-medium text-ink-muted hover:text-ink">
          Sign out instead
        </button>
      </div>
    </AuthLayout>);

}
