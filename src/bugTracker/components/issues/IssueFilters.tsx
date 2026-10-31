import React, { useState } from 'react';
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { issueTypes, priorities, severities } from '../../data/trackerConfig';
import type { IssueFilterState } from '../../types/bugTracker';
import { presetLabels } from '../../utils/issueFilters';
import { ALL_STATUSES } from '../../utils/workflow';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/SelectField';

interface IssueFiltersProps {
  filters: IssueFilterState;
  onChange: <K extends keyof IssueFilterState>(key: K, value: IssueFilterState[K]) => void;
  onReset: () => void;
  activeCount: number;
}

const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export function IssueFilters({ filters, onChange, onReset, activeCount }: IssueFiltersProps) {
  const { accessibleProjects, employees, projectScope } = useBugTracker();
  const advancedActive = [filters.projectId, filters.priority, filters.type, filters.reporterId, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const [expanded, setExpanded] = useState(advancedActive > 0);
  const people = employees.map((e) => ({ value: e.id, label: e.name }));
  const assignees = [{ value: 'unassigned', label: 'Unassigned' }, ...employees.filter((e) => e.role === 'developer').map((e) => ({ value: e.id, label: e.name }))];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            placeholder="Filter by key, title, label"
            aria-label="Filter issues"
            className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          
        </div>
        <SelectField id="f-status" compact ariaLabel="Status" placeholder="All statuses" value={filters.status} onChange={(v) => onChange('status', v)} options={toOptions(ALL_STATUSES)} className="w-[calc(50%-4px)] sm:w-36" />
        <SelectField id="f-severity" compact ariaLabel="Severity" placeholder="All severities" value={filters.severity} onChange={(v) => onChange('severity', v)} options={toOptions(severities)} className="w-[calc(50%-4px)] sm:w-36" />
        <SelectField id="f-assignee" compact ariaLabel="Assignee" placeholder="Any assignee" value={filters.assigneeId} onChange={(v) => onChange('assigneeId', v)} options={assignees} className="w-[calc(50%-4px)] sm:w-40" />
        <Button
          size="sm"
          className="h-9"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          icon={<SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />}>
          
          More filters
          {advancedActive > 0 && <span className="rounded bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-ink">{advancedActive}</span>}
        </Button>
        {activeCount > 0 &&
        <Button size="sm" variant="ghost" className="h-9" onClick={onReset}>
            Clear all
          </Button>
        }
      </div>

      {expanded &&
      <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-canvas p-3 md:grid-cols-3 xl:grid-cols-6">
          <SelectField
          id="f-project"
          compact
          label="Project"
          placeholder={projectScope === 'all' ? 'All projects' : 'Header project'}
          value={filters.projectId}
          onChange={(v) => onChange('projectId', v)}
          options={accessibleProjects.map((p) => ({ value: p.id, label: p.name }))} />
        
          <SelectField id="f-priority" compact label="Priority" placeholder="Any priority" value={filters.priority} onChange={(v) => onChange('priority', v)} options={toOptions(priorities)} />
          <SelectField id="f-type" compact label="Issue type" placeholder="All types" value={filters.type} onChange={(v) => onChange('type', v)} options={toOptions(issueTypes)} />
          <SelectField id="f-reporter" compact label="Reporter" placeholder="Anyone" value={filters.reporterId} onChange={(v) => onChange('reporterId', v)} options={people} />
          <DateInput id="f-from" label="Created from" value={filters.dateFrom} onChange={(v) => onChange('dateFrom', v)} />
          <DateInput id="f-to" label="Created to" value={filters.dateTo} onChange={(v) => onChange('dateTo', v)} />
        </div>
      }

      {filters.preset &&
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          Showing
          <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft py-0.5 pl-2 pr-1 font-medium text-accent-ink">
            {presetLabels[filters.preset]}
            <button type="button" onClick={() => onChange('preset', '')} className="rounded p-0.5 hover:bg-accent-line" aria-label="Remove quick filter">
              <XIcon className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      }
    </div>);

}

function DateInput({ id, label, value, onChange }: {id: string;label: string;value: string;onChange: (v: string) => void;}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
      
    </div>);

}