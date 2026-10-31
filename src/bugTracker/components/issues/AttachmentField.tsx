import React, { useRef, useState } from 'react';
import { FileTextIcon, ImageIcon, PaperclipIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import type { Attachment } from '../../types/bugTracker';
import { nowIso } from '../../utils/dates';
import { createId } from '../../utils/issueService';

const MAX_SIZE_MB = 10;

interface AttachmentFieldProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  uploaderId: string;
  compact?: boolean;
}

export function filesToAttachments(files: File[], uploaderId: string): {accepted: Attachment[];rejected: string[];} {
  const accepted: Attachment[] = [];
  const rejected: string[] = [];
  files.forEach((file) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      rejected.push(file.name);
      return;
    }
    const isImage = file.type.startsWith('image/');
    accepted.push({
      id: createId('att'),
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      kind: isImage ? 'image' : /\.(log|har|txt)$/i.test(file.name) ? 'log' : 'document',
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      uploadedById: uploaderId,
      uploadedAt: nowIso()
    });
  });
  return { accepted, rejected };
}

export function AttachmentField({ attachments, onChange, uploaderId, compact = false }: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const addFiles = (files: File[]) => {
    const result = filesToAttachments(files, uploaderId);
    setRejected(result.rejected);
    if (result.accepted.length) onChange([...attachments, ...result.accepted]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors duration-150 ${compact ? 'py-4' : 'py-7'} ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas'}`
        }>
        
        <UploadCloudIcon className="h-5 w-5 text-ink-faint" aria-hidden="true" />
        <p className="mt-2 text-[13px] text-ink-muted">
          Drag screenshots or logs here, or{' '}
          <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-accent hover:text-accent-hover">
            browse files
          </button>
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">PNG, JPG, PDF, TXT, LOG, HAR up to {MAX_SIZE_MB} MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.log,.har,.csv"
          className="sr-only"
          aria-label="Attach files"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }} />
        
      </div>
      {rejected.length > 0 && <p className="mt-2 text-xs text-danger-ink">Too large to attach: {rejected.join(', ')}</p>}
      {attachments.length > 0 &&
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((a) =>
        <li key={a.id} className="group relative overflow-hidden rounded-md border border-line bg-surface">
              <AttachmentPreview attachment={a} />
              <button
            type="button"
            onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
            className="absolute right-1.5 top-1.5 rounded bg-surface/90 p-1 text-ink-muted shadow-card hover:text-danger"
            aria-label={`Remove ${a.name}`}>
            
                <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
        )}
        </ul>
      }
    </div>);

}

export function AttachmentPreview({ attachment }: {attachment: Attachment;}) {
  const [broken, setBroken] = useState(false);
  const Icon = attachment.kind === 'image' ? ImageIcon : attachment.kind === 'log' ? PaperclipIcon : FileTextIcon;
  return (
    <>
      <div className="flex h-20 items-center justify-center bg-canvas">
        {attachment.previewUrl && !broken ?
        <img src={attachment.previewUrl} alt={attachment.name} className="h-full w-full object-cover" onError={() => setBroken(true)} /> :

        <Icon className="h-6 w-6 text-ink-faint" aria-hidden="true" />
        }
      </div>
      <div className="border-t border-line px-2 py-1.5">
        <p className="truncate text-xs font-medium text-ink" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-[11px] text-ink-faint">{attachment.sizeKb >= 1024 ? `${(attachment.sizeKb / 1024).toFixed(1)} MB` : `${attachment.sizeKb} KB`}</p>
      </div>
    </>);

}