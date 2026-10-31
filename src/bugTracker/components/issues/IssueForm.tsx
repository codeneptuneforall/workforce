import React from 'react';
import { AlertCircleIcon, InfoIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { environments, issueTypes, priorities, severities } from '../../data/trackerConfig';
import type { IssueDraft } from '../../types/bugTracker';
import type { IssueFormErrors } from '../../hooks/useIssueForm';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/SelectField';
import { TextField } from '../ui/TextField';
import { AttachmentField } from './AttachmentField';
import { LabelPicker } from './LabelPicker';

interface IssueFormProps {
  draft: IssueDraft;
  errors: IssueFormErrors;
  setField: <K extends keyof IssueDraft>(key: K, value: IssueDraft[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export function IssueForm({ draft, errors, setField, onSubmit, onCancel }: IssueFormProps) {
  const { accessibleProjects, employees, permissions, currentUser } = useBugTracker();
  const errorCount = Object.keys(errors).length;
  const developers = employees.filter((e) => e.role === 'developer' && (!draft.projectId || e.projectIds.includes(draft.projectId)));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-5 lg:grid-cols-[1fr_340px]">
      
      <div className="space-y-5">
        {errorCount > 0 &&
        <div role="alert" className="flex gap-3 rounded-md border border-danger-line bg-danger-soft px-4 py-3">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <div className="text-[13px]">
              <p className="font-medium text-danger-ink">
                {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention before you can submit
              </p>
              <p className="mt-0.5 text-danger-ink/80">Required fields are marked with an asterisk.</p>
            </div>
          </div>
        }

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <TextField id="title" label="Title" required value={draft.title} onChange={(v) => setField('title', v)} placeholder="e.g. Clock-in button double-submits on slow networks" error={errors.title} />
          <TextField id="description" label="Description" required multiline rows={4} value={draft.description} onChange={(v) => setField('description', v)} placeholder="What is happening, who is affected, and how often?" error={errors.description} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="feature" label="Affected feature or page" value={draft.feature} onChange={(v) => setField('feature', v)} placeholder="e.g. Time Tracking › Clock in" />
            <SelectField id="environment" label="Environment" required placeholder="Select environment" value={draft.environment} onChange={(v) => setField('environment', v as IssueDraft['environment'])} options={opts(environments)} error={errors.environment} />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Reproduction</h2>
          <TextField
            id="steps"
            label="Steps to reproduce"
            required
            multiline
            rows={4}
            value={draft.stepsToReproduce}
            onChange={(v) => setField('stepsToReproduce', v)}
            placeholder={'1. Open Time Tracking › Today\n2. Tap Clock in twice\n3. Open the timesheet'}
            hint="One step per line."
            error={errors.stepsToReproduce} />
          
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="expected" label="Expected result" required multiline rows={3} value={draft.expectedResult} onChange={(v) => setField('expectedResult', v)} placeholder="What should happen" error={errors.expectedResult} />
            <TextField id="actual" label="Actual result" required multiline rows={3} value={draft.actualResult} onChange={(v) => setField('actualResult', v)} placeholder="What happens instead" error={errors.actualResult} />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <div>
            <h2 className="text-sm font-semibold text-ink">Screenshots & files</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">Files are uploaded to the server.</p>
          </div>
          <AttachmentField attachments={draft.attachments} onChange={(a) => setField('attachments', a)} uploaderId={currentUser.id} />
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <section className="space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Classification</h2>
          <SelectField id="project" label="Project" required placeholder="Select project" value={draft.projectId} onChange={(v) => setField('projectId', v)} options={accessibleProjects.map((p) => ({ value: p.id, label: p.name }))} error={errors.projectId} />
          <SelectField id="type" label="Issue type" required placeholder="Select type" value={draft.type} onChange={(v) => setField('type', v as IssueDraft['type'])} options={opts(issueTypes)} error={errors.type} />
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink">Severity <span className="ml-0.5 text-danger">*</span></p>
              <div className="flex flex-wrap gap-2">
                {severities.map((s) => (
                  <button key={s} type="button" onClick={() => setField('severity', s)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${draft.severity === s ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface text-ink-muted hover:bg-canvas'}`}>
                    {s}
                  </button>
                ))}
              </div>
              {errors.severity && <p className="mt-1 text-xs text-danger-ink">{errors.severity}</p>}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink">Priority <span className="ml-0.5 text-danger">*</span></p>
              <div className="flex flex-wrap gap-2">
                {priorities.map((p) => (
                  <button key={p} type="button" onClick={() => setField('priority', p)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${draft.priority === p ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface text-ink-muted hover:bg-canvas'}`}>
                    {p}
                  </button>
                ))}
              </div>
              {errors.priority && <p className="mt-1 text-xs text-danger-ink">{errors.priority}</p>}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Labels</p>
            <LabelPicker value={draft.labels} onChange={(l) => setField('labels', l)} />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Assignment</h2>
          {permissions.assign ?
          <>
              <SelectField
              id="assignee"
              label="Assignee"
              placeholder="Leave unassigned for triage"
              value={draft.assigneeId}
              onChange={(v) => setField('assigneeId', v)}
              options={developers.map((d) => ({ value: d.id, label: d.name }))}
              hint="Optional. Assigning skips triage." />
            
              <TextField id="due" label="Due date" type="date" value={draft.dueDate} onChange={(v) => setField('dueDate', v)} hint="Optional" />
            </> :

          <p className="flex gap-2 text-[13px] text-ink-muted">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
              A team lead will triage this issue and assign a developer and due date.
            </p>
          }
        </section>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            Submit issue
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </aside>
    </form>);

}