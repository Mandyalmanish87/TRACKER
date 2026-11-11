import { useState, useCallback, useMemo } from 'react';

export function useBulkSelection<T extends { id: string }>(items: T[] = []) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allItemIds = useMemo(() => items.map((item) => item.id), [items]);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allItemIds));
  }, [allItemIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === allItemIds.length && allItemIds.length > 0) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [selectedIds.size, allItemIds.length, clearSelection, selectAll]);

  const isAllSelected = allItemIds.length > 0 && selectedIds.size === allItemIds.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < allItemIds.length;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    selectedItems,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    toggleAll,
    isAllSelected,
    isIndeterminate,
  };
}
