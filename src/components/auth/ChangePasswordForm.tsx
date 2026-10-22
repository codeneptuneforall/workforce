import type * as React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth, validatePassword } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Banner } from '../ui/Primitives';

export function ChangePasswordForm({ onDone }: {onDone?: () => void;}) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextError = next ? validatePassword(next) : 'Enter a new password.';
  const confirmError = confirm !== next ? 'Passwords do not match.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!current || nextError || confirmError) return;
    setPending(true);
    const res = await changePassword(current, next);
    setPending(false);
    if (!res.ok) return setError(res.error ?? 'Could not change password.');
    toast.success('Password changed');
    setCurrent('');
    setNext('');
    setConfirm('');
    setTouched(false);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Current password" required error={touched && !current ? 'Enter your current password.' : undefined}>
        {(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={touched && !current} />}
      </Field>
      <Field label="New password" required hint="At least 8 characters with upper- and lower-case letters and a number." error={touched && nextError ? nextError : undefined}>
        {(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={touched && !!nextError} />}
      </Field>
      <Field label="Confirm new password" required error={touched && confirmError ? confirmError : undefined}>
        {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={touched && !!confirmError} />}
      </Field>
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>Update password</Button>
      </div>
    </form>);

}