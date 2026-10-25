import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { KanbanBoard } from '../src/components/planner/KanbanBoard';
import { TaskModal } from '../src/components/planner/TaskModal';
import { InlineSubtaskList } from '../src/components/planner/InlineSubtaskList';
import { TaskManagementView } from '../src/components/events/TaskManagementView';
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
});

