import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { AssignmentDialog, type AssignmentResult } from '../components/issues/AssignmentDialog';
import { TransitionDialog } from '../components/issues/TransitionDialog';
import { useBugTracker } from '../contexts/BugTrackerContext';
import type { Issue } from '../types/bugTracker';
import type { WorkflowTransition } from '../utils/workflow';

/** Shared flow for running workflow transitions, opening note/assignment dialogs when needed. */
export function useIssueTransition() {
  const { runTransition, assignIssue, getEmployee } = useBugTracker();
  const [pending, setPending] = useState<{issue: Issue;transition: WorkflowTransition;} | null>(null);
  const [assigning, setAssigning] = useState<Issue | null>(null);

  const startTransition = useCallback(
    (issue: Issue, transition: WorkflowTransition) => {
      if (transition.opensAssignment) {
        setAssigning(issue);
        return;
      }
      if (transition.prompt) {
        setPending({ issue, transition });
        return;
      }
      runTransition(issue.id, transition.id)
        .then(() => toast.success(`${issue.key} ${transition.toast}`))
        .catch(() => toast.error(`Failed to move ${issue.key}`));
    },
    [runTransition]
  );

  const confirmTransition = (note: string) => {
    if (!pending) return;
    runTransition(pending.issue.id, pending.transition.id, note)
      .then(() => {
        const message = `${pending.issue.key} ${pending.transition.toast}`;
        if (pending.transition.tone === 'danger') toast.error(message); else toast.success(message);
      })
      .catch(() => toast.error(`Failed to move ${pending.issue.key}`));
    setPending(null);
  };

  const confirmAssignment = (result: AssignmentResult) => {
    if (!assigning) return;
    const issue = assigning;
    assignIssue(issue.id, result)
      .then(() => toast.success(`${issue.key} assigned to ${getEmployee(result.assigneeId)?.name ?? 'developer'}`))
      .catch(() => toast.error(`Failed to assign ${issue.key}`));
    setAssigning(null);
  };

  const dialogs =
  <>
      <TransitionDialog issue={pending?.issue ?? null} transition={pending?.transition ?? null} onClose={() => setPending(null)} onConfirm={confirmTransition} />
      <AssignmentDialog issue={assigning} onClose={() => setAssigning(null)} onConfirm={confirmAssignment} />
    </>;


  return { startTransition, openAssignment: setAssigning, dialogs };
}