import React, { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface DefinitionItem {
  name: string;
  description: string;
  meta?: string;
  enabled?: boolean;
  usage: number;
}

interface DefinitionListSectionProps {
  title: string;
  description: string;
  itemNoun: string;
  initialItems: DefinitionItem[];
  allowAdd?: boolean;
  metaLabel?: string;
  swatches?: Record<string, string>;
}

export function DefinitionListSection({ title, description, itemNoun, initialItems, allowAdd = false, metaLabel, swatches }: DefinitionListSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [pendingDelete, setPendingDelete] = useState<DefinitionItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} already exists`);
      return;
    }
    setItems((prev) => [...prev, { name, description: newDescription.trim() || '—', enabled: true, usage: 0 }]);
    setNewName('');
    setNewDescription('');
    setAdding(false);
    toast.success(`${itemNoun} “${name}” added to this preview`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-subtle">{description}</p>
        </div>
        {allowAdd && !adding &&
        <Button size="sm" onClick={() => setAdding(true)} icon={<PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
            Add {itemNoun.toLowerCase()}
          </Button>
        }
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-canvas text-xs text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Name</th>
              <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">Description</th>
              {metaLabel && <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">{metaLabel}</th>}
              <th scope="col" className="px-4 py-2 text-right font-medium">In use</th>
              <th scope="col" className="w-28 px-4 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) =>
            <tr key={item.name}>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    {swatches?.[item.name] && <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: swatches[item.name] }} aria-hidden="true" />}
                    {item.name}
                  </span>
                  <p className="mt-0.5 text-xs text-ink-subtle md:hidden">{item.description}</p>
                </td>
                <td className="hidden px-4 py-3 text-ink-muted md:table-cell">{item.description}</td>
                {metaLabel && <td className="hidden whitespace-nowrap px-4 py-3 text-ink-muted lg:table-cell">{item.meta}</td>}
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted">{item.usage}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {item.enabled !== undefined &&
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                    onClick={() => setItems((prev) => prev.map((i) => i.name === item.name ? { ...i, enabled: !i.enabled } : i))}
                    className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${item.enabled ? 'bg-accent' : 'bg-line-strong'}`}>
                    
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-150 ${item.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                  }
                    {allowAdd &&
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item)}
                    className="rounded p-1.5 text-ink-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                    aria-label={`Remove ${item.name}`}>
                    
                        <Trash2Icon className="h-4 w-4" aria-hidden="true" />
                      </button>
                  }
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {adding &&
        <div className="flex flex-col gap-2 border-t border-line bg-canvas p-3 sm:flex-row">
            <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`${itemNoun} name`}
            aria-label={`${itemNoun} name`}
            className="h-9 rounded-md border border-line-strong bg-surface px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:w-48" />
          
            <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description"
            aria-label="Description"
            className="h-9 flex-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          
            <div className="flex gap-2">
              <Button size="sm" className="h-9" variant="primary" onClick={add} disabled={!newName.trim()}>
                Add
              </Button>
              <Button size="sm" className="h-9" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        }
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Remove “${pendingDelete?.name}”?`}
        message={
        pendingDelete?.usage ?
        `${pendingDelete.usage} issue${pendingDelete.usage === 1 ? '' : 's'} use this ${itemNoun.toLowerCase()}. They will keep their current value, but it can’t be chosen for new issues.` :
        `It can’t be chosen for new issues after removal.`
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (!pendingDelete) return;
          setItems((prev) => prev.filter((i) => i.name !== pendingDelete.name));
          toast.success(`${pendingDelete.name} removed from this preview`);
        }} />
      
    </div>);

}