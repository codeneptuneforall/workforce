import React, { useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { trackerLabels } from '../../data/trackerConfig';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function LabelsSection() {
  const { issues } = useBugTracker();
  const [labels, setLabels] = useState(trackerLabels);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const usage = (label: string) => issues.filter((i) => i.labels.includes(label)).length;

  const add = () => {
    const label = draft.trim().toLowerCase().replace(/\s+/g, '-');
    if (!label) return;
    if (labels.includes(label)) {
      toast.error(`“${label}” already exists`);
      return;
    }
    setLabels((prev) => [...prev, label]);
    setDraft('');
    toast.success(`Label “${label}” added to this preview`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Labels</h2>
        <p className="mt-0.5 text-[13px] text-ink-subtle">Shared labels help filter and group issues across projects.</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2">
          
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New label name"
            aria-label="New label name"
            className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:max-w-xs" />
          
          <Button type="submit" size="sm" className="h-9" variant="primary" disabled={!draft.trim()} icon={<PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
            Add label
          </Button>
        </form>
        <ul className="mt-4 flex flex-wrap gap-2">
          {labels.map((label) =>
          <li key={label} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas py-1 pl-2.5 pr-1 text-[13px] text-ink">
              {label}
              <span className="text-xs text-ink-faint tabular-nums">{usage(label)}</span>
              <button type="button" onClick={() => setPending(label)} className="rounded p-0.5 text-ink-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger" aria-label={`Delete label ${label}`}>
                <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          )}
        </ul>
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={`Delete label “${pending}”?`}
        message={pending && usage(pending) ? `${usage(pending)} issue(s) currently use it. The label stays on those issues but can’t be added to new ones.` : 'This label isn’t used by any issues.'}
        confirmLabel="Delete label"
        onConfirm={() => {
          setLabels((prev) => prev.filter((l) => l !== pending));
          toast.success(`Label “${pending}” deleted from this preview`);
        }} />
      
    </div>);

}