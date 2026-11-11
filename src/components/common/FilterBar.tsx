import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterCategory {
  id: string;
  label: string;
  options: FilterOption[];
  currentValue: string;
  onChange: (value: string) => void;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  categories?: FilterCategory[];
  activeChips?: ActiveFilterChip[];
  onClearAll?: () => void;
  resultsCount?: number;
  totalCount?: number;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Filter records...',
  categories = [],
  activeChips = [],
  onClearAll,
  resultsCount,
  totalCount,
  className = '',
}) => {
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    activeChips.length > 0 ||
    categories.some((c) => c.currentValue && c.currentValue !== 'all' && c.currentValue !== '')
  );

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Primary search & category controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-white/10 bg-white/80 dark:bg-white/5 text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Categories / Select filters */}
        {categories.map((cat) => (
          <div key={cat.id} className="relative shrink-0">
            <select
              value={cat.currentValue}
              onChange={(e) => cat.onChange(e.target.value)}
              aria-label={cat.label}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-ivory-300 dark:border-white/10 bg-white dark:bg-white/5 text-espresso-800 dark:text-ivory-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {cat.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Clear all */}
        {hasActiveFilters && onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

        {/* Count summary */}
        {resultsCount !== undefined && (
          <span className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500 ml-auto hidden sm:inline">
            Showing {resultsCount} {totalCount !== undefined ? `of ${totalCount}` : ''} records
          </span>
        )}
      </div>

      {/* Active chips row */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-mono text-espresso-400 uppercase tracking-wider mr-1">
            Active:
          </span>
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-ivory-200 dark:bg-white/10 text-espresso-800 dark:text-ivory-200 text-xs font-medium"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:text-rose-500 transition cursor-pointer"
                aria-label={`Remove filter ${chip.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
