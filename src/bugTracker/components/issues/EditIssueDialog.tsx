import React, { useEffect, useState } from 'react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { environments, issueTypes, priorities, severities } from '../../data/trackerConfig';
import type { Environment, Issue, IssueEditablePatch, IssueType, Priority, Severity } from '../../types/bugTracker';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SelectField } from '../ui/SelectField';
import { TextField } from '../ui/TextField';
import { LabelPicker } from './LabelPicker';

interface EditIssueDialogProps {
  issue: Issue | null;
  onClose: () => void;
  onSave: (patch: IssueEditablePatch) => void;
}

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export function EditIssueDialog({ issue, onClose, onSave }: EditIssueDialogProps) {
  const { permissions } = useBugTracker();
  const [form, setForm] = useState<Required<IssueEditablePatch> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!issue) return;
    setForm({
      title: issue.title,
      description: issue.description,
      type: issue.type,
      severity: issue.severity,
      priority: issue.priority,
      dueDate: issue.dueDate,
      feature: issue.feature,
      environment: issue.environment,
      labels: issue.labels,
      assigneeId: issue.assigneeId ?? '',
      status: issue.status
    });
    setError('');
  }, [issue]);

  const set = <K extends keyof IssueEditablePatch,>(key: K, value: Required<IssueEditablePatch>[K]) => setForm((f) => f ? { ...f, [key]: value } : f);

  const save = () => {
    if (!form) return;
    if (form.title.trim().length < 10) {
      setError('Title should be at least 10 characters.');
      return;
    }
    const patch: IssueEditablePatch = { ...form, title: form.title.trim(), description: form.description.trim() };
    if (!permissions.setPriority) {
      delete patch.priority;
      delete patch.dueDate;
    }
    onSave(patch);
  };

  return (
    <Modal
      open={Boolean(issue && form)}
      onClose={onClose}
      title={`Edit ${issue?.key ?? ''}`}
      size="lg"
      footer={
      <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save changes
          </Button>
        </>
      }>
      
      {form &&
      <div className="space-y-4">
          <TextField id="edit-title" label="Title" required value={form.title} onChange={(v) => {set('title', v);setError('');}} error={error} />
          <TextField id="edit-description" label="Description" multiline rows={4} value={form.description} onChange={(v) => set('description', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="edit-type" label="Issue type" value={form.type} onChange={(v) => set('type', v as IssueType)} options={opts(issueTypes)} />
            <SelectField id="edit-severity" label="Severity" value={form.severity} onChange={(v) => set('severity', v as Severity)} options={opts(severities)} />
            <SelectField
            id="edit-priority"
            label="Priority"
            value={form.priority}
            onChange={(v) => set('priority', v as Priority)}
            options={opts(priorities)}
            disabled={!permissions.setPriority}
            hint={!permissions.setPriority ? 'Set by team leads during triage' : undefined} />
          
            <TextField
            id="edit-due"
            label="Due date"
            type="date"
            value={form.dueDate ?? ''}
            onChange={(v) => set('dueDate', v || null)}
            disabled={!permissions.setPriority}
            hint={!permissions.setPriority ? 'Set by team leads during triage' : undefined} />
          
            <TextField id="edit-feature" label="Affected feature" value={form.feature} onChange={(v) => set('feature', v)} />
            <SelectField id="edit-env" label="Environment" value={form.environment} onChange={(v) => set('environment', v as Environment)} options={opts(environments)} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Labels</p>
            <LabelPicker value={form.labels} onChange={(l) => set('labels', l)} />
          </div>
        </div>
      }
    </Modal>);

}