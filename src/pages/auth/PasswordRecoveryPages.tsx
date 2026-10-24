import type * as React from 'react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, CopyIcon, MailIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Banner } from '../../components/ui/Primitives';
import { useAuth, validatePassword } from '../../contexts/AuthContext';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailError = !email ? 'Enter your work email.' : !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailError) return;
    setPending(true);
    const res = await forgotPassword(email);
    setPending(false);
    if (!res.ok) return setError(res.error ?? 'Could not start the password reset.');
    // Outside production the API hands the token back so the reset can be completed
    // without a mail server. In production the token only ever arrives by email.
    setDevToken(res.devToken);
    setSent(true);
  };

  return (
    <AuthLayout>
      {sent ?
      <div>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700"><MailIcon className="h-5 w-5" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-sm text-ink-muted">If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link has been issued.</p>
          {devToken ?
          <Banner tone="info" className="mt-6">No mail provider is connected, so the reset token is shown here. In a deployed environment it is only sent by email.</Banner> :
          <Banner tone="info" className="mt-6">The reset link has been sent to your work email address.</Banner>}
          {devToken && (
            <div className="mt-4 rounded-lg border border-line bg-surface p-3">
              <p className="mb-2 text-xs text-ink-muted">Reset token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-canvas px-2 py-1 text-xs">{devToken}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={CopyIcon}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(devToken);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {}
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="mt-2">
                <ButtonLink to={`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(devToken)}`} variant="primary" size="sm">Continue to reset</ButtonLink>
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {!devToken && <ButtonLink to="/login">Back to sign in</ButtonLink>}
            {devToken && <ButtonLink to="/login" variant="ghost">Back to sign in</ButtonLink>}
          </div>
        </div> :

      <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="mt-1 text-sm text-ink-muted">Enter your work email and we’ll send a reset link.</p>
          <div className="mt-6 space-y-4">
            <Field label="Work email" required error={touched && emailError ? emailError : undefined}>
              {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={touched && !!emailError} />}
            </Field>
            {error && <Banner tone="bad">{error}</Banner>}
            <Button type="submit" size="lg" className="w-full" loading={pending}>Send reset link</Button>
            <p className="text-center text-sm"><Link to="/login" className="font-medium text-brand-700">Back to sign in</Link></p>
          </div>
        </form>
      }
    </AuthLayout>);

}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const { resetPassword } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const pwError = pw ? validatePassword(pw) : 'Enter a new password.';
  const confirmError = confirm !== pw ? 'Passwords do not match.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (pwError || confirmError) return;
    if (!email || !token) {
      setError('This reset link is incomplete. Request a new one.');
      return;
    }
    setPending(true);
    const res = await resetPassword(email, token, pw);
    setPending(false);
    if (!res.ok) return setError(res.error ?? 'Could not reset password.');
    setDone(true);
  };

  return (
    <AuthLayout>
      {done ?
      <div>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-ok-bg text-ok"><CheckCircle2Icon className="h-5 w-5" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="mt-2 text-sm text-ink-muted">You can now sign in with your new password.</p>
          <ButtonLink to="/login" variant="primary" className="mt-6">Sign in</ButtonLink>
        </div> :

      <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          {email && <p className="mt-1 text-sm text-ink-muted">For {email}</p>}
          <div className="mt-6 space-y-4">
            <Field label="New password" required hint="At least 8 characters with upper- and lower-case letters and a number." error={touched && pwError ? pwError : undefined}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={touched && !!pwError} />}
            </Field>
            <Field label="Confirm password" required error={touched && confirmError ? confirmError : undefined}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={touched && !!confirmError} />}
            </Field>
            {error && <Banner tone="bad">{error}</Banner>}
            <Button type="submit" size="lg" className="w-full" loading={pending}>Reset password</Button>
            <p className="text-center text-sm"><Link to="/login" className="font-medium text-brand-700">Back to sign in</Link></p>
          </div>
        </form>
      }
    </AuthLayout>);

}
