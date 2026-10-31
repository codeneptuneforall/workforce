import React, { useState } from 'react';
import { DefinitionListSection } from '../../components/settings/DefinitionListSection';
import { LabelsSection } from '../../components/settings/LabelsSection';
import { ProjectDefaultsSection } from '../../components/settings/ProjectDefaultsSection';
import { RolePermissionsSection } from '../../components/settings/RolePermissionsSection';
import { StatusWorkflowSection } from '../../components/settings/StatusWorkflowSection';
import { AccessRestricted } from '../../components/ui/AccessRestricted';
import { PageHeader } from '../../components/ui/PageHeader';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { issueTypeDefinitions, priorityDefinitions, severityDefinitions } from '../../data/trackerConfig';
import { severityStyles } from '../../utils/issueStyles';

type SectionId = 'types' | 'severity' | 'priority' | 'workflow' | 'labels' | 'defaults' | 'roles';

const sections: {id: SectionId;label: string;}[] = [
{ id: 'types', label: 'Issue types' },
{ id: 'severity', label: 'Severity levels' },
{ id: 'priority', label: 'Priority levels' },
{ id: 'workflow', label: 'Status workflow' },
{ id: 'labels', label: 'Labels' },
{ id: 'defaults', label: 'Project defaults' },
{ id: 'roles', label: 'Roles & permissions' }];


export function Settings() {
  const { permissions, issues } = useBugTracker();
  const [active, setActive] = useState<SectionId>('types');

  if (!permissions.manageSettings) return <AccessRestricted area="Tracker Settings" />;

  const count = (field: 'type' | 'severity' | 'priority', value: string) => issues.filter((i) => i[field] === value).length;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="Tracker settings" description="Configure how issues are classified and moved through the workflow. Changes apply to this preview only." />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-1 md:flex-col">
            {sections.map((s) =>
            <li key={s.id}>
                <button
                type="button"
                onClick={() => setActive(s.id)}
                aria-current={active === s.id ? 'page' : undefined}
                className={`w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors duration-150 ${
                active === s.id ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-subtle hover:bg-neutral-soft hover:text-ink'}`
                }>
                
                  {s.label}
                </button>
              </li>
            )}
          </ul>
        </nav>
        <div className="min-w-0">
          {active === 'types' &&
          <DefinitionListSection
            key="types"
            title="Issue types"
            description="Types reporters can choose when submitting an issue."
            itemNoun="Issue type"
            allowAdd
            initialItems={issueTypeDefinitions.map((t) => ({ ...t, usage: count('type', t.name) }))} />

          }
          {active === 'severity' &&
          <DefinitionListSection
            key="severity"
            title="Severity levels"
            description="How much impact an issue has on employees and the business."
            itemNoun="Severity"
            metaLabel="Response target"
            swatches={Object.fromEntries(Object.entries(severityStyles).map(([k, v]) => [k, v.hex]))}
            initialItems={severityDefinitions.map((s) => ({ name: s.name, description: s.description, meta: s.target, usage: count('severity', s.name) }))} />

          }
          {active === 'priority' &&
          <DefinitionListSection
            key="priority"
            title="Priority levels"
            description="How soon the team should act. Set by team leads during triage."
            itemNoun="Priority"
            metaLabel="Default due"
            initialItems={priorityDefinitions.map((p) => ({ name: p.name, description: p.description, meta: p.target, usage: count('priority', p.name) }))} />

          }
          {active === 'workflow' && <StatusWorkflowSection />}
          {active === 'labels' && <LabelsSection />}
          {active === 'defaults' && <ProjectDefaultsSection />}
          {active === 'roles' && <RolePermissionsSection />}
        </div>
      </div>
    </div>);

}