import React, { useRef, useState, useEffect } from 'react';
import { AlertTriangleIcon, ArrowLeftIcon, BanIcon, FileQuestionIcon, PaperclipIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { IssueStatusBadge } from '../../components/badges/IssueStatusBadge';
import { PriorityBadge } from '../../components/badges/PriorityBadge';
import { SeverityBadge } from '../../components/badges/SeverityBadge';
import { AttachmentPreview, filesToAttachments } from '../../components/issues/AttachmentField';
import { EditIssueDialog } from '../../components/issues/EditIssueDialog';
import { IssueActionBar } from '../../components/issues/IssueActionBar';
import { IssueActivityTimeline } from '../../components/issues/IssueActivityTimeline';
import { IssueComments } from '../../components/issues/IssueComments';
import { IssueDetailsSidebar } from '../../components/issues/IssueDetailsSidebar';
import { ResolutionPanel } from '../../components/issues/ResolutionPanel';
import { WorkflowProgress } from '../../components/issues/WorkflowProgress';
import { AccessRestricted } from '../../components/ui/AccessRestricted';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState } from '../../components/ui/EmptyState';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { useIssueTransition } from '../../hooks/useIssueTransition';
import { isOverdue } from '../../utils/issueMetrics';
import { canEditIssue, canViewIssue } from '../../utils/permissions';
import { getAvailableTransitions } from '../../utils/workflow';
import type { Issue } from '../../types/bugTracker';

export function IssueDetail() {
  const { issueKey = '' } = useParams();
  const { getIssueByKey, currentUser, permissions, getProject, updateIssue, addAttachments, getIssue } = useBugTracker();
  const { startTransition, openAssignment, dialogs } = useIssueTransition();
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [editing, setEditing] = useState(false);
  const [issueFromApi, setIssueFromApi] = useState<Issue | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const localIssue = getIssueByKey(issueKey);
  const issue = issueFromApi ?? localIssue;

  useEffect(() => {
    if (!localIssue && issueKey) {
      getIssue(issueKey).then((fetched) => {
        if (fetched) setIssueFromApi(fetched);
      });
    }
  }, [issueKey, localIssue, getIssue]);

  if (!issue) {
    return (
      <div className="px-4 py-10">
        <EmptyState
          icon={FileQuestionIcon}
          title={`Issue ${issueKey} not found`}
          description="It may have been removed, or the key is incorrect."
          action={<ButtonLink to={bugTrackerRoutes.issues}>Back to all issues</ButtonLink>} />
        
      </div>);

  }
  if (!canViewIssue(issue, currentUser)) return <AccessRestricted area={`Issue ${issue.key}`} />;

  const transitions = getAvailableTransitions(issue, currentUser.role, currentUser.id);
  const overdue = isOverdue(issue);

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-4 py-6 sm:px-6">
      <Link to={bugTrackerRoutes.issues} className="inline-flex items-center gap-1.5 text-[13px] text-ink-subtle hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        All issues
      </Link>

      <header className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-subtle">
              <span className="font-mono font-medium">{issue.key}</span>
              <span aria-hidden="true">·</span>
              <span>{getProject(issue.projectId)?.name}</span>
              <span aria-hidden="true">·</span>
              <span>{issue.type}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{issue.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <IssueStatusBadge status={issue.status} />
              <SeverityBadge severity={issue.severity} />
              <PriorityBadge priority={issue.priority} />
              {issue.blocked &&
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-ink" title={issue.blockedReason}>
                  <BanIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Blocked
                </span>
              }
              {overdue &&
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-ink">
                  <AlertTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Overdue
                </span>
              }
            </div>
          </div>
          <IssueActionBar
            issue={issue}
            transitions={transitions}
            canEdit={canEditIssue(issue, currentUser)}
            canAssign={permissions.assign && issue.status !== 'Closed'}
            onTransition={(t) => startTransition(issue, t)}
            onEdit={() => setEditing(true)}
            onAssign={() => openAssignment(issue)} />
          
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <WorkflowProgress status={issue.status} />
        </div>
        {issue.blocked && issue.blockedReason &&
        <p className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
            <BanIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Blocked: {issue.blockedReason}
          </p>
        }
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <ResolutionPanel issue={issue} />

          <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div>
              <h2 className="text-sm font-semibold text-ink">Description</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{issue.description}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Steps to reproduce</h2>
              <ol className="mt-2 space-y-1.5">
                {issue.stepsToReproduce.map((step, idx) =>
                <li key={idx} className="flex gap-3 text-sm text-ink-muted">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-soft text-[11px] font-semibold text-neutral-ink">{idx + 1}</span>
                    {step}
                  </li>
                )}
              </ol>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-canvas p-3">
                <h3 className="text-xs font-semibold text-success-ink">Expected result</h3>
                <p className="mt-1 text-sm text-ink-muted">{issue.expectedResult}</p>
              </div>
              <div className="rounded-md border border-line bg-canvas p-3">
                <h3 className="text-xs font-semibold text-danger-ink">Actual result</h3>
                <p className="mt-1 text-sm text-ink-muted">{issue.actualResult}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Attachments <span className="font-normal text-ink-subtle">({issue.attachments.length})</span>
              </h2>
              <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} icon={<PaperclipIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
                Attach file
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="sr-only"
                aria-label="Attach files to issue"
                onChange={(e) => {
                  const { accepted, rejected } = filesToAttachments(Array.from(e.target.files ?? []), currentUser.id);
                  if (accepted.length) {
                    addAttachments(issue.id, accepted);
                    toast.success(`${accepted.length} file${accepted.length > 1 ? 's' : ''} attached`);
                  }
                  if (rejected.length) toast.error(`Too large to attach: ${rejected.join(', ')}`);
                  e.target.value = '';
                }} />
              
            </div>
            {issue.attachments.length ?
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {issue.attachments.map((a) =>
              <li key={a.id} className="overflow-hidden rounded-md border border-line">
                    <AttachmentPreview attachment={a} />
                  </li>
              )}
              </ul> :

            <p className="mt-2 text-[13px] text-ink-faint">No attachments yet.</p>
            }
          </section>

          <section className="rounded-lg border border-line bg-surface shadow-card">
            <div className="flex gap-1 border-b border-line px-3" role="tablist" aria-label="Issue discussion">
              {(['comments', 'activity'] as const).map((t) =>
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-3 text-[13px] font-medium capitalize transition-colors duration-150 ${
                tab === t ? 'border-accent text-ink' : 'border-transparent text-ink-subtle hover:text-ink'}`
                }>
                
                  {t}
                  <span className="ml-1.5 text-xs text-ink-faint">{t === 'comments' ? issue.comments.length : issue.activity.length}</span>
                </button>
              )}
            </div>
            <div className="p-5" role="tabpanel">
              {tab === 'comments' ? <IssueComments issue={issue} /> : <IssueActivityTimeline activity={issue.activity} />}
            </div>
          </section>
        </div>

        <IssueDetailsSidebar issue={issue} />
      </div>

      <EditIssueDialog
        issue={editing ? issue : null}
        onClose={() => setEditing(false)}
        onSave={(patch) => {
          updateIssue(issue.id, patch);
          setEditing(false);
          toast.success(`${issue.key} updated`);
        }} />
      
      {dialogs}
    </div>);

}