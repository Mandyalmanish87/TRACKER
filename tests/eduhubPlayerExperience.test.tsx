import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EduHubPlayer } from '../src/components/eduhub/EduHubPlayer';
import { EduHubLecture } from '../src/types/eduhub';

describe('EduHubPlayer & Custom Fallback Experience', () => {
  let mockPlayerEvents: Record<string, Function> = {};
  let mockPlayerInstance: any = null;

  const sampleLecture: EduHubLecture = {
    id: 'lec-123',
    title: 'Advanced Thermodynamics: Entropy and Enthalpy',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoId: 'dQw4w9WgXcQ',
    durationSeconds: 1800,
    lastPositionSeconds: 120,
    completed: false,
    addedAt: '2026-10-28T00:00:00Z',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  };

  beforeEach(() => {
    mockPlayerEvents = {};
    mockPlayerInstance = {
      destroy: vi.fn(),
      seekTo: vi.fn(),
      getDuration: vi.fn(() => 1800),
      getCurrentTime: vi.fn(() => 120),
    };

    // Setup global window.YT mock
    (window as any).YT = {
      Player: vi.fn().mockImplementation((_elementId: string, config: any) => {
        mockPlayerEvents = config.events || {};
        return mockPlayerInstance;
      }),
    };
  });

  it('renders friendly empty state when no lecture is selected', () => {
    render(<EduHubPlayer lecture={null} onUpdateProgress={vi.fn()} />);
    expect(screen.getByText('No Lecture Selected')).toBeInTheDocument();
    expect(screen.getByText(/Select a lecture from the playlist/i)).toBeInTheDocument();
  });

  it('initializes YouTube player for embeddable lecture and shows progress bar', () => {
    const onUpdateProgress = vi.fn();
    render(
      <EduHubPlayer
        lecture={sampleLecture}
        onUpdateProgress={onUpdateProgress}
        onMarkComplete={vi.fn()}
      />
    );

    expect((window as any).YT.Player).toHaveBeenCalledWith(
      'eduhub-youtube-player-frame',
      expect.objectContaining({
        videoId: 'dQw4w9WgXcQ',
        playerVars: expect.objectContaining({
          autoplay: 0,
          controls: 1,
          start: 120,
        }),
      })
    );

    // Initial playback time display
    expect(screen.getByText('02:00')).toBeInTheDocument(); // 120s
    expect(screen.getByText('30:00')).toBeInTheDocument(); // 1800s
  });

  it('displays custom fallback UI when video embedding is restricted by creator (code 101/150)', () => {
    const onMarkComplete = vi.fn();
    render(
      <EduHubPlayer
        lecture={sampleLecture}
        onUpdateProgress={vi.fn()}
        onMarkComplete={onMarkComplete}
      />
    );

    // Trigger YouTube onError event with 150 (embedding disabled by owner)
    act(() => {
      if (mockPlayerEvents.onError) {
        mockPlayerEvents.onError({ data: 150 });
      }
    });

    // Check custom fallback elements
    expect(screen.getByText('Playback Restricted by Creator')).toBeInTheDocument();
    expect(screen.getByText('Video Embedding Restricted by Creator')).toBeInTheDocument();
    expect(screen.getByText(/The creator has disabled playing this video on external websites/i)).toBeInTheDocument();

    // Check prominent "Watch on YouTube" button
    const watchButton = screen.getByRole('link', { name: /Watch on YouTube/i });
    expect(watchButton).toBeInTheDocument();
    expect(watchButton).toHaveAttribute('href', sampleLecture.youtubeUrl);
    expect(watchButton).toHaveAttribute('target', '_blank');

    // Check in-app study continuity indicators
    expect(screen.getByText(/Notes & PDF Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Workload Tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus Timer Ready/i)).toBeInTheDocument();

    // Check companion "Mark as Complete" button on fallback card
    const markCompleteBtn = screen.getByRole('button', { name: /Mark as Complete/i });
    expect(markCompleteBtn).toBeInTheDocument();
    fireEvent.click(markCompleteBtn);
    expect(onMarkComplete).toHaveBeenCalledTimes(1);
  });

  it('displays custom fallback UI when video is unavailable or removed (code 100/2)', () => {
    render(
      <EduHubPlayer
        lecture={sampleLecture}
        onUpdateProgress={vi.fn()}
      />
    );

    // Trigger YouTube onError event with 100 (video removed / private)
    act(() => {
      if (mockPlayerEvents.onError) {
        mockPlayerEvents.onError({ data: 100 });
      }
    });

    expect(screen.getByText('Unavailable in Embed')).toBeInTheDocument();
    expect(screen.getByText('Lecture Video Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/This video cannot be found, has been removed/i)).toBeInTheDocument();
  });

  it('allows retrying player from fallback card', () => {
    render(
      <EduHubPlayer
        lecture={sampleLecture}
        onUpdateProgress={vi.fn()}
      />
    );

    // Trigger error
    act(() => {
      if (mockPlayerEvents.onError) {
        mockPlayerEvents.onError({ data: 150 });
      }
    });
    expect(screen.getByText('Video Embedding Restricted by Creator')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    act(() => {
      fireEvent.click(retryBtn);
    });

    // Error info is cleared and player re-instantiated
    expect(screen.queryByText('Video Embedding Restricted by Creator')).not.toBeInTheDocument();
    expect((window as any).YT.Player).toHaveBeenCalledTimes(2);
  });
});
