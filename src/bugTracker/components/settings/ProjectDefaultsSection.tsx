import React, { useState } from 'react';
import { toast } from 'sonner';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { priorities, projectDefaults } from '../../data/trackerConfig';
import type { Priority } from '../../types/bugTracker';
import { Button } from '../ui/Button';

export function ProjectDefaultsSection() {
  const { getProject, employees } = useBugTracker();
  const [rows, setRows] = useState(projectDefaults);
  const [dirty, setDirty] = useState(false);
  const developers = employees.filter((e) => e.role === 'developer');

  const update = (projectId: string, patch: Partial<(typeof projectDefaults)[number]>) => {
    setRows((prev) => prev.map((r) => r.projectId === projectId ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const cell = 'h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Project defaults</h2>
          <p className="mt-0.5 text-[13px] text-ink-subtle">Applied when an issue is reported without these values.</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              setRows(projectDefaults);
              setDirty(false);
            }}>
            
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              setDirty(false);
              toast.success('Project defaults updated in this preview');
            }}>
            
            Save defaults
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="border-b border-line bg-canvas text-xs text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Project</th>
              <th scope="col" className="px-4 py-2 font-medium">Default assignee</th>
              <th scope="col" className="px-4 py-2 font-medium">Default priority</th>
              <th scope="col" className="px-4 py-2 font-medium">Due in (days)</th>
              <th scope="col" className="px-4 py-2 font-medium">QA required</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const name = getProject(r.projectId)?.name;
              return (
                <tr key={r.projectId}>
                  <td className="px-4 py-2.5 font-medium text-ink">{name}</td>
                  <td className="px-4 py-2.5">
                    <select aria-label={`${name} default assignee`} value={r.defaultAssigneeId} onChange={(e) => update(r.projectId, { defaultAssigneeId: e.target.value })} className={cell}>
                      {developers.map((d) =>
                      <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select aria-label={`${name} default priority`} value={r.defaultPriority} onChange={(e) => update(r.projectId, { defaultPriority: e.target.value as Priority })} className={cell}>
                      {priorities.map((p) =>
                      <option key={p}>{p}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      aria-label={`${name} due in days`}
                      value={r.dueInDays}
                      onChange={(e) => update(r.projectId, { dueInDays: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${cell} w-20`} />
                    
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.requireQa}
                      aria-label={`${name} requires QA`}
                      onClick={() => update(r.projectId, { requireQa: !r.requireQa })}
                      className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${r.requireQa ? 'bg-accent' : 'bg-line-strong'}`}>
                      
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-150 ${r.requireQa ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div>
    </div>);

}