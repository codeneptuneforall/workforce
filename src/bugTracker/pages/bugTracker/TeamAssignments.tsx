import React, { useMemo, useState } from 'react';
import { UnassignedQueue } from '../../components/team/UnassignedQueue';
import { WorkloadTable } from '../../components/team/WorkloadTable';
import { AccessRestricted } from '../../components/ui/AccessRestricted';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/SelectField';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { workloadCapacity } from '../../data/trackerConfig';
import { useIssueTransition } from '../../hooks/useIssueTransition';
import { isOverdue } from '../../utils/issueMetrics';
import { severityRank } from '../../utils/issueStyles';
import { isOpenStatus } from '../../utils/workflow';

export function TeamAssignments() {
  const { permissions, teams, employees, scopedIssues } = useBugTracker();
  const { openAssignment, dialogs } = useIssueTransition();
  const [teamId, setTeamId] = useState('');

  const members = useMemo(() => employees.filter((e) => e.role === 'developer' && (!teamId || e.teamId === teamId)), [employees, teamId]);
  const memberIds = new Set(members.map((m) => m.id));
  const teamIssues = scopedIssues.filter((i) => i.assigneeId && memberIds.has(i.assigneeId));
  const openTeamIssues = teamIssues.filter((i) => isOpenStatus(i.status));
  const unassigned = useMemo(
    () => scopedIssues.filter((i) => !i.assigneeId && isOpenStatus(i.status)).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
    [scopedIssues]
  );

  if (!permissions.viewTeam) return <AccessRestricted area="Team & Assignments" />;

  const overCapacity = members.filter((m) => openTeamIssues.filter((i) => i.assigneeId === m.id).length > workloadCapacity).length;
  const stats = [
  { label: 'Developers', value: members.length },
  { label: 'Open assigned issues', value: openTeamIssues.length },
  { label: 'Overdue', value: openTeamIssues.filter(isOverdue).length, danger: true },
  { label: 'Over capacity', value: overCapacity, danger: true }];


  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Team & assignments"
        description="Balance workload and route unassigned issues to the right developer."
        actions={
        <SelectField
          id="team-select"
          compact
          ariaLabel="Team"
          placeholder="All engineering teams"
          value={teamId}
          onChange={setTeamId}
          options={teams.filter((t) => t.id !== 'team-qa').map((t) => ({ value: t.id, label: t.name }))}
          className="w-60" />

        } />
      

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-4">
        {stats.map((s) =>
        <div key={s.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-ink-subtle">{s.label}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${s.danger && s.value > 0 ? 'text-danger-ink' : 'text-ink'}`}>{s.value}</dd>
          </div>
        )}
      </dl>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title="Developer workload" description="Select a developer to see and reassign their open issues" bodyClassName="">
          {members.length ?
          <WorkloadTable members={members} issues={teamIssues} onReassign={openAssignment} /> :

          <p className="px-4 py-10 text-center text-sm text-ink-subtle">No developers in this team.</p>
          }
        </Panel>
        <Panel title={`Needs an owner (${unassigned.length})`} description="New and triaged issues, most severe first" bodyClassName="" className="xl:self-start">
          <UnassignedQueue issues={unassigned} onAssign={openAssignment} />
        </Panel>
      </div>
      {dialogs}
    </div>);

}