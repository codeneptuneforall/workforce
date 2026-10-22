import { Loader2Icon } from 'lucide-react';

/**
 * Shown while the session is being restored from the httpOnly cookie.
 *
 * The route guards must not redirect before this finishes: on a page reload the account
 * is unknown for a moment, and sending the user to the sign-in screen at that point would
 * log them out even though the session cookie is still valid.
 */
export function SessionLoading({ label = 'Checking your session…' }: {label?: string;}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <Loader2Icon className="h-6 w-6 animate-spin text-brand-700" />
        <p className="text-sm text-ink-muted">{label}</p>
      </div>
    </div>);
}
