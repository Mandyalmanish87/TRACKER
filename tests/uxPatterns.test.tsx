import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { getPlatformModifiers } from '../src/utils/platform';
import { usePlatform } from '../src/hooks/usePlatform';
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts';
import { useDebounce, useDebouncedCallback } from '../src/hooks/useDebounce';
import { useThrottledCallback } from '../src/hooks/useThrottle';
import { useAutosave } from '../src/hooks/useAutosave';
import { useFormValidation } from '../src/hooks/useFormValidation';
import { useBulkSelection } from '../src/hooks/useBulkSelection';
import { DataTable } from '../src/components/common/DataTable';
import { ConfirmModal } from '../src/components/common/ConfirmModal';
import { NotFoundView } from '../src/components/common/NotFoundView';

describe('Global SaaS UX Patterns — Comprehensive Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 13: Cross-Platform Conventions & Modifiers
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 13: Cross-Platform Conventions & Modifiers', () => {
    it('accurately resolves modifier keys for mac and windows/linux', () => {
      const macMods = getPlatformModifiers('mac');
      expect(macMods.modKey).toBe('⌘');
      expect(macMods.altKey).toBe('⌥');
      expect(macMods.shiftKey).toBe('⇧');
      expect(macMods.isMac).toBe(true);

      const winMods = getPlatformModifiers('windows');
      expect(winMods.modKey).toBe('Ctrl');
      expect(winMods.altKey).toBe('Alt');
      expect(winMods.shiftKey).toBe('Shift');
      expect(winMods.isMac).toBe(false);
    });

    it('respects user platform override in usePlatform hook', () => {
      const { result } = renderHook(() => usePlatform());
      act(() => {
        result.current.setPlatformOverride('mac');
      });
      expect(result.current.modKey).toBe('⌘');
      expect(result.current.platform).toBe('mac');

      act(() => {
        result.current.setPlatformOverride('windows');
      });
      expect(result.current.modKey).toBe('Ctrl');
      expect(result.current.platform).toBe('windows');
    });

    it('does NOT trigger keyboard shortcuts when user is focused in text input', () => {
      const shortcutHandler = vi.fn();

      const TestShortcutComponent = () => {
        useKeyboardShortcuts([
          {
            id: 'test-slash',
            key: '/',
            ctrlOrCmd: true,
            category: 'Global Navigation',
            description: 'Test shortcut',
            handler: shortcutHandler,
          },
        ]);
        return (
          <div>
            <input data-testid="test-input" type="text" />
            <button data-testid="outside-button">Button</button>
          </div>
        );
      };

      render(<TestShortcutComponent />);
      const input = screen.getByTestId('test-input');
      const outsideButton = screen.getByTestId('outside-button');

      // Focus input and fire shortcut -> handler MUST NOT be called
      input.focus();
      fireEvent.keyDown(input, { key: '/', ctrlKey: true });
      expect(shortcutHandler).not.toHaveBeenCalled();

      // Blur input / focus button -> handler MUST be called
      input.blur();
      outsideButton.focus();
      fireEvent.keyDown(window, { key: '/', ctrlKey: true });
      expect(shortcutHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERNS 07 & 08: Debouncing & Throttling
  // ──────────────────────────────────────────────────────────────────────────
  describe('Patterns 07 & 08: Debouncing & Throttling', () => {
    it('debounces value changes cleanly with useDebounce', () => {
      vi.useFakeTimers();
      const { result, rerender } = renderHook(({ val }) => useDebounce(val, 200), {
        initialProps: { val: 'alpha' },
      });

      expect(result.current).toBe('alpha');

      rerender({ val: 'beta' });
      expect(result.current).toBe('alpha'); // not updated immediately

      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(result.current).toBe('alpha');

      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(result.current).toBe('beta');
    });

    it('debounces callback calls with useDebouncedCallback', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 150));

      act(() => {
        result.current('call1');
        result.current('call2');
        result.current('call3');
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(151);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call3');
    });

    it('throttles rapid callback invocations with useThrottledCallback', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useThrottledCallback(callback, 200, { leading: true, trailing: false })
      );

      act(() => {
        result.current(1); // Fires immediately (leading)
        result.current(2); // Suppressed within throttle window
        result.current(3); // Suppressed within throttle window
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1);

      act(() => {
        vi.advanceTimersByTime(205);
      });

      act(() => {
        result.current(4);
      });
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(4);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 06: Reliable Autosave with Status Lifecycle & Draft Storage
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 06: Autosave System & Draft Persistence', () => {
    it('transitions through status lifecycle: idle -> unsaved -> saving -> saved', async () => {
      vi.useFakeTimers();
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ val }) =>
          useAutosave(val, onSave, {
            delay: 300,
            draftKey: 'test_notes_draft',
          }),
        { initialProps: { val: 'initial text' } }
      );

      expect(result.current.status).toBe('idle');

      // Change data
      rerender({ val: 'updated text' });
      expect(result.current.status).toBe('unsaved');

      // Advance debounce timer to trigger save
      await act(async () => {
        vi.advanceTimersByTime(305);
      });

      expect(onSave).toHaveBeenCalledWith('updated text');
      expect(result.current.status).toBe('saved');
    });

    it('preserves draft in localStorage during changes', () => {
      vi.useFakeTimers();
      const onSave = vi.fn().mockResolvedValue(undefined);

      const { rerender } = renderHook(
        ({ val }) =>
          useAutosave(val, onSave, {
            delay: 500,
            draftKey: 'exam_notes',
          }),
        { initialProps: { val: 'original' } }
      );

      rerender({ val: 'draft content while typing' });

      // Check localStorage draft key
      const stored = localStorage.getItem('tracker_draft_exam_notes');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toBe('draft content while typing');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 09: Smart Form Validation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 09: Smart Form Validation & Accessible Errors', () => {
    it('validates required fields, patterns, and string bounds', () => {
      const { result } = renderHook(() =>
        useFormValidation(
          {
            title: '',
            hours: 0,
            courseCode: 'cs',
          },
          {
            title: { required: 'Title is mandatory', minLength: { value: 3, message: 'Min 3 chars' } },
            hours: { min: { value: 1, message: 'At least 1 hour' } },
            courseCode: { pattern: { regex: /^[A-Z]{2,4}\d{3}$/, message: 'Format: CS101' } },
          }
        )
      );

      act(() => {
        const isValid = result.current.validateAll();
        expect(isValid).toBe(false);
      });

      expect(result.current.errors.title).toBe('Title is mandatory');
      expect(result.current.errors.hours).toBe('At least 1 hour');
      expect(result.current.errors.courseCode).toBe('Format: CS101');

      // Provide valid inputs
      act(() => {
        result.current.setValue('title', 'Data Structures');
        result.current.setValue('hours', 4);
        result.current.setValue('courseCode', 'CS201');
      });

      act(() => {
        const isValid = result.current.validateAll();
        expect(isValid).toBe(true);
      });

      expect(result.current.errors.title).toBeUndefined();
      expect(result.current.errors.hours).toBeUndefined();
      expect(result.current.errors.courseCode).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 10: Bulk Actions & Multi-Selection
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 10: Bulk Selection & Batch Actions', () => {
    it('manages multi-item selection, toggle, and select all state', () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const { result } = renderHook(() => useBulkSelection(items));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);

      act(() => {
        result.current.toggle('1');
      });
      expect(Array.from(result.current.selectedIds)).toEqual(['1']);
      expect(result.current.isIndeterminate).toBe(true);

      act(() => {
        result.current.selectAll();
      });
      expect(result.current.selectedCount).toBe(3);
      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.isIndeterminate).toBe(false);

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 11: Reusable Data Table (Sorting, Search & Column Visibility)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 11: Reusable Production DataTable', () => {
    it('renders tabular data with searchable columns and empty state', () => {
      interface Row {
        id: string;
        name: string;
        score: number;
      }

      const rows: Row[] = [
        { id: '1', name: 'Alice Algorithm', score: 92 },
        { id: '2', name: 'Bob Binary', score: 78 },
      ];

      render(
        <DataTable<Row>
          data={rows}
          columns={[
            { key: 'name', header: 'Student Name', sortable: true },
            { key: 'score', header: 'Score', sortable: true },
          ]}
          searchPlaceholder="Search students..."
        />
      );

      expect(screen.getByText('Alice Algorithm')).toBeInTheDocument();
      expect(screen.getByText('Bob Binary')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search students...')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 19: Destructive Action Protection (ConfirmModal)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 19: Destructive Action Protection & Confirmation', () => {
    it('shows irreversible badge, warns user, and executes onConfirm safely', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      render(
        <ConfirmModal
          isOpen={true}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          title="Delete Academic Term"
          message="Are you sure you want to permanently delete this term and its schedules?"
          recordIdentifier="Fall Semester 2026"
          confirmText="Yes, Delete Term"
          variant="danger"
          irreversible={true}
        />
      );

      expect(screen.getByText('Delete Academic Term')).toBeInTheDocument();
      expect(screen.getByText(/This action is permanent and cannot be undone/)).toBeInTheDocument();
      expect(screen.getByText('Fall Semester 2026')).toBeInTheDocument();

      const confirmBtn = screen.getByText('Yes, Delete Term');
      fireEvent.click(confirmBtn);

      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATTERN 17: Custom 404 Route Recovery (NotFoundView)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Pattern 17: Custom 404 Not Found Page', () => {
    it('renders branded 404 error and navigates back to dashboard', () => {
      const handleNavigate = vi.fn();

      render(<NotFoundView onNavigate={handleNavigate} />);

      expect(screen.getByText(/404 · PAGE NOT FOUND/)).toBeInTheDocument();
      expect(screen.getByText('Lost in the Academic Void')).toBeInTheDocument();

      const dashboardBtn = screen.getByText('Return to Dashboard');
      fireEvent.click(dashboardBtn);

      expect(handleNavigate).toHaveBeenCalledWith('dashboard');
    });
  });
});
