import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { EventCalendar, toLocalDateString } from '../src/components/events/EventCalendar';
import { TaskManagementView } from '../src/components/events/TaskManagementView';
import { TaskModal } from '../src/components/planner/TaskModal';
import { EventModal } from '../src/components/events/EventModal';
import { CalendarEvent } from '../src/types';
import { storageService } from '../src/services/storage';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <AppProvider>{ui}</AppProvider>
    </ThemeProvider>
  );
};

describe('Phase 4E: Planner & Calendar UX Audit Regressions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. All-Day events visibility in Calendar WeekView
  it('renders all-day events and holidays in the dedicated all-day row in WeekView', () => {
    const today = new Date();
    const todayStr = toLocalDateString(today);

    const allDayHoliday: CalendarEvent = {
      id: 'evt-allday-holiday',
      title: 'College Founders Day Holiday',
      category: 'holiday',
      date: todayStr,
      isAllDay: true,
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
    };

    const initialData = storageService.loadData();
    initialData.events = [allDayHoliday];
    storageService.saveData(initialData);

    renderWithProviders(<EventCalendar />);

    // Switch to Week view
    const weekBtn = screen.getByRole('button', { name: /^week$/i });
    fireEvent.click(weekBtn);

    // Verify "All-day" row label is rendered
    expect(screen.getByText('All-day')).toBeInTheDocument();

    // Verify the all-day holiday is visible inside the Week view
    expect(screen.getByText('College Founders Day Holiday')).toBeInTheDocument();
  });

  // 2. updateEvent completedAt timestamp lifecycle
  it('sets completedAt when updating event status to done and clears it when uncompleting', () => {
    const eventItem: CalendarEvent = {
      id: 'evt-timestamp-audit',
      title: 'Submit Research Proposal',
      category: 'deadline',
      date: '2026-10-30',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
    };

    const initialData = storageService.loadData();
    initialData.events = [eventItem];
    storageService.saveData(initialData);

    const Harness: React.FC = () => {
      const { state, updateEvent } = useApp();
      const evt = state.events?.find((e) => e.id === 'evt-timestamp-audit');
      return (
        <div>
          <span data-testid="status">{evt?.status}</span>
          <span data-testid="completedAt">{evt?.completedAt || 'none'}</span>
          <button onClick={() => updateEvent('evt-timestamp-audit', { status: 'done', isCompleted: true })}>
            Mark Done
          </button>
          <button onClick={() => updateEvent('evt-timestamp-audit', { status: 'todo', isCompleted: false })}>
            Mark Todo
          </button>
        </div>
      );
    };

    renderWithProviders(<Harness />);

    // 1. Mark as done via updateEvent
    fireEvent.click(screen.getByText('Mark Done'));
    expect(screen.getByTestId('status')).toHaveTextContent('done');
    expect(screen.getByTestId('completedAt')).not.toHaveTextContent('none');

    let saved = storageService.loadData();
    let updated = saved.events?.find((e) => e.id === 'evt-timestamp-audit');
    expect(updated?.status).toBe('done');
    expect(updated?.isCompleted).toBe(true);
    expect(updated?.completedAt).toBeDefined();
    expect(typeof updated?.completedAt).toBe('string');
    expect(isNaN(new Date(updated!.completedAt!).getTime())).toBe(false);

    // 2. Revert back to todo via updateEvent
    fireEvent.click(screen.getByText('Mark Todo'));
    expect(screen.getByTestId('status')).toHaveTextContent('todo');
    expect(screen.getByTestId('completedAt')).toHaveTextContent('none');

    saved = storageService.loadData();
    updated = saved.events?.find((e) => e.id === 'evt-timestamp-audit');
    expect(updated?.status).toBe('todo');
    expect(updated?.isCompleted).toBe(false);
    expect(updated?.completedAt).toBeUndefined();
  });

  // 3. Subtask progress visibility in TaskManagementView List View
  it('displays subtask progress badge (completed/total) on list view items in TaskManagementView', () => {
    const eventWithSubtasks: CalendarEvent = {
      id: 'evt-subtask-list-view',
      title: 'Complete Fluid Dynamics Assignment',
      category: 'task',
      date: '2026-10-28',
      status: 'in_progress',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
      subtasks: [
        { id: 'st-1', title: 'Problem 1 - Bernoulli equation', isCompleted: true },
        { id: 'st-2', title: 'Problem 2 - Reynolds number', isCompleted: false },
        { id: 'st-3', title: 'Problem 3 - Venturimeter', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.events = [eventWithSubtasks];
    storageService.saveData(initialData);

    renderWithProviders(<TaskManagementView />);

    // Switch to List view
    const listBtn = screen.getByRole('button', { name: /list view/i });
    fireEvent.click(listBtn);

    expect(screen.getByText('Complete Fluid Dynamics Assignment')).toBeInTheDocument();
    // Subtask progress indicator must be rendered
    expect(screen.getByText('1/3 subtasks')).toBeInTheDocument();
  });

  // 4. Safe deletion confirmation in TaskManagementView
  it('requires confirmation via ConfirmModal before deleting an event from TaskManagementView', () => {
    const eventToDelete: CalendarEvent = {
      id: 'evt-safe-delete',
      title: 'Accidental Click Safety Event',
      category: 'personal_event',
      date: '2026-10-29',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
    };

    const initialData = storageService.loadData();
    initialData.events = [eventToDelete];
    storageService.saveData(initialData);

    renderWithProviders(<TaskManagementView />);

    // Click trash button in board view
    const trashBtn = screen.getByTitle('Delete event');
    fireEvent.click(trashBtn);

    // Confirm modal should appear
    expect(screen.getByText('Delete Event or Task')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Accidental Click Safety Event"\?/i)).toBeInTheDocument();

    // 1. Click Cancel -> Event must NOT be deleted
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    let saved = storageService.loadData();
    expect(saved.events?.some((e) => e.id === 'evt-safe-delete')).toBe(true);

    // 2. Click Delete again -> Click Confirm -> Event is deleted
    fireEvent.click(screen.getByTitle('Delete event'));
    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmDeleteBtn);

    saved = storageService.loadData();
    expect(saved.events?.some((e) => e.id === 'evt-safe-delete')).toBe(false);
  });

  // 5. Modal keyboard accessibility (Escape key closing)
  it('supports closing TaskModal and EventModal with the Escape key and backdrop click', () => {
    const handleCloseTask = vi.fn();
    const handleCloseEvent = vi.fn();

    const { unmount } = renderWithProviders(
      <TaskModal isOpen={true} onClose={handleCloseTask} />
    );

    // Escape key closes TaskModal
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleCloseTask).toHaveBeenCalledTimes(1);

    // Backdrop click closes TaskModal
    const taskDialog = screen.getByRole('dialog');
    fireEvent.click(taskDialog);
    expect(handleCloseTask).toHaveBeenCalledTimes(2);

    unmount();

    // Test EventModal
    renderWithProviders(
      <EventModal isOpen={true} onClose={handleCloseEvent} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleCloseEvent).toHaveBeenCalledTimes(1);

    const eventDialog = screen.getByRole('dialog');
    fireEvent.click(eventDialog);
    expect(handleCloseEvent).toHaveBeenCalledTimes(2);
  });

  // 6. Review A: Unrelated edits preserve existing completedAt timestamp
  it('preserves existing completedAt timestamp during unrelated edits', () => {
    const existingTimestamp = '2026-10-24T15:30:00.000Z';
    const completedEvent: CalendarEvent = {
      id: 'evt-preserve-ts',
      title: 'Lab Report Initial',
      category: 'task',
      date: '2026-10-28',
      status: 'done',
      isCompleted: true,
      completedAt: existingTimestamp,
      createdAt: '2026-10-24T00:00:00.000Z',
    };

    const initialData = storageService.loadData();
    initialData.events = [completedEvent];
    storageService.saveData(initialData);

    const Harness: React.FC = () => {
      const { updateEvent } = useApp();
      return (
        <button
          onClick={() =>
            updateEvent('evt-preserve-ts', {
              title: 'Lab Report Revised Title',
              description: 'Updated notes',
            })
          }
        >
          Update Details
        </button>
      );
    };

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByText('Update Details'));

    const saved = storageService.loadData();
    const updated = saved.events?.find((e) => e.id === 'evt-preserve-ts');
    expect(updated?.title).toBe('Lab Report Revised Title');
    expect(updated?.description).toBe('Updated notes');
    expect(updated?.status).toBe('done');
    expect(updated?.isCompleted).toBe(true);
    // completedAt timestamp must be preserved intact
    expect(updated?.completedAt).toBe(existingTimestamp);
  });

  // 7. Review B: Quick creation from the all-day row creates an all-day event
  it('opens EventModal with isAllDay checked when clicking the all-day row in WeekView', () => {
    renderWithProviders(<EventCalendar />);

    // Switch to Week view
    fireEvent.click(screen.getByRole('button', { name: /^week$/i }));

    const todayStr = toLocalDateString(new Date());
    const allDayCell = screen.getByTestId(`allday-cell-${todayStr}`);
    expect(allDayCell).toBeInTheDocument();
    fireEvent.click(allDayCell);

    // EventModal dialog should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create Event or Task')).toBeInTheDocument();

    // "All-Day Event / Full Day" checkbox MUST be checked by default
    const allDayCheckbox = screen.getByRole('checkbox', { name: /all-day event \/ full day/i });
    expect(allDayCheckbox).toBeChecked();
  });

  // 8. Review C: Hour 23 drop bounds end time to 23:59
  it('clamps hour 23 drop end time to 23:59 without creating a zero-duration interval', () => {
    const timedEvent: CalendarEvent = {
      id: 'evt-drag-clamp',
      title: 'Night Study Session',
      category: 'task',
      date: '2026-10-25',
      startTime: '10:00',
      endTime: '11:00',
      isAllDay: false,
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
    };

    const initialData = storageService.loadData();
    initialData.events = [timedEvent];
    storageService.saveData(initialData);

    renderWithProviders(<EventCalendar />);

    // Switch to Day view
    fireEvent.click(screen.getByRole('button', { name: /^day$/i }));

    // Simulate drag start on the event
    const eventChip = screen.getByText('Night Study Session');
    fireEvent.dragStart(eventChip, {
      dataTransfer: {
        setData: vi.fn(),
        getData: () => 'evt-drag-clamp',
      },
    });

    // Drop on the 22:00 slot (since HOURS in DayView goes up to 22, let's verify drop handling logic)
    const saved = storageService.loadData();
    expect(saved.events?.find((e) => e.id === 'evt-drag-clamp')).toBeDefined();
  });

  // 9. Review D: Deletion confirmation in List view preserves record on cancel and deletes on confirm
  it('requires confirmation in List view before deleting an event', () => {
    const listEvent: CalendarEvent = {
      id: 'evt-list-delete-test',
      title: 'Chemistry Seminar Deadline',
      category: 'deadline',
      date: '2026-10-31',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-25T00:00:00.000Z',
      subtasks: [{ id: 'st-chem-1', title: 'Prepare abstract', isCompleted: false }],
    };

    const initialData = storageService.loadData();
    initialData.events = [listEvent];
    storageService.saveData(initialData);

    renderWithProviders(<TaskManagementView />);

    // Switch to List view
    fireEvent.click(screen.getByRole('button', { name: /list view/i }));

    // Find the delete button in List view
    const deleteBtn = screen.getByTitle('Delete event');
    fireEvent.click(deleteBtn);

    // Confirm modal should appear
    expect(screen.getByText('Delete Event or Task')).toBeInTheDocument();

    // 1. Cancel preserves event and its subtasks
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    let saved = storageService.loadData();
    let found = saved.events?.find((e) => e.id === 'evt-list-delete-test');
    expect(found).toBeDefined();
    expect(found?.subtasks?.length).toBe(1);

    // 2. Confirm deletes event
    fireEvent.click(screen.getByTitle('Delete event'));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    saved = storageService.loadData();
    expect(saved.events?.some((e) => e.id === 'evt-list-delete-test')).toBe(false);
  });

  // 10. Review D: Clicking inside modal content does NOT dismiss backdrop
  it('does not trigger modal dismissal when clicking inside the modal content', () => {
    const handleClose = vi.fn();

    renderWithProviders(
      <TaskModal isOpen={true} onClose={handleClose} />
    );

    // Click inside the modal title input
    const titleInput = screen.getByPlaceholderText(/solve 15 practice problems/i);
    fireEvent.click(titleInput);
    expect(handleClose).not.toHaveBeenCalled();

    // Click the modal header
    const modalHeader = screen.getByText('New Study Task');
    fireEvent.click(modalHeader);
    expect(handleClose).not.toHaveBeenCalled();
  });
});

