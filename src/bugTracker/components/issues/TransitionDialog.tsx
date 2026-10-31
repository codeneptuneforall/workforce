import React, { useEffect, useState } from 'react';
import type { Issue } from '../../types/bugTracker';
import type { WorkflowTransition } from '../../utils/workflow';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TextField } from '../ui/TextField';

interface TransitionDialogProps {
  issue: Issue | null;
  transition: WorkflowTransition | null;
  onClose: () => void;
  onConfirm: (note: string) => void;
}

export function TransitionDialog({ issue, transition, onClose, onConfirm }: TransitionDialogProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setNote(transition?.id === 'submit-qa' ? issue?.fixSummary ?? '' : '');
    setError('');
  }, [issue, transition]);

  const prompt = transition?.prompt;
  const open = Boolean(issue && transition && prompt);

  const submit = () => {
    if (prompt?.required && !note.trim()) {
      setError(`${prompt.label} is required.`);
      return;
    }
    onConfirm(note);
  };

  const variant = transition?.tone === 'danger' ? 'danger' : transition?.tone === 'success' ? 'success' : 'primary';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prompt?.title ?? ''}
      description={issue ? `${issue.key} · ${issue.title}` : undefined}
      footer={
      <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={variant} onClick={submit}>
            {prompt?.confirmLabel}
          </Button>
        </>
      }>
      
      {prompt &&
      <div className="space-y-3">
          <p className="text-sm text-ink-muted">{prompt.description}</p>
          <TextField
          id="transition-note"
          label={prompt.label}
          required={prompt.required}
          multiline
          rows={4}
          value={note}
          onChange={(v) => {
            setNote(v);
            if (error) setError('');
          }}
          placeholder={prompt.placeholder}
          error={error} />
        
        </div>
      }
    </Modal>);

}