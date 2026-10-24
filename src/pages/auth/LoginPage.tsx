import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { SessionLoading } from '../../components/auth/SessionLoading';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Banner } from '../../components/ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '@shared/types';

/** True when the path lives in the portal of the given role. */
function belongsToPortal(path: string, role: Role): boolean {
  return path === `/${role}` || path.startsWith(`/${role}/`);
}

export function LoginPage() {
  const { login, user, initialising } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {from?: string;signedOut?: boolean;} | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState('');
  const [needLateReason, setNeedLateReason] = useState(false);
  const redirectHandled = useRef(false);

  const emailError = !email ? 'Enter your work email.' : !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address.' : null;
  const pwError = !password ? 'Enter your password.' : null;

  /**
   * An account that is already signed in has no business on this page.
   *
   * The redirect only runs once, and the sign-in handler below marks it as handled so
   * that it never overrides the deep link the user originally asked for.
   */
  useEffect(() => {
    if (initialising || !user || redirectHandled.current) return;
    redirectHandled.current = true;
    navigate(user.role === 'management' ? '/management/dashboard' : '/employee/dashboard', { replace: true });
  }, [initialising, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailError || pwError) return;
    if (needLateReason && !lateReason.trim()) {
      setError('Please provide a reason for being late.');
      return;
    }
    setPending(true);
    const res = await login(email, password, needLateReason ? lateReason : undefined);
    setPending(false);
    if (!res.ok || !res.user) {
      if (res.code === 'late_reason_required') {
        setNeedLateReason(true);
        setError(res.error ?? 'You are late. Please provide a reason.');
        return;
      }
      return setError(res.error ?? 'Sign-in failed.');
    }
    redirectHandled.current = true;
    const home = res.user.role === 'management' ? '/management/dashboard' : '/employee/dashboard';
    const from = state?.from && belongsToPortal(state.from, res.user.role) ? state.from : home;
    navigate(from, { replace: true });
  };

  if (initialising) return <SessionLoading label="Checking your session…" />;

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">Use your Code Neptune work email. Your access is set by your account.</p>
      {state?.signedOut && <Banner tone="ok" className="mt-6">You have been signed out securely.</Banner>}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Work email" required error={touched && emailError ? emailError : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={touched && !!emailError} placeholder="name@codeneptune.in" />}
        </Field>
        <Field label="Password" required error={touched && pwError ? pwError : undefined}>
          {(id, d) =>
          <div className="relative">
              <Input id={id} aria-describedby={d} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={touched && !!pwError} className="pr-10" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          }
        </Field>
        {needLateReason && (
          <Field label="Reason for being late (required after 10:15)" required>
            {(id) => <Input id={id} value={lateReason} onChange={(e) => setLateReason(e.target.value)} placeholder="e.g., Traffic jam, Vehicle breakdown" />}
          </Field>
        )}
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800">Forgot password?</Link>
        </div>
        {error && <Banner tone="bad">{error}</Banner>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in</Button>
      </form>
    </AuthLayout>);

}