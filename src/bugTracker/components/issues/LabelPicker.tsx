import React, { useState } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { trackerLabels } from '../../data/trackerConfig';

interface LabelPickerProps {
  value: string[];
  onChange: (labels: string[]) => void;
}

export function LabelPicker({ value, onChange }: LabelPickerProps) {
  const [custom, setCustom] = useState('');
  const options = Array.from(new Set([...trackerLabels, ...value]));

  const toggle = (label: string) => onChange(value.includes(label) ? value.filter((l) => l !== label) : [...value, label]);
  const addCustom = () => {
    const label = custom.trim().toLowerCase().replace(/\s+/g, '-');
    if (label && !value.includes(label)) onChange([...value, label]);
    setCustom('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Labels">
        {options.map((label) => {
          const selected = value.includes(label);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(label)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150 ${
              selected ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'}`
              }>
              
              {selected && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
              {label}
            </button>);

        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a new label"
          aria-label="New label"
          className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
        
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:bg-canvas disabled:opacity-50">
          
          <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </button>
      </div>
    </div>);

}