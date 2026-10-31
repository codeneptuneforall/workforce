import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBugTracker } from '../contexts/BugTrackerContext';
import type { Issue, IssueFilterState, SortKey, SortState } from '../types/bugTracker';
import { emptyFilters, filterIssues, sortIssues } from '../utils/issueFilters';

export function useIssueTable(issues: Issue[], initial: Partial<IssueFilterState> = {}, pageSize = 10) {
  const { currentUser, getEmployee, getProject } = useBugTracker();
  const [filters, setFilters] = useState<IssueFilterState>({ ...emptyFilters, ...initial });
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => filterIssues(issues, filters, currentUser.id), [issues, filters, currentUser.id]);
  const sorted = useMemo(
    () =>
    sortIssues(filtered, sort, {
      employeeName: (id) => getEmployee(id)?.name ?? '',
      projectName: (id) => getProject(id)?.name ?? ''
    }),
    [filtered, sort, getEmployee, getProject]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);

  const updateFilter = useCallback(<K extends keyof IssueFilterState,>(key: K, value: IssueFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(emptyFilters);
    setPage(1);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
    prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'createdAt' ? 'desc' : 'asc' }
    );
  }, []);

  const activeFilterCount = (Object.keys(filters) as (keyof IssueFilterState)[]).filter((k) => k !== 'search' && filters[k]).length;

  return {
    filters,
    updateFilter,
    resetFilters,
    sort,
    toggleSort,
    page,
    setPage,
    totalPages,
    pageItems,
    filteredCount: sorted.length,
    activeFilterCount,
    pageSize
  };
}