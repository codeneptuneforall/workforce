import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2Icon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IssueStatusBadge } from '../../components/badges/IssueStatusBadge';
import { SeverityBadge } from '../../components/badges/SeverityBadge';
import { IssueForm } from '../../components/issues/IssueForm';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { PageHeader } from '../../components/ui/PageHeader';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { useIssueForm } from '../../hooks/useIssueForm';
import type { Issue } from '../../types/bugTracker';

export function ReportBug() {
  const { createIssue, projectScope, getEmployee, getProject } = useBugTracker();
  const navigate = useNavigate();
  const initialProject = projectScope === 'all' ? '' : projectScope;
  const form = useIssueForm(initialProject);
  const [created, setCreated] = useState<Issue | null>(null);

  const submit = async () => {
    const errors = form.validate();
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const idMap: Record<string, string> = { stepsToReproduce: 'steps', expectedResult: 'expected', actualResult: 'actual', projectId: 'project' };
      document.getElementById(idMap[firstError] ?? firstError)?.focus();
      return;
    }
    const issue = await createIssue(form.draft);
    if (!issue) return;
    setCreated(issue);
    toast.success(`${issue.key} added to the tracker`, { description: 'Stored in the Workforce database.' });
  };

  if (created) {
    const assignee = getEmployee(created.assigneeId);
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
          
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink">Issue {created.key} reported</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            {assignee ? `It’s been assigned to ${assignee.name}.` : 'It’s waiting in the triage queue for a team lead to review.'} You’ll be notified as it moves through the workflow.
          </p>
          <div className="mt-5 rounded-md border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-ink-subtle">{created.key}</span>
              <IssueStatusBadge status={created.status} />
              <SeverityBadge severity={created.severity} />
            </div>
            <p className="mt-2 text-sm font-medium text-ink">{created.title}</p>
            <p className="mt-1 text-xs text-ink-subtle">
              {getProject(created.projectId)?.name} · {created.type} · {created.attachments.length} attachment{created.attachments.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink to={bugTrackerRoutes.issue(created.key)} variant="primary">
              View issue
            </ButtonLink>
            <Button
              onClick={() => {
                form.reset(initialProject);
                setCreated(null);
              }}>
              
              Report another
            </Button>
          </div>
        </motion.div>
      </div>);

  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="Report a bug" description="Clear reproduction steps help developers fix issues faster." />
      <IssueForm draft={form.draft} errors={form.errors} setField={form.setField} onSubmit={submit} onCancel={() => navigate(bugTrackerRoutes.issues)} />
    </div>);

}