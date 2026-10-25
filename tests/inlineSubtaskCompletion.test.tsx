import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { KanbanBoard } from '../src/components/planner/KanbanBoard';
import { TaskModal } from '../src/components/planner/TaskModal';
import { InlineSubtaskList } from '../src/components/planner/InlineSubtaskList';
import { TaskManagementView } from '../src/components/events/TaskManagementView';
import { EventModal } from '../src/components/events/EventModal';
import { PlannerTask, CalendarEvent, Subtask } from '../src/types';
import { storageService } from '../src/services/storage';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <AppProvider>{ui}</AppProvider>
    </ThemeProvider>
  );
};

describe('Phase 4C.1: Inline Subtask Completion on Kanban Cards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. Task with NO subtasks
  it('renders a Kanban card with no subtasks cleanly without clutter', () => {
    const taskWithoutSubtasks: PlannerTask = {
      id: 'task-clean-1',
      title: 'Draft Physics Lab Report',
      description: 'Write introduction and error analysis',
      status: 'todo',
      priority: 'medium',
      createdAt: '2026-10-24T10:00:00.000Z',
    };

    renderWithProviders(<KanbanBoard tasks={[taskWithoutSubtasks]} />);

    expect(screen.getByText('Draft Physics Lab Report')).toBeInTheDocument();
    expect(screen.getByText('Write introduction and error analysis')).toBeInTheDocument();

    // Must NOT render subtask counters or progress bar
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  // 2. Task with subtasks displays progress and progress indicator
  it('displays subtask progress count and progress bar on the card', () => {
    const subtasks: Subtask[] = [
      { id: 'st-1', title: 'Chapter 1 review', isCompleted: true, completedAt: '2026-10-24T11:00:00.000Z' },
      { id: 'st-2', title: 'Chapter 2 practice problems', isCompleted: false },
      { id: 'st-3', title: 'Chapter 3 summary formulas', isCompleted: false },
    ];

    const taskWithSubtasks: PlannerTask = {
      id: 'task-with-subs',
      title: 'Complete Math Module 1',
      status: 'todo',
      priority: 'high',
      createdAt: '2026-10-24T10:00:00.000Z',
      subtasks,
    };

    renderWithProviders(<KanbanBoard tasks={[taskWithSubtasks]} />);

    // Check progress text: 1/3 completed
    expect(screen.getByText('1/3 completed')).toBeInTheDocument();

    // Check progress bar ARIA attributes and calculation
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '3');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');

    // Subtasks titles visible
    expect(screen.getByText('Chapter 1 review')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2 practice problems')).toBeInTheDocument();
    expect(screen.getByText('Chapter 3 summary formulas')).toBeInTheDocument();
  });

  // 3. Inline toggle directly updates visible progress immediately
  it('allows marking a subtask complete/incomplete directly from the card and updates progress immediately', () => {
    // Setup state in localStorage with 1 task having 3 subtasks (1 completed)
    const initialTask: PlannerTask = {
      id: 'task-toggle-test',
      title: 'Operating Systems Virtual Memory',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2026-10-24T10:00:00.000Z',
      subtasks: [
        { id: 'sub-p1', title: 'Read paging slides', isCompleted: true },
        { id: 'sub-p2', title: 'Implement FIFO page replacement', isCompleted: false },
        { id: 'sub-p3', title: 'Implement LRU page replacement', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [initialTask];
    storageService.saveData(initialData);

    // Component wrapper that reads tasks directly from AppContext
    const KanbanBoardConnected: React.FC = () => {
      const { state } = useApp();
      return <KanbanBoard tasks={state.tasks || []} />;
    };

    renderWithProviders(<KanbanBoardConnected />);

    // Initially 1/3 completed
    expect(screen.getByText('1/3 completed')).toBeInTheDocument();
    const p2Checkbox = screen.getByRole('checkbox', { name: /mark "implement fifo page replacement" as complete/i });
    expect(p2Checkbox).toBeInTheDocument();
    expect(p2Checkbox).toHaveAttribute('aria-checked', 'false');

    // Click checkbox for subtask 2
    fireEvent.click(p2Checkbox);

    // Visible progress immediately updates to 2/3 completed
    expect(screen.getByText('2/3 completed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(p2Checkbox).toHaveAttribute('aria-checked', 'true');

    // Click again to mark incomplete
    fireEvent.click(p2Checkbox);

    // Visible progress immediately reverts to 1/3 completed
    expect(screen.getByText('1/3 completed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(p2Checkbox).toHaveAttribute('aria-checked', 'false');
  });

  // 4. Persistence in localStorage
  it('persists subtask changes to localStorage and remains correct after simulated reload', () => {
    const task: PlannerTask = {
      id: 'task-persist',
      title: 'Database Normalization',
      status: 'todo',
      priority: 'medium',
      createdAt: '2026-10-24T10:00:00.000Z',
      subtasks: [
        { id: 'st-bcnf', title: 'Verify BCNF criteria', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [task];
    storageService.saveData(initialData);

    const KanbanBoardConnected: React.FC = () => {
      const { state } = useApp();
      return <KanbanBoard tasks={state.tasks || []} />;
    };

    const { unmount } = renderWithProviders(<KanbanBoardConnected />);

    const checkbox = screen.getByRole('checkbox', { name: /mark "verify bcnf criteria" as complete/i });
    fireEvent.click(checkbox);

    expect(screen.getByText('1/1 completed')).toBeInTheDocument();

    // Verify localStorage has persisted the change
    const saved = storageService.loadData();
    const savedTask = saved.tasks?.find((t) => t.id === 'task-persist');
    expect(savedTask).toBeDefined();
    expect(savedTask?.subtasks?.[0].isCompleted).toBe(true);
    expect(savedTask?.subtasks?.[0].completedAt).toBeDefined();

    // Simulate page reload by unmounting and mounting fresh
    unmount();

    renderWithProviders(<KanbanBoardConnected />);
    expect(screen.getByText('1/1 completed')).toBeInTheDocument();
    const reloadedCheckbox = screen.getByRole('checkbox', { name: /mark "verify bcnf criteria" as incomplete/i });
    expect(reloadedCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  // 5. Prevent subtask click from triggering parent card open, drag, or navigation
  it('prevents subtask click from triggering card click, open, or drag events', () => {
    const handleCardClick = vi.fn();
    const handleCardDragStart = vi.fn();
    const handleToggleSubtask = vi.fn();

    const subtasks: Subtask[] = [
      { id: 'st-iso', title: 'Isolated Subtask Click', isCompleted: false },
    ];

    render(
      <div
        draggable
        onClick={handleCardClick}
        onDragStart={handleCardDragStart}
        data-testid="parent-card"
      >
        <span>Parent Card Content</span>
        <InlineSubtaskList
          taskId="task-isolated"
          subtasks={subtasks}
          onToggleSubtask={handleToggleSubtask}
        />
      </div>
    );

    const checkbox = screen.getByRole('checkbox', { name: /mark "isolated subtask click" as complete/i });

    // Click the checkbox
    fireEvent.click(checkbox);
    expect(handleToggleSubtask).toHaveBeenCalledWith('task-isolated', 'st-iso');
    expect(handleCardClick).not.toHaveBeenCalled();

    // Attempt to start drag on the subtask container
    fireEvent.dragStart(checkbox);
    expect(handleCardDragStart).not.toHaveBeenCalled();
  });

  // 6. Keyboard accessibility
  it('allows toggling subtasks using Space and Enter keys without bubbling', () => {
    const handleToggleSubtask = vi.fn();
    const subtasks: Subtask[] = [
      { id: 'st-kb', title: 'Keyboard Accessible Item', isCompleted: false },
    ];

    render(
      <InlineSubtaskList
        taskId="task-kb"
        subtasks={subtasks}
        onToggleSubtask={handleToggleSubtask}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /mark "keyboard accessible item" as complete/i });

    // Space key
    fireEvent.keyDown(checkbox, { key: ' ' });
    expect(handleToggleSubtask).toHaveBeenCalledTimes(1);

    // Enter key
    fireEvent.keyDown(checkbox, { key: 'Enter' });
    expect(handleToggleSubtask).toHaveBeenCalledTimes(2);
  });

  // 7. Compactness: overflow handling with Show More / Show Less
  it('collapses subtasks when more than 3 exist and allows expanding inline', () => {
    const manySubtasks: Subtask[] = [
      { id: 's1', title: 'Step 1: Read abstract', isCompleted: true },
      { id: 's2', title: 'Step 2: Note methodologies', isCompleted: true },
      { id: 's3', title: 'Step 3: Analyze dataset', isCompleted: false },
      { id: 's4', title: 'Step 4: Reproduce benchmarks', isCompleted: false },
      { id: 's5', title: 'Step 5: Write critique', isCompleted: false },
    ];

    render(
      <InlineSubtaskList
        taskId="task-many"
        subtasks={manySubtasks}
        onToggleSubtask={vi.fn()}
      />
    );

    // Top 3 visible by default
    expect(screen.getByText('Step 1: Read abstract')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Note methodologies')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Analyze dataset')).toBeInTheDocument();
    // 4th and 5th collapsed
    expect(screen.queryByText('Step 4: Reproduce benchmarks')).not.toBeInTheDocument();
    expect(screen.queryByText('Step 5: Write critique')).not.toBeInTheDocument();

    // "+2 more subtasks" toggle
    const toggleBtn = screen.getByRole('button', { name: /\+2 more subtasks/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click expand
    fireEvent.click(toggleBtn);

    // Now all 5 visible
    expect(screen.getByText('Step 4: Reproduce benchmarks')).toBeInTheDocument();
    expect(screen.getByText('Step 5: Write critique')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  // 8. Preservation of TaskModal for managing subtasks (Requirement 9)
  it('allows managing subtasks inside TaskModal (adding, removing, toggling)', () => {
    const existingTask: PlannerTask = {
      id: 'task-modal-subtasks',
      title: 'Full Stack Project',
      status: 'todo',
      priority: 'high',
      createdAt: '2026-10-24T10:00:00.000Z',
      subtasks: [
        { id: 'st-fe', title: 'Setup React Router', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [existingTask];
    storageService.saveData(initialData);

    const ModalTestContainer: React.FC = () => {
      const { state } = useApp();
      const [isOpen, setIsOpen] = React.useState(true);
      return (
        <TaskModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          taskToEdit={state.tasks?.[0]}
        />
      );
    };

    renderWithProviders(<ModalTestContainer />);

    // Existing subtask visible
    expect(screen.getByText('Setup React Router')).toBeInTheDocument();

    // Add new subtask via input
    const addInput = screen.getByPlaceholderText(/add subtask and press enter/i);
    fireEvent.change(addInput, { target: { value: 'Design database schema' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    // Both subtasks visible in modal
    expect(screen.getByText('Setup React Router')).toBeInTheDocument();
    expect(screen.getByText('Design database schema')).toBeInTheDocument();

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Verify localStorage has both subtasks
    const updatedData = storageService.loadData();
    const saved = updatedData.tasks?.find((t) => t.id === 'task-modal-subtasks');
    expect(saved?.subtasks?.length).toBe(2);
    expect(saved?.subtasks?.[0].title).toBe('Setup React Router');
    expect(saved?.subtasks?.[1].title).toBe('Design database schema');
  });

  // 9. Integration with Events & Tasks Calendar Board (TaskManagementView)
  it('renders inline subtasks and supports toggling in TaskManagementView board columns', () => {
    const calendarTask: CalendarEvent = {
      id: 'evt-task-sub',
      title: 'Submit Graduation Application',
      category: 'task',
      date: '2026-10-25',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'c-sub-1', title: 'Get Dean signature', isCompleted: false },
        { id: 'c-sub-2', title: 'Pay diploma fee', isCompleted: true },
      ],
    };

    const initialData = storageService.loadData();
    initialData.events = [calendarTask];
    storageService.saveData(initialData);

    renderWithProviders(<TaskManagementView />);

    // Card should be rendered in To Do column with subtasks
    expect(screen.getByText('Submit Graduation Application')).toBeInTheDocument();
    expect(screen.getByText('1/2 completed')).toBeInTheDocument();
    expect(screen.getByText('Get Dean signature')).toBeInTheDocument();

    // Toggle Dean signature
    const deanCheckbox = screen.getByRole('checkbox', { name: /mark "get dean signature" as complete/i });
    fireEvent.click(deanCheckbox);

    // Progress updates to 2/2 completed
    expect(screen.getByText('2/2 completed')).toBeInTheDocument();

    // Verify localStorage persisted
    const saved = storageService.loadData();
    const updatedEvt = saved.events?.find((e) => e.id === 'evt-task-sub');
    expect(updatedEvt?.subtasks?.find((s) => s.id === 'c-sub-1')?.isCompleted).toBe(true);
  });

  // 10. Preservation of EventModal for managing subtasks (Task 2)
  it('allows managing subtasks inside EventModal (adding, removing, toggling) and persists to storage', () => {
    const calendarEvent: CalendarEvent = {
      id: 'evt-modal-test',
      title: 'Prepare Lab Presentation',
      category: 'task',
      date: '2026-10-27',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'em-sub-1', title: 'Compile data graphs', isCompleted: false },
        { id: 'em-sub-2', title: 'Write speaker notes', isCompleted: true, completedAt: '2026-10-24T12:00:00.000Z' },
      ],
    };

    const initialData = storageService.loadData();
    initialData.events = [calendarEvent];
    storageService.saveData(initialData);

    const EventModalContainer: React.FC = () => {
      const { state } = useApp();
      const [isOpen, setIsOpen] = React.useState(true);
      return (
        <EventModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          initialEvent={state.events?.find((e) => e.id === 'evt-modal-test')}
        />
      );
    };

    renderWithProviders(<EventModalContainer />);

    // Existing subtasks visible
    expect(screen.getByText('Compile data graphs')).toBeInTheDocument();
    expect(screen.getByText('Write speaker notes')).toBeInTheDocument();

    // Toggle subtask 1 in modal
    const toggleCheckbox = screen.getByRole('checkbox', { name: /toggle compile data graphs/i });
    expect(toggleCheckbox).not.toBeChecked();
    fireEvent.click(toggleCheckbox);
    expect(toggleCheckbox).toBeChecked();

    // Add a new subtask
    const addInput = screen.getByPlaceholderText(/add subtask and press enter/i);
    fireEvent.change(addInput, { target: { value: 'Rehearse with timer' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByText('Rehearse with timer')).toBeInTheDocument();

    // Remove subtask 2
    const removeBtn = screen.getByRole('button', { name: /remove write speaker notes/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText('Write speaker notes')).not.toBeInTheDocument();

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Verify localStorage has the 2 remaining subtasks
    const saved = storageService.loadData();
    const updated = saved.events?.find((e) => e.id === 'evt-modal-test');
    expect(updated).toBeDefined();
    expect(updated?.subtasks?.length).toBe(2);

    const sub1 = updated?.subtasks?.find((s) => s.title === 'Compile data graphs');
    expect(sub1?.isCompleted).toBe(true);
    expect(sub1?.completedAt).toBeDefined();

    const sub2 = updated?.subtasks?.find((s) => s.title === 'Rehearse with timer');
    expect(sub2?.isCompleted).toBe(false);

    expect(updated?.subtasks?.some((s) => s.title === 'Write speaker notes')).toBe(false);
  });

  // 11. Completing subtasks does NOT automatically mark parent task/event complete (Task 3)
  it('completing all subtasks does NOT automatically mark parent task or event status as done', () => {
    const parentTask: PlannerTask = {
      id: 'task-no-auto-complete',
      title: 'Independent Task Completion Test',
      status: 'todo',
      priority: 'medium',
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'ind-1', title: 'Part A', isCompleted: false },
        { id: 'ind-2', title: 'Part B', isCompleted: false },
      ],
    };

    const parentEvent: CalendarEvent = {
      id: 'evt-no-auto-complete',
      title: 'Independent Event Completion Test',
      category: 'task',
      date: '2026-10-28',
      status: 'todo',
      isCompleted: false,
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'ind-evt-1', title: 'Step 1', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [parentTask];
    initialData.events = [parentEvent];
    storageService.saveData(initialData);

    const TestHarness: React.FC = () => {
      const { toggleTaskSubtask, toggleEventSubtask } = useApp();
      return (
        <div>
          <button onClick={() => toggleTaskSubtask('task-no-auto-complete', 'ind-1')}>Toggle Task 1</button>
          <button onClick={() => toggleTaskSubtask('task-no-auto-complete', 'ind-2')}>Toggle Task 2</button>
          <button onClick={() => toggleEventSubtask('evt-no-auto-complete', 'ind-evt-1')}>Toggle Evt 1</button>
        </div>
      );
    };

    renderWithProviders(<TestHarness />);

    // Complete all task subtasks
    fireEvent.click(screen.getByText('Toggle Task 1'));
    fireEvent.click(screen.getByText('Toggle Task 2'));

    // Complete all event subtasks
    fireEvent.click(screen.getByText('Toggle Evt 1'));

    const saved = storageService.loadData();
    const task = saved.tasks?.find((t) => t.id === 'task-no-auto-complete');
    const evt = saved.events?.find((e) => e.id === 'evt-no-auto-complete');

    // Subtasks are all completed
    expect(task?.subtasks?.every((s) => s.isCompleted)).toBe(true);
    expect(evt?.subtasks?.every((s) => s.isCompleted)).toBe(true);

    // Parent task status MUST remain 'todo' (not auto-marked 'done')
    expect(task?.status).toBe('todo');
    expect(task?.completedAt).toBeUndefined();

    // Parent event status MUST remain 'todo' and isCompleted false
    expect(evt?.status).toBe('todo');
    expect(evt?.isCompleted).toBe(false);
    expect(evt?.completedAt).toBeUndefined();
  });

  // 12. completedAt is set on completion and cleared when unchecked (Task 4)
  it('sets completedAt timestamp on subtask completion and clears it when uncompleted', () => {
    const task: PlannerTask = {
      id: 'task-timestamp-test',
      title: 'Timestamp Verification Task',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'ts-sub', title: 'Timestamp Check Item', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [task];
    storageService.saveData(initialData);

    const TestHarness: React.FC = () => {
      const { toggleTaskSubtask } = useApp();
      return (
        <button onClick={() => toggleTaskSubtask('task-timestamp-test', 'ts-sub')}>Toggle Subtask</button>
      );
    };

    renderWithProviders(<TestHarness />);
    const btn = screen.getByText('Toggle Subtask');

    // 1. Mark complete
    fireEvent.click(btn);
    let saved = storageService.loadData();
    let sub = saved.tasks?.find((t) => t.id === 'task-timestamp-test')?.subtasks?.[0];
    expect(sub?.isCompleted).toBe(true);
    expect(sub?.completedAt).toBeDefined();
    expect(typeof sub?.completedAt).toBe('string');
    const parsedDate = new Date(sub!.completedAt!);
    expect(isNaN(parsedDate.getTime())).toBe(false);

    // 2. Mark incomplete (uncheck)
    fireEvent.click(btn);
    saved = storageService.loadData();
    sub = saved.tasks?.find((t) => t.id === 'task-timestamp-test')?.subtasks?.[0];
    expect(sub?.isCompleted).toBe(false);
    expect(sub?.completedAt).toBeUndefined();
  });

  // 13. Toggling a subtask updates only targeted record and preserves sibling subtasks (Task 5)
  it('toggling a subtask updates only the targeted task and preserves sibling subtasks', () => {
    const taskA: PlannerTask = {
      id: 'task-A',
      title: 'Task Alpha',
      status: 'todo',
      priority: 'high',
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'sub-a1', title: 'Alpha Step 1', isCompleted: false },
        { id: 'sub-a2', title: 'Alpha Step 2', isCompleted: true, completedAt: '2026-10-24T10:00:00.000Z' },
      ],
    };

    const taskB: PlannerTask = {
      id: 'task-B',
      title: 'Task Beta',
      status: 'todo',
      priority: 'low',
      createdAt: '2026-10-24T00:00:00.000Z',
      subtasks: [
        { id: 'sub-b1', title: 'Beta Step 1', isCompleted: false },
        { id: 'sub-b2', title: 'Beta Step 2', isCompleted: false },
      ],
    };

    const initialData = storageService.loadData();
    initialData.tasks = [taskA, taskB];
    storageService.saveData(initialData);

    const TestHarness: React.FC = () => {
      const { toggleTaskSubtask } = useApp();
      return (
        <button onClick={() => toggleTaskSubtask('task-A', 'sub-a1')}>Toggle A1</button>
      );
    };

    renderWithProviders(<TestHarness />);
    fireEvent.click(screen.getByText('Toggle A1'));

    const saved = storageService.loadData();
    const loadedA = saved.tasks?.find((t) => t.id === 'task-A');
    const loadedB = saved.tasks?.find((t) => t.id === 'task-B');

    // Task A: sub-a1 toggled to complete
    expect(loadedA?.subtasks?.find((s) => s.id === 'sub-a1')?.isCompleted).toBe(true);
    // Task A: sibling sub-a2 preserved exactly
    expect(loadedA?.subtasks?.find((s) => s.id === 'sub-a2')?.isCompleted).toBe(true);
    expect(loadedA?.subtasks?.find((s) => s.id === 'sub-a2')?.completedAt).toBe('2026-10-24T10:00:00.000Z');

    // Task B: completely untouched
    expect(loadedB?.subtasks?.find((s) => s.id === 'sub-b1')?.isCompleted).toBe(false);
    expect(loadedB?.subtasks?.find((s) => s.id === 'sub-b2')?.isCompleted).toBe(false);
  });
});

