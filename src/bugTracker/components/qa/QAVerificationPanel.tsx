import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, FlaskConicalIcon, InfoIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import type { Issue } from '../../types/bugTracker';
import { formatDateTime } from '../../utils/dates';
import { IssueStatusBadge } from '../badges/IssueStatusBadge';
import { SeverityBadge } from '../badges/SeverityBadge';
import { AttachmentPreview, filesToAttachments } from '../issues/AttachmentField';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

interface QAVerificationPanelProps {
  issue: Issue;
  onOutcome: (outcome: 'passed' | 'failed', issue: Issue) => void;
}

export function QAVerificationPanel({ issue, onOutcome }: QAVerificationPanelProps) {
  const { getEmployee, getProject, runTransition, addComment, addAttachments, permissions, currentUser } = useBugTracker();
  const [notes, setNotes] = useState('');
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotes('');
    setFailing(false);
    setReason('');
    setReasonError('');
  }, [issue.id]);

  const developer = getEmployee(issue.assigneeId);
  const evidence = issue.attachments.filter((a) => a.uploadedById !== issue.reporterId);
  const canVerify = permissions.verifyQA;

  const pass = () => {
    runTransition(issue.id, 'pass-qa', notes);
    onOutcome('passed', issue);
  };

  const fail = () => {
    if (!reason.trim()) {
      setReasonError('Explain what still fails so the developer can fix it.');
      return;
    }
    runTransition(issue.id, 'fail-qa', reason);
    onOutcome('failed', issue);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink-subtle">{issue.key}</span>
          <IssueStatusBadge status={issue.status} />
          <SeverityBadge severity={issue.severity} />
        </div>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug text-ink">{issue.title}</h2>
        <p className="mt-1 text-[13px] text-ink-subtle">
          {getProject(issue.projectId)?.name} · fixed by {developer?.name ?? 'Unassigned'}
          {issue.submittedForQaAt && ` · submitted ${formatDateTime(issue.submittedForQaAt)}`}
        </p>
        <Link to={bugTrackerRoutes.issue(issue.key)} className="mt-1 inline-block text-[13px] font-medium text-accent hover:text-accent-hover">
          Open full issue
        </Link>
      </div>

      <div className="rounded-md border border-teal-line bg-teal-soft p-3">
        <h3 className="text-xs font-semibold text-teal-ink">Developer’s fix summary</h3>
        <p className="mt-1 text-[13px] text-ink-muted">{issue.fixSummary ?? 'No summary provided.'}</p>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-ink">Verify with these steps</h3>
        <ol className="mt-2 space-y-1.5">
          {issue.stepsToReproduce.map((step, idx) =>
          <li key={idx} className="flex gap-2.5 text-[13px] text-ink-muted">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-soft text-[11px] font-semibold text-neutral-ink">{idx + 1}</span>
              {step}
            </li>
          )}
        </ol>
        <p className="mt-2 text-[13px] text-ink-muted">
          <span className="font-medium text-success-ink">Expected:</span> {issue.expectedResult}
        </p>
      </div>

      {!canVerify ?
      <p className="flex gap-2 rounded-md border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink-muted">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
          Only QA testers can pass or fail verification. You can follow progress here.
        </p> :
      issue.status === 'Fixed' ?
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas px-4 py-3">
          <p className="text-[13px] text-ink-muted">Pick this up to begin verification.</p>
          <Button
          variant="primary"
          icon={<FlaskConicalIcon className="h-4 w-4" aria-hidden="true" />}
          onClick={() => {
            runTransition(issue.id, 'start-testing');
            toast.success(`${issue.key} moved to QA Testing`);
          }}>
          
            Start testing
          </Button>
        </div> :

      <div className="space-y-4 border-t border-line pt-5">
          <TextField id="qa-notes" label="Test notes" multiline rows={3} value={notes} onChange={setNotes} placeholder="Devices, browsers, test data and scenarios covered" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
            size="sm"
            variant="ghost"
            disabled={!notes.trim()}
            onClick={() => {
              addComment(issue.id, notes, 'test-note');
              setNotes('');
              toast.success('Test note saved to the issue');
            }}>
            
              Save as test note
            </Button>
            <Button size="sm" variant="ghost" icon={<PaperclipIcon className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
              Attach evidence
            </Button>
            <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.log,.har"
            className="sr-only"
            aria-label="Attach evidence"
            onChange={(e) => {
              const { accepted, rejected } = filesToAttachments(Array.from(e.target.files ?? []), currentUser.id);
              if (accepted.length) {
                addAttachments(issue.id, accepted);
                toast.success(`${accepted.length} evidence file${accepted.length > 1 ? 's' : ''} attached`);
              }
              if (rejected.length) toast.error(`Too large: ${rejected.join(', ')}`);
              e.target.value = '';
            }} />
          
          </div>
          {evidence.length > 0 &&
        <ul className="grid grid-cols-3 gap-2">
              {evidence.map((a) =>
          <li key={a.id} className="overflow-hidden rounded-md border border-line">
                  <AttachmentPreview attachment={a} />
                </li>
          )}
            </ul>
        }

          {failing ?
        <div className="space-y-3 rounded-md border border-danger-line bg-danger-soft p-4">
              <TextField
            id="qa-fail-reason"
            label="Reason for failure"
            required
            multiline
            rows={3}
            value={reason}
            onChange={(v) => {
              setReason(v);
              setReasonError('');
            }}
            placeholder="What still fails, on which device or data, and how to reproduce it"
            error={reasonError} />
          
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" onClick={() => setFailing(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="danger" onClick={fail}>
                  Reopen with reason
                </Button>
              </div>
            </div> :

        <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="success" className="flex-1" icon={<CheckIcon className="h-4 w-4" aria-hidden="true" />} onClick={pass}>
                Pass verification
              </Button>
              <Button variant="danger-outline" className="flex-1" icon={<XIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setFailing(true)}>
                Fail verification
              </Button>
            </div>
        }
        </div>
      }
    </div>);

}