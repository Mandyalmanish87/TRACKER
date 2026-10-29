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
      loadVideoById: vi.fn(),
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

  it('smoothly switches videos in a playlist using loadVideoById without destroying player or turning black', () => {
    const onUpdateProgress = vi.fn();
    const lecture1: EduHubLecture = {
      ...sampleLecture,
      id: 'lec-1',
      videoId: 'video-111',
      title: 'Lecture 1: Introduction',
      lastPositionSeconds: 15,
      durationSeconds: 1200,
    };

    const lecture2: EduHubLecture = {
      ...sampleLecture,
      id: 'lec-2',
      videoId: 'video-222',
      title: 'Lecture 2: Advanced Topics',
      lastPositionSeconds: 45,
      durationSeconds: 2400,
    };

    const { rerender } = render(
      <EduHubPlayer
        lecture={lecture1}
        onUpdateProgress={onUpdateProgress}
        onMarkComplete={vi.fn()}
      />
    );

    expect((window as any).YT.Player).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();

    // Mark player as ready via onReady event
    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({
          target: mockPlayerInstance,
        });
      }
    });

    // Switch to Lecture 2 in playlist
    rerender(
      <EduHubPlayer
        lecture={lecture2}
        onUpdateProgress={onUpdateProgress}
        onMarkComplete={vi.fn()}
      />
    );

    // Verify player is REUSED instead of destroyed & recreated:
    // 1. loadVideoById was called with new videoId and startSeconds
    expect(mockPlayerInstance.loadVideoById).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'video-222',
        startSeconds: 45,
      })
    );
    // 2. YT.Player was NOT instantiated again
    expect((window as any).YT.Player).toHaveBeenCalledTimes(1);
    // 3. destroy was NOT called
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();
    // 4. Container element is still in the DOM and not blank
    const container = document.getElementById('eduhub-youtube-player-frame');
    expect(container).not.toBeNull();
    expect(container).not.toHaveClass('hidden');
  });

  it('switches across multiple consecutive playlist videos while maintaining player state', () => {
    const lecture1: EduHubLecture = { ...sampleLecture, id: 'lec-1', videoId: 'vid-1' };
    const lecture2: EduHubLecture = { ...sampleLecture, id: 'lec-2', videoId: 'vid-2' };
    const lecture3: EduHubLecture = { ...sampleLecture, id: 'lec-3', videoId: 'vid-3', lastPositionSeconds: 0 };

    const { rerender } = render(
      <EduHubPlayer lecture={lecture1} onUpdateProgress={vi.fn()} />
    );

    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // Switch to video 2
    rerender(<EduHubPlayer lecture={lecture2} onUpdateProgress={vi.fn()} />);
    expect(mockPlayerInstance.loadVideoById).toHaveBeenLastCalledWith(
      expect.objectContaining({ videoId: 'vid-2' })
    );

    // Switch to video 3
    rerender(<EduHubPlayer lecture={lecture3} onUpdateProgress={vi.fn()} />);
    expect(mockPlayerInstance.loadVideoById).toHaveBeenLastCalledWith(
      expect.objectContaining({ videoId: 'vid-3', startSeconds: 0 })
    );

    // Single player instance across 3 video switches
    expect((window as any).YT.Player).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.destroy).not.toHaveBeenCalled();
  });

  it('switching away from a restricted video recovers player and loads new video', () => {
    const restrictedLecture: EduHubLecture = { ...sampleLecture, id: 'lec-restricted', videoId: 'vid-restricted' };
    const regularLecture: EduHubLecture = { ...sampleLecture, id: 'lec-regular', videoId: 'vid-regular' };

    const { rerender } = render(
      <EduHubPlayer lecture={restrictedLecture} onUpdateProgress={vi.fn()} />
    );

    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // Video reports restricted error (150)
    act(() => {
      if (mockPlayerEvents.onError) {
        mockPlayerEvents.onError({ data: 150 });
      }
    });

    expect(screen.getByText('Playback Restricted by Creator')).toBeInTheDocument();

    // User selects the next video in playlist
    rerender(<EduHubPlayer lecture={regularLecture} onUpdateProgress={vi.fn()} />);

    // Fallback UI is cleared immediately
    expect(screen.queryByText('Playback Restricted by Creator')).not.toBeInTheDocument();

    // New video is loaded into player
    expect(mockPlayerInstance.loadVideoById).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'vid-regular' })
    );
  });

  it('updating completion state of active lecture does not reload or restart the player', () => {
    const lectureActive: EduHubLecture = { ...sampleLecture, id: 'lec-1', videoId: 'vid-1', completed: false };
    const lectureCompleted: EduHubLecture = { ...lectureActive, completed: true };

    const { rerender } = render(
      <EduHubPlayer lecture={lectureActive} onUpdateProgress={vi.fn()} />
    );

    act(() => {
      if (mockPlayerEvents.onReady) {
        mockPlayerEvents.onReady({ target: mockPlayerInstance });
      }
    });

    // Rerender with completed: true for the same lecture
    rerender(<EduHubPlayer lecture={lectureCompleted} onUpdateProgress={vi.fn()} />);

    // loadVideoById should NOT have been called because it's the same lecture
    expect(mockPlayerInstance.loadVideoById).not.toHaveBeenCalled();
    expect((window as any).YT.Player).toHaveBeenCalledTimes(1);
  });
});
