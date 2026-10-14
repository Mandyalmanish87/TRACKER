import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { loadData } from '../src/services/storage';
import {
  TimetableSlot,
  OccurrenceOverride,
  ExtraClass,
  SyllabusImportPayload,
} from '../src/types';
import { resolveSchedule, getAttendanceRequirement } from '../src/utils/scheduleResolver';
import { calculateSubjectAttendance } from '../src/utils/attendance';

describe('TRACKER Upgrades: Rescheduling Bug Fix, Attendance Calendar & GPT Syllabus Import', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
  });

  describe('Feature 3: Single-Occurrence Rescheduling & Bug Fix', () => {
    it('scheduleResolver isolates changes to one specific date without modifying recurring rule', () => {
      const timetable: TimetableSlot[] = [
        {
          id: 'slot-mon-physics',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '10:15',
          subjectId: 'sub-phys',
          room: 'Hall 101',
        },
      ];

      // Monday Oct 19, 2026 and Monday Oct 26, 2026
      const oct19 = new Date(2026, 9, 19);
      const oct26 = new Date(2026, 9, 26);

      // Reschedule ONLY Oct 19 to Oct 20 at 14:00
      const overrides: OccurrenceOverride[] = [
        {
          id: 'ovr-1',
          slotId: 'slot-mon-physics',
          originalDate: '2026-10-19',
          type: 'reschedule',
          newDate: '2026-10-20',
          newStartTime: '14:00',
          newEndTime: '15:15',
          newRoom: 'Lab 3',
        },
      ];

      const events = resolveSchedule(timetable, overrides, [], oct19, oct26);

      // Oct 19 (original date) should NOT have the physics class
      const oct19Events = events.filter((e) => e.date === '2026-10-19');
      expect(oct19Events.length).toBe(0);

      // Oct 20 (new rescheduled date) should have the rescheduled occurrence
      const oct20Events = events.filter((e) => e.date === '2026-10-20');
      expect(oct20Events.length).toBe(1);
      expect(oct20Events[0].startTime).toBe('14:00');
      expect(oct20Events[0].room).toBe('Lab 3');
      expect(oct20Events[0].source).toBe('rescheduled');

      // Crucial: Oct 26 (next Monday) MUST still have the original 09:00 class intact!
      const oct26Events = events.filter((e) => e.date === '2026-10-26');
      expect(oct26Events.length).toBe(1);
      expect(oct26Events[0].startTime).toBe('09:00');
      expect(oct26Events[0].room).toBe('Hall 101');
      expect(oct26Events[0].source).toBe('recurring');
    });

    it('scheduleResolver handles one-off extra classes and cancellations', () => {
      const timetable: TimetableSlot[] = [
        {
          id: 'slot-wed-chem',
          dayOfWeek: 3, // Wednesday
          startTime: '10:00',
          endTime: '11:00',
          subjectId: 'sub-chem',
        },
      ];

      const overrides: OccurrenceOverride[] = [
        {
          id: 'ovr-cancel',
          slotId: 'slot-wed-chem',
          originalDate: '2026-10-21',
          type: 'cancel',
        },
      ];

      const extraClasses: ExtraClass[] = [
        {
          id: 'extra-1',
          subjectId: 'sub-chem',
          date: '2026-10-22',
          startTime: '16:00',
          endTime: '17:30',
          room: 'Seminar Room',
        },
      ];

      const start = new Date(2026, 9, 21);
      const end = new Date(2026, 9, 23);
      const events = resolveSchedule(timetable, overrides, extraClasses, start, end);

      // Oct 21 is marked cancelled
      const oct21 = events.find((e) => e.date === '2026-10-21');
      expect(oct21?.isCancelled).toBe(true);

      // Oct 22 has the extra class
      const oct22 = events.find((e) => e.date === '2026-10-22');
      expect(oct22?.source).toBe('extra');
      expect(oct22?.startTime).toBe('16:00');
      expect(oct22?.room).toBe('Seminar Room');
    });
  });

  describe('Feature 2: Attendance Calendar & Shared Attendance Requirement', () => {
    it('attendance calculation dynamically uses shared requirement without hardcoding 75', () => {
      // 80% requirement
      const req80 = 80;
      const metrics80 = calculateSubjectAttendance(8, 10, req80);
      expect(metrics80.percentage).toBe(80);
      expect(metrics80.status).toBe('warning'); // near margin

      // 60% requirement
      const req60 = 60;
      const metrics60 = calculateSubjectAttendance(7, 10, req60);
      expect(metrics60.percentage).toBe(70);
      expect(metrics60.status).toBe('safe'); // 70% >= 60% + 5%

      // Summary text uses the actual target requirement
      const deficit = calculateSubjectAttendance(5, 10, 80);
      expect(deficit.summaryText).toContain('80%');
    });

    it('getAttendanceRequirement helper falls back safely to 75 if undefined', () => {
      expect(getAttendanceRequirement(undefined)).toBe(75);
      expect(getAttendanceRequirement(85)).toBe(85);
      expect(getAttendanceRequirement(60)).toBe(60);
    });

    it('renders the Attendance tab with Attendance Calendar view switch', () => {
      render(<App />);

      const attTab = screen.getByRole('button', { name: /attendance/i });
      fireEvent.click(attTab);

      // Should show Attendance Calendar toggle and Analytics toggle
      expect(screen.getByRole('button', { name: 'Attendance Calendar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Analytics & Simulator' })).toBeInTheDocument();

      // Calendar toolbar should be active
      expect(screen.getByRole('button', { name: 'Attendance calendar today' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    });
  });

  describe('Feature 1: GPT-Assisted Syllabus Import', () => {
    it('renders "Import Syllabus with GPT" button and opens modal with copyable prompt', () => {
      render(<App />);

      // Navigate to Syllabus tab
      fireEvent.click(screen.getByRole('button', { name: /syllabus/i }));

      // Button must be visible
      const gptBtn = screen.getByRole('button', { name: /import syllabus with gpt/i });
      expect(gptBtn).toBeInTheDocument();
      fireEvent.click(gptBtn);

      // Modal should open
      expect(screen.getByRole('heading', { name: 'Import Syllabus with GPT' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy chatgpt syllabus prompt/i })).toBeInTheDocument();
    });

    it('validates syllabus JSON, previews hierarchy, and imports safely without overwriting', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /syllabus/i }));
      fireEvent.click(screen.getByRole('button', { name: /import syllabus with gpt/i }));

      const textarea = screen.getByPlaceholderText(/schemaVersion/i);
      const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

      // Valid syllabus payload
      const payload: SyllabusImportPayload = {
        schemaVersion: 1,
        subject: {
          name: 'Artificial Intelligence',
          chapters: [
            {
              name: 'Search Algorithms',
              estimatedLectures: 6,
              importance: 'High',
              topics: [
                {
                  name: 'A* Heuristic Search',
                  estimatedLectures: 2,
                  importance: 'High',
                  subtopics: ['Admissibility', 'Consistency'],
                },
              ],
            },
          ],
        },
      };

      fireEvent.change(textarea, { target: { value: JSON.stringify(payload) } });
      fireEvent.click(validateBtn);

      // Preview should show subject and chapter
      expect(screen.getByText(/Preview: "Artificial Intelligence"/i)).toBeInTheDocument();
      expect(screen.getByText('Search Algorithms')).toBeInTheDocument();

      // Click Confirm Import
      const confirmBtn = screen.getByRole('button', { name: /confirm & import syllabus/i });
      fireEvent.click(confirmBtn);

      // Success confirmation
      expect(screen.getByText(/Syllabus Imported Successfully!/i)).toBeInTheDocument();

      // Verify in storage
      const data = loadData();
      const importedSub = data.syllabusSubjects?.find((s) => s.name === 'Artificial Intelligence');
      expect(importedSub).toBeDefined();
      expect(importedSub?.chapters[0].name).toBe('Search Algorithms');
      expect(importedSub?.chapters[0].subtopics[0].name).toBe('A* Heuristic Search');
    });
  });
});
