import { useState } from 'react';
import { CheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react';
import type { Credentials } from '@shared/types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Overlay';

/**
 * Shows a generated sign-in password exactly once.
 *
 * Only a hash is stored on the server, so after this dialog is dismissed the password
 * cannot be recovered — management has to generate a new one instead.
 */
export function CredentialsDialog({
  open,
  credentials,
  employeeName,
  onClose
}: {
  open: boolean;
  credentials: Credentials | null;
  employeeName?: string;
  onClose: () => void;
}) {
  if (!credentials) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign-in credentials"
      description={employeeName ? `Sign-in details for ${employeeName}. Copy these now — the password is not shown again.` : 'Copy these now — the password is not shown again.'}
      footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <KeyRoundIcon className="h-4 w-4" />
          </span>
          <p className="text-sm text-ink-2">
            The employee signs in with their work email and this temporary password. They are
            required to choose their own password before they can use the app.
          </p>
        </div>
        <CopyRow label="Username (work email)" value={credentials.email} />
        <CopyRow label="Temporary password" value={credentials.password} mono />
        <p className="text-xs text-ink-muted">
          Lost it? Open the employee's profile and choose <strong>Reset password</strong> to
          generate a new one.
        </p>
      </div>
    </Modal>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the value is still visible to copy by hand.
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className={mono ? 'truncate font-mono text-sm font-semibold' : 'truncate text-sm'}>{value}</p>
      </div>
      <Button variant="secondary" size="sm" icon={copied ? CheckIcon : CopyIcon} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
