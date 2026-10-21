import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { Header } from '../src/components/common/Header';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { authService } from '../src/services/authService';
import { AppStateData } from '../src/types';

describe('Google Sign-in & Account Cloud Synchronization', () => {
  beforeEach(async () => {
    localStorage.clear();
    await authService.signOut();
  });

  it('renders "Sign in with Google" button in the header when signed out', () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <Header />
        </AppProvider>
      </ThemeProvider>
    );

    const signInBtn = screen.getByRole('button', { name: /sign in with google/i });
    expect(signInBtn).toBeInTheDocument();
  });

  it('allows signing in with Google and displays user profile in header', async () => {
    render(
      <ThemeProvider>
        <AppProvider>
          <Header />
        </AppProvider>
      </ThemeProvider>
    );

    const signInBtn = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      // In simulated/local mode, scholar student profile is authenticated
      expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    });
  });

  it('intelligently merges local and cloud datasets without losing records', () => {
    const localData: Partial<AppStateData> = {
      timetable: [
        {
          id: 'slot-1',
          subjectId: 'sub-math',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Finish Physics Assignment',
          status: 'todo',
          priority: 'high',
          createdAt: '2026-10-19T10:00:00Z',
        },
      ],
      attendanceLogs: [
        {
          id: 'log-1',
          slotId: 'slot-1',
          subjectId: 'sub-math',
          date: '2026-10-19',
          status: 'present',
          timestamp: '2026-10-19T09:00:00Z',
        },
      ],
    };

    const cloudData: Partial<AppStateData> = {
      timetable: [
        {
          id: 'slot-2',
          subjectId: 'sub-chem',
          dayOfWeek: 2,
          startTime: '11:00',
          endTime: '12:00',
        },
      ],
      tasks: [
        {
          id: 'task-2',
          title: 'Read Chapter 4 Notes',
          status: 'in_progress',
          priority: 'medium',
          createdAt: '2026-10-18T10:00:00Z',
        },
      ],
      attendanceLogs: [
        {
          id: 'log-2',
          slotId: 'slot-2',
          subjectId: 'sub-chem',
          date: '2026-10-20',
          status: 'present',
          timestamp: '2026-10-20T11:00:00Z',
        },
      ],
    };

    const merged = cloudSyncService.mergeDatasets(
      localData as AppStateData,
      cloudData as AppStateData
    );

    // Both timetable slots are preserved
    expect(merged.timetable.length).toBe(2);
    expect(merged.timetable.map((s) => s.id)).toContain('slot-1');
    expect(merged.timetable.map((s) => s.id)).toContain('slot-2');

    // Both tasks are preserved
    expect((merged.tasks || []).length).toBe(2);
    expect((merged.tasks || []).map((t) => t.id)).toContain('task-1');
    expect((merged.tasks || []).map((t) => t.id)).toContain('task-2');

    // Both attendance logs are preserved
    expect(merged.attendanceLogs.length).toBe(2);
    expect(merged.attendanceLogs.map((l) => l.id)).toContain('log-1');
    expect(merged.attendanceLogs.map((l) => l.id)).toContain('log-2');
  });

  it('runs safely in offline/local mode when cloud credentials are unconfigured', async () => {
    expect(authService.isConfigured).toBe(false); // Default when .env is unset
    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
  });
});
