import React, { useEffect, useMemo } from 'react';
import { AlertCircleIcon, PlusIcon, SearchXIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { IssueFilters } from '../../components/issues/IssueFilters';
import { IssueTable } from '../../components/issues/IssueTable';
import { Pagination } from '../../components/issues/Pagination';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useBugTracker } from '../../contexts/BugTrackerContext';
import { bugTrackerRoutes } from '../../data/navigation';
import { useIssueTable } from '../../hooks/useIssueTable';
import type { IssueFilterState, IssuePreset } from '../../types/bugTracker';

export function AllIssues() {
  const { scopedIssues, projectScope, getProject } = useBugTracker();
  const [params] = useSearchParams();

  const initial = useMemo<Partial<IssueFilterState>>(
    () => ({
      search: params.get('q') ?? '',
      status: params.get('status') ?? '',
      severity: params.get('severity') ?? '',
      preset: (params.get('preset') ?? '') as IssuePreset
    }),
    // Only read URL params on first render; later changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const table = useIssueTable(scopedIssues, initial);
  const { updateFilter } = table;

  useEffect(() => {
    updateFilter('search', params.get('q') ?? '');
    updateFilter('preset', (params.get('preset') ?? '') as IssuePreset);
  }, [params, updateFilter]);

  const scopeLabel = projectScope === 'all' ? 'all your projects' : getProject(projectScope)?.name;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="All issues"
        description={`${scopedIssues.length} issues across ${scopeLabel}`}
        actions={
        <ButtonLink to={bugTrackerRoutes.report} variant="primary" className="bg-[#4c2e87] hover:bg-[#3a2266]" icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
            Report a bug
          </ButtonLink>
        } />
      

      <IssueFilters filters={table.filters} onChange={table.updateFilter} onReset={table.resetFilters} activeCount={table.activeFilterCount + (table.filters.search ? 1 : 0)} />

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {scopedIssues.length === 0 ?
        <EmptyState
          icon={AlertCircleIcon}
          title="No issues yet"
          description="Nothing has been reported in this project. Issues you and your team report will appear here."
          action={
          <ButtonLink to={bugTrackerRoutes.report} variant="primary">
                Report the first bug
              </ButtonLink>
          } /> :

        table.filteredCount === 0 ?
        <EmptyState
          icon={SearchXIcon}
          title="No issues match these filters"
          description="Try removing a filter or searching for a different key or keyword."
          action={<Button onClick={table.resetFilters}>Clear all filters</Button>} /> :


        <>
            <IssueTable issues={table.pageItems} sort={table.sort} onSort={table.toggleSort} />
            <Pagination page={table.page} totalPages={table.totalPages} total={table.filteredCount} pageSize={table.pageSize} onPageChange={table.setPage} />
          </>
        }
      </div>
    </div>);

}