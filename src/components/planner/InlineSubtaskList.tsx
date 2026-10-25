import React, { useState } from 'react';
import { Check, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Subtask } from '../../types';

interface InlineSubtaskListProps {
  taskId: string;
  subtasks?: Subtask[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  className?: string;
  maxCollapsedItems?: number;
}

export const InlineSubtaskList: React.FC<InlineSubtaskListProps> = ({
  taskId,
  subtasks,
  onToggleSubtask,
  className = '',
  maxCollapsedItems = 3,
}) => {
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const [isExpanded, setIsExpanded] = useState(false);

  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  const hasOverflow = totalCount > maxCollapsedItems;
  const visibleSubtasks = hasOverflow && !isExpanded
    ? subtasks.slice(0, maxCollapsedItems)
    : subtasks;

  const handleToggle = (subtaskId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onToggleSubtask(taskId, subtaskId);
  };

  return (
    <div
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      className={`space-y-2 pt-2 border-t border-ivory-200 dark:border-espresso-800 ${className}`}
    >
      {/* Subtask Header & Progress Text */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-espresso-700 dark:text-ivory-200">
          <CheckSquare className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
          <span>Subtasks</span>
        </div>
        <span
          className="text-[11px] font-mono font-semibold text-espresso-600 dark:text-ivory-300"
          aria-live="polite"
        >
          {completedCount}/{totalCount} completed
        </span>
      </div>

      {/* Progress Bar Indicator */}
      <div
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label="Subtask progress"
        className="w-full h-1.5 bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isAllCompleted ? 'bg-emerald-500' : 'bg-terracotta-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist Items */}
      <ul className="space-y-1 pt-0.5" role="list">
        {visibleSubtasks.map((subtask) => (
          <li
            key={subtask.id}
            onClick={(e) => handleToggle(subtask.id, e)}
            className="flex items-center gap-2 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-ivory-100/70 dark:hover:bg-espresso-800/60 transition cursor-pointer group"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={subtask.isCompleted}
              aria-label={
                subtask.isCompleted
                  ? `Mark "${subtask.title}" as incomplete`
                  : `Mark "${subtask.title}" as complete`
              }
              onClick={(e) => handleToggle(subtask.id, e)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleToggle(subtask.id, e);
                }
              }}
              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition focus:outline-none focus:ring-2 focus:ring-terracotta-500 ${
                subtask.isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-ivory-400 dark:border-espresso-600 hover:border-terracotta-500 bg-white dark:bg-espresso-850'
              }`}
            >
              {subtask.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
            <span
              className={`text-xs leading-snug break-words transition select-none flex-1 ${
                subtask.isCompleted
                  ? 'line-through text-espresso-400 dark:text-espresso-500'
                  : 'text-espresso-800 dark:text-ivory-100'
              }`}
            >
              {subtask.title}
            </span>
          </li>
        ))}
      </ul>

      {/* Expand / Collapse for 4+ subtasks */}
      {hasOverflow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          className="text-[11px] font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>+{totalCount - maxCollapsedItems} more subtasks</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

