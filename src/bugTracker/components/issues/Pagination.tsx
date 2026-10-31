import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3" aria-label="Pagination">
      <p className="text-[13px] text-ink-subtle">
        Showing <span className="font-medium text-ink">{start}–{end}</span> of <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageButton disabled={page === 1} onClick={() => onPageChange(page - 1)} label="Previous page">
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </PageButton>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
        <PageButton key={p} active={p === page} onClick={() => onPageChange(p)} label={`Page ${p}`}>
            {p}
          </PageButton>
        )}
        <PageButton disabled={page === totalPages} onClick={() => onPageChange(page + 1)} label="Next page">
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </PageButton>
      </div>
    </nav>);

}

function PageButton({ children, onClick, disabled, active, label }: {children: React.ReactNode;onClick: () => void;disabled?: boolean;active?: boolean;label: string;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 ${
      active ? 'bg-accent text-white' : 'text-ink-muted hover:bg-neutral-soft'}`
      }>
      
      {children}
    </button>);

}