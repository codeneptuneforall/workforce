import React, { useState } from 'react';
import { MessageSquareIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import type { CommentKind, Issue } from '../../types/bugTracker';
import { formatDateTime, relativeTime } from '../../utils/dates';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

const kindLabels: Partial<Record<CommentKind, {label: string;className: string;}>> = {
  'test-note': { label: 'Test note', className: 'bg-info-soft text-info-ink' },
  clarification: { label: 'Clarification', className: 'bg-violet-soft text-violet-ink' },
  'qa-fail': { label: 'QA failed', className: 'bg-danger-soft text-danger-ink' },
  'qa-pass': { label: 'QA passed', className: 'bg-success-soft text-success-ink' },
  reopen: { label: 'Reopen reason', className: 'bg-danger-soft text-danger-ink' }
};

export function IssueComments({ issue }: {issue: Issue;}) {
  const { getEmployee, addComment, currentUser, role } = useBugTracker();
  const [body, setBody] = useState('');
  const [asTestNote, setAsTestNote] = useState(false);

  const defaultKind: CommentKind = role === 'reporter' ? 'clarification' : 'comment';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addComment(issue.id, body, asTestNote ? 'test-note' : defaultKind);
    setBody('');
    setAsTestNote(false);
    toast.success(asTestNote ? 'Test note added' : role === 'reporter' ? 'Clarification added' : 'Comment added');
  };

  return (
    <div>
      {issue.comments.length === 0 ?
      <div className="flex flex-col items-center py-8 text-center">
          <MessageSquareIcon className="h-5 w-5 text-ink-faint" aria-hidden="true" />
          <p className="mt-2 text-sm text-ink-subtle">No comments yet. Start the conversation below.</p>
        </div> :

      <ul className="space-y-5">
          {issue.comments.map((c) => {
          const author = getEmployee(c.authorId);
          const kind = kindLabels[c.kind];
          return (
            <li key={c.id} className="flex gap-3">
                <Avatar employee={author} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-medium text-ink">{author?.name}</span>
                    {kind && <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${kind.className}`}>{kind.label}</span>}
                    <time className="text-xs text-ink-faint" dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                      {relativeTime(c.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{c.body}</p>
                </div>
              </li>);

        })}
        </ul>
      }

      <form onSubmit={submit} className="mt-6 flex gap-3">
        <Avatar employee={currentUser} />
        <div className="min-w-0 flex-1">
          <label htmlFor="comment-body" className="sr-only">
            {role === 'reporter' ? 'Add a clarification' : 'Add a comment'}
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={role === 'reporter' ? 'Add a clarification for the team…' : 'Add a comment…'}
            className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {role === 'qa' || role === 'admin' ?
            <label className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                <input type="checkbox" checked={asTestNote} onChange={(e) => setAsTestNote(e.target.checked)} className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent/30" />
                Mark as test note
              </label> :

            <span />
            }
            <Button type="submit" size="sm" variant="primary" disabled={!body.trim()}>
              {role === 'reporter' ? 'Add clarification' : 'Comment'}
            </Button>
          </div>
        </div>
      </form>
    </div>);

}