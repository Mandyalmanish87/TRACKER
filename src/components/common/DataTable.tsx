import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { BulkActionToolbar, BulkAction } from './BulkActionToolbar';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  keyField?: keyof T;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  bulkActions?: BulkAction[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField = 'id' as keyof T,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display in this table yet.',
  emptyAction,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  bulkActions = [],
  pageSize = 10,
  searchable = true,
  searchPlaceholder = 'Search records...',
  className = '',
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);

  // 1. Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter((row) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery]);

  // 2. Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenCols.has(col.key)),
    [columns, hiddenCols]
  );

  const toggleColumnVisibility = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (visibleColumns.length > 1) {
          next.add(key);
        }
      }
      return next;
    });
  };

  const isAllSelected =
    data.length > 0 && selectedIds.size === data.length;
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < data.length;

  if (isLoading) {
    return <TableSkeleton rows={pageSize} cols={columns.length} />;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Table Top Controls (Search & Column Toggle) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-4 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-white/10 bg-white/80 dark:bg-white/5 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        )}

        {/* Column visibility menu */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowColMenu(!showColMenu)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-medium text-espresso-700 dark:text-ivory-200 hover:bg-ivory-50 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Columns</span>
          </button>

          {showColMenu && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#18151D] border border-ivory-300 dark:border-white/10 rounded-2xl shadow-xl p-2 z-30 space-y-1 text-xs">
              <span className="block px-2 py-1 text-[10px] font-mono font-bold text-espresso-400 uppercase tracking-wider">
                Visible Columns
              </span>
              {columns.map((col) => {
                const isVisible = !hiddenCols.has(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumnVisibility(col.key)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-ivory-100 dark:hover:bg-white/5 text-espresso-800 dark:text-ivory-100 cursor-pointer"
                  >
                    <span>{col.header}</span>
                    {isVisible && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      {data.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyAction?.label}
          onAction={emptyAction?.onClick}
        />
      ) : sortedData.length === 0 ? (
        <EmptyState
          title="No matching records"
          description={`No results found matching "${searchQuery}". Try adjusting your filters.`}
          actionLabel="Clear Search"
          onAction={() => setSearchQuery('')}
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/70 dark:bg-[#18151D]/70 shadow-xs">
          <table className="w-full text-left text-xs border-collapse" role="table">
            <thead>
              <tr className="border-b border-ivory-300/80 dark:border-white/10 bg-ivory-100/60 dark:bg-white/[0.03]">
                {selectable && (
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={onToggleSelectAll}
                      aria-label="Select all rows"
                      className="rounded border-ivory-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => {
                  const isCurrentSort = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      className={`px-4 py-3 font-mono text-[11px] font-semibold text-espresso-600 dark:text-espresso-300 select-none ${
                        col.sortable ? 'cursor-pointer hover:text-espresso-950 dark:hover:text-ivory-50' : ''
                      } ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${
                        col.hideOnMobile ? 'hidden sm:table-cell' : ''
                      } ${col.className || ''}`}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="shrink-0">
                            {isCurrentSort ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-espresso-950 dark:text-ivory-50" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-espresso-950 dark:text-ivory-50" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 text-espresso-400 opacity-60" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5">
              {paginatedData.map((row, index) => {
                const rowId = String(row[keyField]);
                const isSelected = selectedIds.has(rowId);

                return (
                  <tr
                    key={rowId || index}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15'
                        : 'hover:bg-ivory-50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(rowId)}
                          aria-label={`Select row ${rowId}`}
                          className="rounded border-ivory-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-espresso-800 dark:text-ivory-200 ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        } ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.className || ''}`}
                      >
                        {col.render ? col.render(row, index) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-espresso-600 dark:text-espresso-300">
          <span>
            Page {currentPage} of {totalPages} ({sortedData.length} total)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-ivory-300 dark:border-white/10 hover:bg-ivory-100 dark:hover:bg-white/10 transition disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-ivory-300 dark:border-white/10 hover:bg-ivory-100 dark:hover:bg-white/10 transition disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectable && bulkActions.length > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          totalCount={data.length}
          onClearSelection={() => {
            if (isAllSelected) onToggleSelectAll?.();
          }}
          actions={bulkActions}
        />
      )}
    </div>
  );
}
