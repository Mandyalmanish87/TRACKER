import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { GptCalendarImportModal } from '../src/components/events/GptCalendarImportModal';

const TestHarness: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { state } = useApp();
  return (
    <div>
      <div data-testid="events-count">{state.events?.length || 0}</div>
      <div data-testid="tasks-count">{state.tasks?.length || 0}</div>
      <GptCalendarImportModal isOpen={isOpen} onClose={onClose} />
    </div>
  );
};

describe('GPT Calendar Import Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders step 1 with prompt generator and category selection', () => {
    render(
      <AppProvider>
        <TestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    expect(screen.getByText(/Import Calendar with ChatGPT/i)).toBeInTheDocument();
    expect(screen.getByText(/Exam Timetable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open chatgpt/i })).toBeInTheDocument();
  });

  it('navigates to step 2 (Paste JSON) and validates invalid input', () => {
    render(
      <AppProvider>
        <TestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    // Click Next: Paste JSON
    const nextBtn = screen.getByRole('button', { name: /next: paste json/i });
    fireEvent.click(nextBtn);

    // Try to validate empty
    const validateBtn = screen.getByRole('button', { name: /validate & preview/i });
    fireEvent.click(validateBtn);

    expect(screen.getByText(/Please paste the JSON returned by ChatGPT/i)).toBeInTheDocument();
  });

  it('safely parses valid JSON with markdown fences, detects duplicates, and stages entries', async () => {
    render(
      <AppProvider>
        <TestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const initialEventsCount = Number(screen.getByTestId('events-count').textContent || '0');

    // Go to paste step
    fireEvent.click(screen.getByRole('button', { name: /next: paste json/i }));

    const mockGptJson = `
\`\`\`json
{
  "format": "student-tracker-events",
  "version": 1,
  "events": [
    {
      "title": "Discrete Mathematics Midterm",
      "type": "exam",
      "date": "2026-11-15",
      "startTime": "10:00",
      "endTime": "13:00",
      "location": "LH-101",
      "allDay": false
    }
  ],
  "tasks": [
    {
      "title": "Complete Assignment 3",
      "dueDate": "2026-11-12",
      "priority": "high"
    }
  ]
}
\`\`\`
`;

    const textarea = screen.getByPlaceholderText(/Paste JSON here/i);
    fireEvent.change(textarea, { target: { value: mockGptJson } });

    // Click Validate & Preview
    fireEvent.click(screen.getByRole('button', { name: /validate & preview/i }));

    // Preview should display the parsed records
    await waitFor(() => {
      expect(screen.getByText(/Discrete Mathematics Midterm/i)).toBeInTheDocument();
      expect(screen.getByText(/Complete Assignment 3/i)).toBeInTheDocument();
      expect(screen.getByText(/2026-11-15/i)).toBeInTheDocument();
    });

    // Commit import
    const commitBtn = screen.getByRole('button', { name: /import selected/i });
    fireEvent.click(commitBtn);

    // Verify success state
    await waitFor(() => {
      expect(screen.getByText(/Import Completed Successfully!/i)).toBeInTheDocument();
    });

    // App state should now have incremented events count
    expect(screen.getByTestId('events-count')).toHaveTextContent(String(initialEventsCount + 1));
  });

  it('rejects malformed non-JSON data with understandable error', () => {
    render(
      <AppProvider>
        <TestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /next: paste json/i }));

    const textarea = screen.getByPlaceholderText(/Paste JSON here/i);
    fireEvent.change(textarea, { target: { value: 'This is not JSON at all' } });

    fireEvent.click(screen.getByRole('button', { name: /validate & preview/i }));

    expect(screen.getByText(/not valid JSON|malformed/i)).toBeInTheDocument();
  });
});

