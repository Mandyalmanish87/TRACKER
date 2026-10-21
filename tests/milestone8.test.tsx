import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { SettingsView } from '../src/components/views/SettingsView';
import { FocusView } from '../src/components/views/FocusView';
import { FocusRadioPlayer } from '../src/components/focus/FocusRadioPlayer';
import { RemindersView } from '../src/components/views/RemindersView';
import {
  isValidYouTubeUrl,
  toYouTubeEmbedUrl,
  toYouTubeEmbedUrlWithControls,
  isYouTubePlaylistUrl,
} from '../src/utils/youtubeValidator';
import { exportRemindersICS, exportTasksICS, exportCombinedICS } from '../src/utils/icsExporter';
import { Reminder, PlannerTask } from '../src/types';

describe('Milestone 8: Focus Radio, Calendar Export & Remaining Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
    vi.restoreAllMocks();
  });

  describe('YouTube URL Validation Engine', () => {
    it('accepts valid YouTube formats (watch, youtu.be, embed, live, shorts)', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe(true);
      expect(isValidYouTubeUrl('https://youtube.com/watch?v=jfKfPfyJRdk')).toBe(true);
      expect(isValidYouTubeUrl('https://youtu.be/jfKfPfyJRdk')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube.com/embed/jfKfPfyJRdk')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube.com/live/jfKfPfyJRdk')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/jfKfPfyJRdk')).toBe(true);
    });

    it('rejects invalid or non-YouTube URLs', () => {
      expect(isValidYouTubeUrl('https://vimeo.com/12345678')).toBe(false);
      expect(isValidYouTubeUrl('https://spotify.com/track/12345678')).toBe(false);
      expect(isValidYouTubeUrl('not a url')).toBe(false);
      expect(isValidYouTubeUrl('https://malicious-youtube.com/watch?v=123')).toBe(false);
      expect(isValidYouTubeUrl('https://youtube.com/watch?v=short')).toBe(false); // < 11 chars
    });

    it('accepts valid YouTube playlist URLs and detects playlists', () => {
      const playlist1 = 'https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG';
      const playlistWithVideo = 'https://www.youtube.com/watch?v=jfKfPfyJRdk&list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG';
      const youtuBePlaylist = 'https://youtu.be/jfKfPfyJRdk?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG';

      expect(isValidYouTubeUrl(playlist1)).toBe(true);
      expect(isValidYouTubeUrl(playlistWithVideo)).toBe(true);
      expect(isValidYouTubeUrl(youtuBePlaylist)).toBe(true);

      expect(isYouTubePlaylistUrl(playlist1)).toBe(true);
      expect(isYouTubePlaylistUrl(playlistWithVideo)).toBe(true);
      expect(isYouTubePlaylistUrl(youtuBePlaylist)).toBe(true);
      expect(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe(false);
    });

    it('converts playlist URLs into videoseries or playlist embed format', () => {
      const embedPlaylist = toYouTubeEmbedUrl('https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG');
      expect(embedPlaylist).toBe('https://www.youtube.com/embed/videoseries?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG&autoplay=0&rel=0');

      const embedWatchPlaylist = toYouTubeEmbedUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk&list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG');
      expect(embedWatchPlaylist).toBe('https://www.youtube.com/embed/jfKfPfyJRdk?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG&autoplay=0&rel=0');
    });

    it('generates loop and mute parameters for single video and playlists', () => {
      // Loop single video: loop=1 and playlist={videoId}
      const loopVideo = toYouTubeEmbedUrlWithControls('https://www.youtube.com/watch?v=jfKfPfyJRdk', {
        loopMode: 'one',
        autoplay: true,
      });
      expect(loopVideo).toContain('loop=1');
      expect(loopVideo).toContain('playlist=jfKfPfyJRdk');
      expect(loopVideo).toContain('autoplay=1');

      // Loop playlist: loop=1
      const loopPlaylist = toYouTubeEmbedUrlWithControls('https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG', {
        loopMode: 'all',
      });
      expect(loopPlaylist).toContain('loop=1');
      expect(loopPlaylist).toContain('list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG');

      // Muted playback
      const mutedVideo = toYouTubeEmbedUrlWithControls('https://www.youtube.com/watch?v=jfKfPfyJRdk', {
        isMuted: true,
      });
      expect(mutedVideo).toContain('mute=1');
    });
  });

  describe('RFC 5545 iCalendar (.ics) Exporter', () => {
    const mockReminders: Reminder[] = [
      {
        id: 'rem-1',
        title: 'Submit Thermodynamics Assignment',
        category: 'academic',
        dueDate: '2026-10-25',
        priority: 'high',
        isCompleted: false,
      },
      {
        id: 'rem-2',
        title: 'Leg Day Workout',
        category: 'fitness',
        dueDate: '2026-10-26',
        priority: 'medium',
        isCompleted: true,
      },
    ];

    const mockTasks: PlannerTask[] = [
      {
        id: 'task-1',
        title: 'Revise Integration Formulas',
        description: 'Focus on trigonometric substitution',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-10-27',
        createdAt: '2026-10-18T10:00:00.000Z',
      },
    ];

    it('generates valid VCALENDAR with VEVENT blocks for reminders', () => {
      const ics = exportRemindersICS(mockReminders);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//TRACKER//Personal Daily OS//EN');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Submit Thermodynamics Assignment');
      expect(ics).toContain('CATEGORIES:ACADEMIC');
      expect(ics).toContain('PRIORITY:1'); // high priority
      expect(ics).toContain('DTSTART;VALUE=DATE:20261025');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('generates valid VCALENDAR for planner tasks', () => {
      const ics = exportTasksICS(mockTasks);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('SUMMARY:Revise Integration Formulas');
      expect(ics).toContain('DESCRIPTION:Focus on trigonometric substitution');
      expect(ics).toContain('DTSTART;VALUE=DATE:20261027');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('combines reminders and tasks in a single export', () => {
      const ics = exportCombinedICS(mockReminders, mockTasks);

      expect(ics).toContain('Submit Thermodynamics Assignment');
      expect(ics).toContain('Revise Integration Formulas');
      // Should have 3 events total
      const matches = ics.match(/BEGIN:VEVENT/g);
      expect(matches?.length).toBe(3);
    });

    it('triggers ICS download from RemindersView', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      render(
        <ThemeProvider>
          <AppProvider>
            <RemindersView />
          </AppProvider>
        </ThemeProvider>
      );

      const exportBtn = screen.getByRole('button', { name: /export \.ics/i });
      expect(exportBtn).toBeInTheDocument();
      fireEvent.click(exportBtn);

      expect(createObjectURLMock).toHaveBeenCalled();
    });
  });

  describe('Focus Radio Player in FocusView', () => {
    it('does not render radio player by default when showFocusRadio is false', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusView />
          </AppProvider>
        </ThemeProvider>
      );

      expect(screen.queryByRole('heading', { name: /focus radio/i })).not.toBeInTheDocument();
    });

    it('renders radio player when showFocusRadio is toggled in Settings', () => {
      render(<App />);

      // Navigate to Settings
      const settingsTab = screen.getByRole('button', { name: /^settings$/i });
      fireEvent.click(settingsTab);

      // Find toggle for Focus Radio
      const radioToggle = screen.getByRole('button', { name: /toggle focus radio/i });
      expect(radioToggle).toBeInTheDocument();
      fireEvent.click(radioToggle);

      // Navigate to Focus view
      const focusTab = screen.getByRole('button', { name: /^deep focus$/i });
      fireEvent.click(focusTab);

      expect(screen.getByRole('heading', { name: /^focus radio$/i })).toBeInTheDocument();
    });

    it('adds a station from preset list in Focus Radio', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Click "+ Preset"
      const presetBtn = screen.getByRole('button', { name: /\+ preset/i });
      fireEvent.click(presetBtn);

      // Verify preset list appears
      expect(screen.getByText(/preset stations/i)).toBeInTheDocument();
      const addBtns = screen.getAllByRole('button', { name: /^add$/i });
      expect(addBtns.length).toBeGreaterThan(0);

      // Click first Add
      fireEvent.click(addBtns[0]);

      // Close preset drawer
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      // Station should appear in list
      expect(screen.getByText(/lo-fi hip hop/i)).toBeInTheDocument();
    });

    it('adds and tags a custom YouTube playlist in Focus Radio', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Click "Add URL"
      const addUrlBtn = screen.getByRole('button', { name: /add url/i });
      fireEvent.click(addUrlBtn);

      // Verify form opens
      const urlInput = screen.getByPlaceholderText(/playlist\?list=/i);
      const labelInput = screen.getByPlaceholderText(/playlist name|label/i);

      // Paste custom playlist
      fireEvent.change(urlInput, {
        target: { value: 'https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG' },
      });
      fireEvent.change(labelInput, {
        target: { value: 'Study Beats Playlist' },
      });

      // Playlist detected indicator should be visible
      expect(screen.getByText(/playlist detected/i)).toBeInTheDocument();

      // Click "Save Playlist"
      const saveBtn = screen.getByRole('button', { name: /save playlist/i });
      fireEvent.click(saveBtn);

      // Verify playlist is in the list with Playlist pill
      expect(screen.getByText('Study Beats Playlist')).toBeInTheDocument();
      expect(screen.getByText(/^playlist$/i)).toBeInTheDocument();
    });

    it('cycles loop modes (Loop Off -> Loop All -> Loop 1 -> Loop Off)', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Default state: Loop Off
      expect(screen.getByText(/loop off/i)).toBeInTheDocument();

      // Find loop button
      const loopBtn = screen.getByTitle(/loop: off/i);
      expect(loopBtn).toBeInTheDocument();

      // Click to cycle to Loop All
      fireEvent.click(loopBtn);
      expect(screen.getByText(/loop all/i)).toBeInTheDocument();

      // Click to cycle to Loop 1
      fireEvent.click(screen.getByTitle(/loop: all/i));
      expect(screen.getByText(/loop 1/i)).toBeInTheDocument();

      // Click to cycle back to Loop Off
      fireEvent.click(screen.getByTitle(/loop: current track/i));
      expect(screen.getByText(/loop off/i)).toBeInTheDocument();
    });

    it('toggles shuffle play mode', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      const shuffleBtn = screen.getByTitle(/shuffle: off/i);
      expect(shuffleBtn).toBeInTheDocument();

      // Turn shuffle on
      fireEvent.click(shuffleBtn);
      expect(screen.getByTitle(/shuffle: on/i)).toBeInTheDocument();

      // Turn shuffle off
      fireEvent.click(screen.getByTitle(/shuffle: on/i));
      expect(screen.getByTitle(/shuffle: off/i)).toBeInTheDocument();
    });

    it('manages custom queue: add from station, view in queue tab, and clear queue', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Verify My Queue tab starts at 0
      const queueTab = screen.getByRole('button', { name: /my queue \(0\)/i });
      expect(queueTab).toBeInTheDocument();
      fireEvent.click(queueTab);

      // Shows empty queue message
      expect(screen.getByText(/your queue is empty/i)).toBeInTheDocument();

      // Switch back to Stations tab
      const stationsTab = screen.getByRole('button', { name: /stations/i });
      fireEvent.click(stationsTab);

      // Add a preset station
      const presetBtn = screen.getByRole('button', { name: /\+ preset/i });
      fireEvent.click(presetBtn);
      const addBtns = screen.getAllByRole('button', { name: /^add$/i });
      fireEvent.click(addBtns[0]);
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      // Station should appear with Add to Queue button
      const addToQueueBtn = screen.getByTitle(/add to queue/i);
      expect(addToQueueBtn).toBeInTheDocument();
      fireEvent.click(addToQueueBtn);

      // My Queue tab should now have count (1)
      const updatedQueueTab = screen.getByRole('button', { name: /my queue \(1\)/i });
      expect(updatedQueueTab).toBeInTheDocument();
      fireEvent.click(updatedQueueTab);

      // Verify item appears in queue list
      expect(screen.getByText(/#1/i)).toBeInTheDocument();
      expect(screen.getByText(/lo-fi hip hop/i)).toBeInTheDocument();

      // Clear queue
      const clearBtn = screen.getByRole('button', { name: /clear queue/i });
      fireEvent.click(clearBtn);

      // Queue is empty again
      expect(screen.getByText(/your queue is empty/i)).toBeInTheDocument();
    });

    it('allows creating a custom playlist, adding songs, and playing with shuffle/loop', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Navigate to My Playlists tab
      const playlistsTab = screen.getByRole('button', { name: /my playlists/i });
      fireEvent.click(playlistsTab);

      // Verify default playlists render
      expect(screen.getByText(/deep focus & lo-fi beats/i)).toBeInTheDocument();

      // Click "New Playlist"
      const newPlaylistBtn = screen.getByRole('button', { name: /new playlist/i });
      fireEvent.click(newPlaylistBtn);

      // Fill in playlist creation form
      const nameInput = screen.getByPlaceholderText(/playlist name/i);
      fireEvent.change(nameInput, { target: { value: 'Exam Prep Beats' } });

      const createBtn = screen.getByRole('button', { name: /^create playlist$/i });
      fireEvent.click(createBtn);

      // Active playlist view should now be shown
      expect(screen.getByText('Exam Prep Beats')).toBeInTheDocument();

      // Click "Add Song"
      const addSongBtn = screen.getByRole('button', { name: /add song/i });
      fireEvent.click(addSongBtn);

      // Fill in song details
      const songTitleInput = screen.getByPlaceholderText(/track title/i);
      const songUrlInput = screen.getByPlaceholderText(/youtube url/i);

      fireEvent.change(songTitleInput, { target: { value: 'Chill Study Track 1' } });
      fireEvent.change(songUrlInput, {
        target: { value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
      });

      const saveSongBtn = screen.getByRole('button', { name: /save song/i });
      fireEvent.click(saveSongBtn);

      // Song should appear in playlist
      expect(screen.getByText('Chill Study Track 1')).toBeInTheDocument();

      // Click "Shuffle Play"
      const shufflePlayBtn = screen.getByRole('button', { name: /shuffle play/i });
      fireEvent.click(shufflePlayBtn);

      // Active player header should show active custom playlist
      expect(screen.getByText(/exam prep beats — chill study track 1/i)).toBeInTheDocument();
    });

    it('allows pasting a YouTube playlist directly in My Playlists to run, loop, shuffle, and queue', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <FocusRadioPlayer />
          </AppProvider>
        </ThemeProvider>
      );

      // Switch to My Playlists tab
      const playlistsTab = screen.getByRole('button', { name: /my playlists/i });
      fireEvent.click(playlistsTab);

      // Quick-paste YouTube playlist
      const quickYtInput = screen.getByPlaceholderText(/youtube\.com\/playlist\?list=/i);
      fireEvent.change(quickYtInput, {
        target: { value: 'https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5gkDCAPqNGAW38VCG' },
      });

      const addPlaylistBtn = screen.getByRole('button', { name: /add playlist/i });
      fireEvent.click(addPlaylistBtn);

      // Active playlist view should open for the imported playlist
      expect(screen.getAllByText(/youtube playlist/i).length).toBeGreaterThan(0);

      // Test Shuffle Play
      const shuffleBtn = screen.getByRole('button', { name: /shuffle play/i });
      fireEvent.click(shuffleBtn);
      expect(screen.getByTitle(/shuffle: on/i)).toBeInTheDocument();

      // Test Loop cycling
      const loopBtn = screen.getByTitle(/loop: off/i);
      fireEvent.click(loopBtn);
      expect(screen.getByTitle(/loop: all/i)).toBeInTheDocument();

      // Test Queue playlist
      const queueBtn = screen.getByRole('button', { name: /^queue$/i });
      fireEvent.click(queueBtn);

      // Verify My Queue has the item
      const queueTab = screen.getByRole('button', { name: /my queue/i });
      fireEvent.click(queueTab);
      expect(screen.getAllByText(/youtube playlist/i).length).toBeGreaterThan(0);
    });
  });

  describe('Remaining Settings & Full Reset Flow', () => {
    it('displays the app version in Settings footer', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <SettingsView />
          </AppProvider>
        </ThemeProvider>
      );

      expect(screen.getByText(/tracker v0\.8\.0/i)).toBeInTheDocument();
      expect(screen.getByText(/local-first/i)).toBeInTheDocument();
    });

    it('updates daily question target and saves', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <SettingsView />
          </AppProvider>
        </ThemeProvider>
      );

      const saveTargetBtn = screen.getByRole('button', { name: /save target/i });
      expect(saveTargetBtn).toBeInTheDocument();
      fireEvent.click(saveTargetBtn);

      expect(screen.getByText(/saved!/i)).toBeInTheDocument();
    });

    it('validates spaced review intervals input', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <SettingsView />
          </AppProvider>
        </ThemeProvider>
      );

      const intervalInput = screen.getByPlaceholderText(/1, 3, 7, 14, 30/i);
      const saveIntervalsBtn = screen.getByRole('button', { name: /save intervals/i });

      // Enter invalid intervals
      fireEvent.change(intervalInput, { target: { value: '1, abc, -5' } });
      fireEvent.click(saveIntervalsBtn);

      expect(screen.getByText(/all values must be positive integers/i)).toBeInTheDocument();

      // Enter valid intervals
      fireEvent.change(intervalInput, { target: { value: '2, 5, 10, 20' } });
      fireEvent.click(saveIntervalsBtn);

      expect(screen.getByText(/saved!/i)).toBeInTheDocument();
    });

    it('enforces two-step reset requiring exact string RESET', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <SettingsView />
          </AppProvider>
        </ThemeProvider>
      );

      const resetBtn = screen.getByRole('button', { name: /reset all data/i });
      expect(resetBtn).toBeDisabled();

      const resetInput = screen.getByPlaceholderText('RESET');

      // Typing wrong text leaves button disabled
      fireEvent.change(resetInput, { target: { value: 'reset' } });
      expect(resetBtn).toBeDisabled();

      fireEvent.change(resetInput, { target: { value: 'CONFIRM' } });
      expect(resetBtn).toBeDisabled();

      // Typing exact 'RESET' enables button
      fireEvent.change(resetInput, { target: { value: 'RESET' } });
      expect(resetBtn).not.toBeDisabled();

      // Click reset
      fireEvent.click(resetBtn);

      // Success confirmation message displayed
      expect(screen.getByText(/app data has been reset to defaults/i)).toBeInTheDocument();
    });
  });
});

