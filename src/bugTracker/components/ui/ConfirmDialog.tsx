import React from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      footer={
      <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}>
          
            {confirmLabel}
          </Button>
        </>
      } />);


}