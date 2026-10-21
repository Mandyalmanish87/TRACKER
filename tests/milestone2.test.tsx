import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { storageService, loadData, saveData } from '../src/services/storage';
import { AccentColor, BackgroundStyle, AppStateData } from '../src/types';

describe('Milestone 2: Profile, Personalization, Appearance & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
    document.body.style.backgroundImage = '';
  });

  it('persists profile, academic target, and exam date across storage reload', () => {
    // Save initial state with custom profile
    const customData: AppStateData = {
      ...storageService.loadData(),
      profile: {
        displayName: 'Maya Patel',
        targetExam: 'Final Semester Practicals',
        examDate: '2026-12-15',
      },
      settings: {
        themeMode: 'dark',
        accentColor: 'dusty-blue',
        backgroundStyle: 'ocean',
        studyDayRolloverHour: 2,
        showExamCountdown: true,
        showFocusRadio: false,
      },
    };

    saveData(customData);

    // Reload from storage — must NOT drop profile or settings
    const loaded = loadData();
    expect(loaded.profile?.displayName).toBe('Maya Patel');
    expect(loaded.profile?.targetExam).toBe('Final Semester Practicals');
    expect(loaded.profile?.examDate).toBe('2026-12-15');
    expect(loaded.settings?.accentColor).toBe('dusty-blue');
    expect(loaded.settings?.backgroundStyle).toBe('ocean');
    expect(loaded.settings?.themeMode).toBe('dark');
  });

  it('renders and applies all 6 accent colours to documentElement', async () => {
    const accents: AccentColor[] = ['terracotta', 'sage', 'ochre', 'dusty-blue', 'plum', 'slate'];

    const { unmount } = render(<App />);

    // Navigate to Settings
    const settingsTab = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsTab);

    for (const accent of accents) {
      // Find swatch by accent name
      const swatchLabel =
        accent === 'terracotta' ? /terracotta/i :
        accent === 'sage' ? /forest sage/i :
        accent === 'ochre' ? /ochre/i :
        accent === 'dusty-blue' ? /dusty blue/i :
        accent === 'plum' ? /plum/i : /slate/i;

      const swatch = screen.getByRole('button', { name: swatchLabel });
      fireEvent.click(swatch);

      expect(document.documentElement.getAttribute('data-accent')).toBe(accent);
    }

    unmount();
  });

  it('renders and applies all 5 background styles to document.body', async () => {
    const backgrounds: { id: BackgroundStyle; label: RegExp }[] = [
      { id: 'minimal', label: /minimal/i },
      { id: 'abstract', label: /abstract/i },
      { id: 'space', label: /space/i },
      { id: 'ocean', label: /ocean/i },
      { id: 'custom', label: /custom/i },
    ];

    const { unmount } = render(<App />);

    // Navigate to Settings
    const settingsTab = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsTab);

    for (const bg of backgrounds) {
      const button = screen.getByRole('button', { name: bg.label });
      fireEvent.click(button);

      expect(document.body.classList.contains(`bg-style-${bg.id}`)).toBe(true);

      // Verify custom background sets background image
      if (bg.id === 'custom') {
        expect(document.body.style.backgroundImage).toContain('unsplash');
      }
    }

    unmount();
  });

  it('retains profile and academic countdown when page is refreshed (unmount and remount)', () => {
    const { unmount: unmount1 } = render(<App />);

    // Navigate to Settings
    const settingsTab = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsTab);

    // Edit profile display name and target
    const nameInput = screen.getByPlaceholderText(/e\.g\. Aanya/i);
    fireEvent.change(nameInput, { target: { value: 'Aarav Sharma' } });
    fireEvent.blur(nameInput);

    const targetInput = screen.getByPlaceholderText(/e\.g\. End-Semester/i);
    fireEvent.change(targetInput, { target: { value: 'Unit Test Series 2' } });
    fireEvent.blur(targetInput);

    // Set target date to future date (30 days from today)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateStr = futureDate.toISOString().split('T')[0];

    const dateInput = screen.getByLabelText(/target date/i);
    fireEvent.change(dateInput, { target: { value: dateStr } });
    fireEvent.blur(dateInput);

    // Save Profile (may already show Saved! from auto-save on blur)
    const saveBtn = screen.getByRole('button', { name: /save profile|saved/i });
    fireEvent.click(saveBtn);

    // Select Ocean background and Sage accent
    const sageSwatch = screen.getByRole('button', { name: /forest sage/i });
    fireEvent.click(sageSwatch);

    const oceanBtn = screen.getByRole('button', { name: /ocean/i });
    fireEvent.click(oceanBtn);

    // Simulate page refresh: unmount first app instance
    unmount1();

    // Mount fresh App instance reading from storage
    render(<App />);

    // Greeting and header badge must reflect the saved name
    expect(screen.getAllByText(/Aarav Sharma/i).length).toBeGreaterThanOrEqual(1);

    // Countdown widget must show the custom target and remaining days
    expect(screen.getByText(/Unit Test Series 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/remaining/i).length).toBeGreaterThanOrEqual(1);

    // Accent and background must still be active on DOM
    expect(document.documentElement.getAttribute('data-accent')).toBe('sage');
    expect(document.body.classList.contains('bg-style-ocean')).toBe(true);
  });

  it('handles past and today target dates gracefully in countdown', () => {
    // 1. Past date
    const pastData: AppStateData = {
      ...storageService.loadData(),
      profile: {
        displayName: 'Student',
        targetExam: 'Past Exam',
        examDate: '2020-01-01',
      },
    };
    saveData(pastData);

    const { unmount: unmount1 } = render(<App />);
    expect(screen.getByText(/Target date has passed/i)).toBeInTheDocument();
    unmount1();

    // 2. Today's date (local, not UTC, to match the widget's local-midnight comparison)
    const todayLocal = new Date();
    const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
    const base2 = storageService.loadData();
    const todayData: AppStateData = {
      ...base2,
      profile: {
        displayName: 'Student',
        targetExam: 'Major Project Viva',
        examDate: todayStr,
      },
      settings: {
        ...base2.settings,
        showExamCountdown: true,
      } as AppStateData['settings'],
    };
    saveData(todayData);

    const { unmount: unmount2 } = render(<App />);
    expect(screen.getByText(/Today is the day!/i)).toBeInTheDocument();
    unmount2();
  });

  it('switching light/dark theme preserves accent and background selections', () => {
    render(<App />);

    // Navigate to Settings
    const settingsTab = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsTab);

    // Choose Plum accent and Space background
    const plumSwatch = screen.getByRole('button', { name: /plum/i });
    fireEvent.click(plumSwatch);

    const spaceBtn = screen.getByRole('button', { name: /space/i });
    fireEvent.click(spaceBtn);

    expect(document.documentElement.getAttribute('data-accent')).toBe('plum');
    expect(document.body.classList.contains('bg-style-space')).toBe(true);

    // Switch theme to Dark
    const darkBtn = screen.getAllByRole('button', { name: /dark/i })[0];
    fireEvent.click(darkBtn);

    // Theme changed to dark
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // Accent and background are NOT reset
    expect(document.documentElement.getAttribute('data-accent')).toBe('plum');
    expect(document.body.classList.contains('bg-style-space')).toBe(true);

    // Switch theme to Light
    const lightBtn = screen.getAllByRole('button', { name: /light/i })[0];
    fireEvent.click(lightBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-accent')).toBe('plum');
    expect(document.body.classList.contains('bg-style-space')).toBe(true);
  });
});
