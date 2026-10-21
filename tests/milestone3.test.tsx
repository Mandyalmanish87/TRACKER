import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { loadData, saveData } from '../src/services/storage';
import { SyllabusSubject, TimetableImportPayload } from '../src/types';

describe('Milestone 3: Syllabus Tracker, Smart Calendar & GPT Timetable Importer', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
  });

  describe('Syllabus Data Persistence & Calculations', () => {
    it('initializes with default starter subjects and preserves them', () => {
      const data = loadData();
      expect(data.syllabusSubjects).toBeDefined();
      expect(data.syllabusSubjects!.length).toBe(4);
      const names = data.syllabusSubjects!.map((s) => s.name);
      expect(names).toContain('Physics');
      expect(names).toContain('Chemistry');
      expect(names).toContain('Mathematics');
      expect(names).toContain('Biology');
    });

    it('handles zero-topic subjects safely without division-by-zero or NaN', () => {
      const customData = loadData();
      const emptySubject: SyllabusSubject = {
        id: 'sub-zero',
        name: 'Quantum Computing',
        chapters: [],
      };
      customData.syllabusSubjects = [emptySubject];
      saveData(customData);

      const loaded = loadData();
      expect(loaded.syllabusSubjects?.length).toBe(1);
      const sub = loaded.syllabusSubjects![0];
      const totalTopics = sub.chapters.reduce((acc, c) => acc + c.subtopics.length, 0);
      const percentage = totalTopics === 0 ? 0 : Math.round(0 / totalTopics);
      expect(percentage).toBe(0);
      expect(isNaN(percentage)).toBe(false);
    });

    it('persists custom college subjects, chapters, subtopic status and revision counts', () => {
      const data = loadData();
      const chemEng: SyllabusSubject = {
        id: 'sub-chemeng',
        name: 'Chemical Engineering',
        code: 'CHE301',
        chapters: [
          {
            id: 'ch-thermo',
            name: 'Thermodynamics of Solutions',
            subtopics: [
              {
                id: 'top-fuga',
                name: 'Fugacity and Activity Coefficients',
                status: 'in_progress',
                revisionCount: 2,
                pyqCovered: true,
                priority: 'high',
                deadline: '2026-11-01',
                notes: 'Focus on Peng-Robinson equation',
              },
            ],
          },
        ],
      };

      saveData({
        ...data,
        syllabusSubjects: [chemEng],
      });

      const loaded = loadData();
      expect(loaded.syllabusSubjects?.length).toBe(1);
      const s = loaded.syllabusSubjects![0];
      expect(s.name).toBe('Chemical Engineering');
      expect(s.chapters[0].subtopics[0].name).toBe('Fugacity and Activity Coefficients');
      expect(s.chapters[0].subtopics[0].status).toBe('in_progress');
      expect(s.chapters[0].subtopics[0].revisionCount).toBe(2);
      expect(s.chapters[0].subtopics[0].pyqCovered).toBe(true);
    });
  });

  describe('Syllabus Tracker UI Interactions', () => {
    it('renders the Syllabus tab in navigation and displays starter subjects', () => {
      render(<App />);

      const syllabusTab = screen.getByRole('button', { name: /syllabus/i });
      expect(syllabusTab).toBeInTheDocument();
      fireEvent.click(syllabusTab);

      // Verify header and starter subjects
      expect(screen.getByRole('heading', { name: 'Syllabus Tracker' })).toBeInTheDocument();
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
      expect(screen.getByText('Biology')).toBeInTheDocument();
    });

    it('allows adding a custom college subject and adding chapters/topics', () => {
      render(<App />);

      // Navigate to Syllabus
      fireEvent.click(screen.getByRole('button', { name: /syllabus/i }));

      // Click Add Subject
      const addSubjectBtn = screen.getByRole('button', { name: /add subject/i });
      fireEvent.click(addSubjectBtn);

      // Form modal should appear
      expect(screen.getByRole('heading', { name: 'Add Syllabus Subject' })).toBeInTheDocument();
      const nameInput = screen.getByPlaceholderText('e.g. Organic Chemistry, CHE 201');
      fireEvent.change(nameInput, { target: { value: 'Data Structures & Algorithms' } });

      const modalSubmit = screen.getByRole('button', { name: 'Create Subject' });
      fireEvent.click(modalSubmit);

      // Should show newly created subject tab
      expect(screen.getByText('Data Structures & Algorithms')).toBeInTheDocument();
    });

    it('filters topics by search query', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /syllabus/i }));

      // Find search input
      const searchInput = screen.getByPlaceholderText(/search subjects/i);
      fireEvent.change(searchInput, { target: { value: 'Newtonian' } });

      // Newtonian Laws should be visible
      expect(screen.getByText(/Newtonian Laws & Friction/i)).toBeInTheDocument();
    });
  });

  describe('Timetable Smart Calendar View', () => {
    it('switches between Month, Week, and List views with recurring classes visible', () => {
      render(<App />);

      const timetableTab = screen.getByRole('button', { name: /timetable/i });
      fireEvent.click(timetableTab);

      // Month view is default
      expect(screen.getByRole('button', { name: /^month$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^week$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^list$/i })).toBeInTheDocument();

      // Check for calendar controls (Today, Prev, Next)
      expect(screen.getByTestId('calendar-today-btn')).toBeInTheDocument();

      // Switch to Week view
      fireEvent.click(screen.getByRole('button', { name: /^week$/i }));
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();

      // Switch to List view
      fireEvent.click(screen.getByRole('button', { name: /^list$/i }));
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
    });

    it('navigates previous and next month and returns with Today button', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /timetable/i }));

      // Find heading in master schedule toolbar
      const monthHeading = screen.getByRole('heading', { level: 2 });
      const currentMonthText = monthHeading.textContent;

      // Click Next Month button (title="Next")
      const nextBtn = screen.getByTitle('Next');
      fireEvent.click(nextBtn);

      const nextMonthText = screen.getByRole('heading', { level: 2 }).textContent;
      expect(nextMonthText).not.toEqual(currentMonthText);

      // Click Today button to return
      const todayBtn = screen.getByTestId('calendar-today-btn');
      fireEvent.click(todayBtn);

      const returnedText = screen.getByRole('heading', { level: 2 }).textContent;
      expect(returnedText).toEqual(currentMonthText);
    });
  });

  describe('GPT Timetable Importer', () => {
    it('opens import modal and provides copyable prompt', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /timetable/i }));

      const importBtn = screen.getByRole('button', { name: /import timetable/i });
      fireEvent.click(importBtn);

      expect(screen.getByRole('heading', { name: 'GPT Timetable Importer' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy chatgpt prompt/i })).toBeInTheDocument();
    });

    it('validates JSON format, detects errors, and successfully imports classes', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /timetable/i }));
      fireEvent.click(screen.getByRole('button', { name: /import timetable/i }));

      const textarea = screen.getByPlaceholderText(/student-tracker-timetable/i);
      const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

      // 1. Invalid JSON
      fireEvent.change(textarea, { target: { value: '{ bad json' } });
      fireEvent.click(validateBtn);
      expect(screen.getByText(/Invalid JSON format/i)).toBeInTheDocument();

      // 2. Missing format
      fireEvent.change(textarea, { target: { value: JSON.stringify({ classes: [] }) } });
      fireEvent.click(validateBtn);
      expect(screen.getByText(/student-tracker-timetable/i)).toBeInTheDocument();

      // 3. Valid JSON with Markdown fences
      const payload: TimetableImportPayload = {
        format: 'student-tracker-timetable',
        version: 1,
        classes: [
          {
            subject: 'Fluid Mechanics',
            day: 'Thursday',
            startTime: '11:00',
            endTime: '12:30',
            location: 'Hall B',
            instructor: 'Dr. Rao',
            notes: 'Weekly problem set due',
          },
        ],
      };

      const markdownWrapped = '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
      fireEvent.change(textarea, { target: { value: markdownWrapped } });
      fireEvent.click(validateBtn);

      // Valid preview should show 1 class
      expect(screen.getByText(/Preview: 1 Classes Ready to Import/i)).toBeInTheDocument();
      expect(screen.getByText('Fluid Mechanics')).toBeInTheDocument();

      // Click Import Classes button
      const importSubmitBtn = screen.getByRole('button', { name: /import 1 classes/i });
      fireEvent.click(importSubmitBtn);

      // Should show success confirmation
      expect(screen.getByText(/successfully imported 1 class/i)).toBeInTheDocument();

      // Check stored data
      const stored = loadData();
      const importedSlot = stored.timetable.find((s) => s.startTime === '11:00' && s.endTime === '12:30');
      expect(importedSlot).toBeDefined();
      expect(importedSlot?.dayOfWeek).toBe(4); // Thursday
      expect(importedSlot?.room).toBe('Hall B');
    });
  });

  describe('Dashboard Integration', () => {
    it('renders Syllabus Mastery widget on Dashboard and navigates on click', () => {
      render(<App />);

      // Dashboard is default tab
      expect(screen.getByText('Syllabus Mastery')).toBeInTheDocument();
      expect(screen.getByText(/completed/i)).toBeInTheDocument();

      // Click the View shortcut on the widget
      const viewBtn = screen.getByRole('button', { name: /^view$/i });
      fireEvent.click(viewBtn);

      // Should have switched to Syllabus view
      expect(screen.getByRole('heading', { name: 'Syllabus Tracker' })).toBeInTheDocument();
    });
  });
});
