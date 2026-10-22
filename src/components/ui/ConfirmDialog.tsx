import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Field, Textarea } from './Field';
import { Modal } from './Overlay';
import { Banner } from './Primitives';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger' | 'success';
  requireReason?: boolean;
  reasonLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}

export function ConfirmDialog({ open, onClose, title, body, confirmLabel, tone = 'primary', requireReason, reasonLabel = 'Reason', pending, error, onConfirm }: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);
  const missing = requireReason && !reason.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
      <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
          variant={tone}
          loading={pending}
          onClick={() => {
            setTouched(true);
            if (!missing) onConfirm(reason);
          }}>
          
            {confirmLabel}
          </Button>
        </>
      }>
      
      <div className="space-y-4">
        <div className="text-sm text-ink-2">{body}</div>
        {requireReason &&
        <Field label={reasonLabel} required error={touched && missing ? 'A reason is required.' : undefined}>
            {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} invalid={touched && !!missing} />}
          </Field>
        }
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Modal>);

}