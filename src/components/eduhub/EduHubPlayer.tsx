import React, { useEffect, useRef, useState } from 'react';
import { EduHubLecture } from '../../types/eduhub';
import {
  AlertCircle,
  ExternalLink,
  Play,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { formatDigitalTime } from '../../services/eduhubStorage';

interface EduHubPlayerProps {
  lecture: EduHubLecture | null;
  onUpdateProgress: (positionSeconds: number, durationSeconds?: number) => void;
  onMarkComplete?: () => void;
}

interface PlayerErrorInfo {
  type: 'restricted' | 'unavailable' | 'error';
  title: string;
  message: string;
}

export const EduHubPlayer: React.FC<EduHubPlayerProps> = ({
  lecture,
  onUpdateProgress,
  onMarkComplete,
}) => {
  const containerId = 'eduhub-youtube-player-frame';
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const [errorInfo, setErrorInfo] = useState<PlayerErrorInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [initialSeekDone, setInitialSeekDone] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    setCurrentTime(lecture?.lastPositionSeconds || 0);
    setDuration(lecture?.durationSeconds || 0);
    setInitialSeekDone(false);
    setErrorInfo(null);
  }, [lecture?.id]);

  useEffect(() => {
    if (!lecture || !lecture.videoId) return;

    let unmounted = false;

    function cleanupPlayer() {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    }

    function initPlayer() {
      if (unmounted || !window.YT || !window.YT.Player || !lecture) return;
      const currentLecture = lecture;
      cleanupPlayer();

      const el = document.getElementById(containerId);
      if (!el) return;

      try {
        playerRef.current = new window.YT.Player(containerId, {
          height: '100%',
          width: '100%',
          videoId: currentLecture.videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            start:
              currentLecture.lastPositionSeconds > 5
                ? Math.floor(currentLecture.lastPositionSeconds)
                : 0,
          },
          events: {
            onReady: (event: any) => {
              if (unmounted) return;
              setErrorInfo(null);
              try {
                const dur = event.target.getDuration();
                if (dur && dur > 0) {
                  setDuration(dur);
                  onUpdateProgress(currentLecture.lastPositionSeconds || 0, dur);
                }
                // Seek to saved position if starting above 5s
                if (currentLecture.lastPositionSeconds > 5 && !initialSeekDone) {
                  event.target.seekTo(currentLecture.lastPositionSeconds, true);
                  setInitialSeekDone(true);
                }
              } catch {}
            },
            onStateChange: (event: any) => {
              if (unmounted) return;
              // 1 = playing, 2 = paused, 0 = ended
              if (event.data === 1) {
                setIsPlaying(true);
                setErrorInfo(null);

                if (!progressIntervalRef.current) {
                  progressIntervalRef.current = setInterval(() => {
                    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                      try {
                        const cur = playerRef.current.getCurrentTime() || 0;
                        const dur = playerRef.current.getDuration() || duration;
                        setCurrentTime(cur);
                        if (dur > 0) setDuration(dur);

                        onUpdateProgress(cur, dur);

                        // If reached 90% completion threshold
                        if (dur > 0 && cur >= dur * 0.9 && !currentLecture.completed && onMarkComplete) {
                          onMarkComplete();
                        }
                      } catch {}
                    }
                  }, 1000);
                }
              } else if (event.data === 2 || event.data === 0) {
                setIsPlaying(false);
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                  const cur = playerRef.current.getCurrentTime() || 0;
                  const dur = playerRef.current.getDuration() || duration;
                  onUpdateProgress(cur, dur);
                }
              }
            },
            onError: (event: any) => {
              if (unmounted) return;
              setIsPlaying(false);
              const code = Number(event?.data);
              if (code === 101 || code === 150) {
                setErrorInfo({
                  type: 'restricted',
                  title: 'Video Embedding Restricted by Creator',
                  message:
                    'The creator has disabled playing this video on external websites. Watch directly on YouTube, then return to record your notes and course progress.',
                });
              } else if (code === 100 || code === 2) {
                setErrorInfo({
                  type: 'unavailable',
                  title: 'Lecture Video Unavailable',
                  message:
                    'This video cannot be found, has been removed, or was marked private on YouTube.',
                });
              } else {
                setErrorInfo({
                  type: 'error',
                  title: 'Playback Issue Encountered',
                  message:
                    'YouTube encountered an issue loading this video stream. Please watch directly on YouTube or retry the player.',
                });
              }
            },
          },
        });
      } catch (err) {
        console.error('[EduHubPlayer] Failed to instantiate YouTube player:', err);
      }
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        initPlayer();
      };
    }

    return () => {
      unmounted = true;
      cleanupPlayer();
    };
  }, [lecture?.id, lecture?.videoId, retryCount]);

  const handleRetry = () => {
    setErrorInfo(null);
    setRetryCount((prev) => prev + 1);
  };

  if (!lecture) {
    return (
      <div className="w-full aspect-video rounded-2xl bg-ivory-100 dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 flex flex-col items-center justify-center p-6 text-center text-espresso-400 dark:text-espresso-500 shadow-inner">
        <Play className="w-12 h-12 mb-3 opacity-30 text-terracotta-500" />
        <p className="font-serif text-base text-espresso-700 dark:text-ivory-200 font-medium">
          No Lecture Selected
        </p>
        <p className="text-xs text-espresso-400 dark:text-espresso-500 max-w-sm mt-1">
          Select a lecture from the playlist on the right or add a new YouTube lecture URL to begin watching.
        </p>
      </div>
    );
  }

  const thumbnailUrl =
    lecture.thumbnailUrl ||
    (lecture.videoId ? `https://i.ytimg.com/vi/${lecture.videoId}/hqdefault.jpg` : undefined);

  return (
    <div className="w-full space-y-3">
      {/* Video Container */}
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-espresso-950 border border-ivory-300 dark:border-espresso-750 shadow-2xl relative">
        {/* Dynamic clean container for YouTube Iframe */}
        <div
          key={`${lecture.id}-${retryCount}`}
          id={containerId}
          className={`w-full h-full ${errorInfo ? 'hidden' : 'block'}`}
        />

        {/* Custom Fallback Study Experience for Restricted or Unavailable Videos */}
        {errorInfo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-hidden bg-espresso-950 text-ivory-100">
            {/* Optional subtle thumbnail background blur */}
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-md scale-105 pointer-events-none"
              />
            )}

            {/* Gradient overlay to ensure crisp contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-espresso-950 via-espresso-950/80 to-espresso-900/70" />

            {/* Main Fallback Content Card */}
            <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center space-y-3 sm:space-y-4">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider shadow-sm border bg-amber-500/15 border-amber-500/30 text-amber-300">
                {errorInfo.type === 'restricted' ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Playback Restricted by Creator</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Unavailable in Embed</span>
                  </>
                )}
              </div>

              {/* Title & Explanation */}
              <div className="space-y-1.5">
                <h3 className="font-serif text-lg sm:text-2xl font-bold text-ivory-50 tracking-tight">
                  {errorInfo.title}
                </h3>
                <p className="text-xs sm:text-sm text-ivory-200/80 max-w-md mx-auto leading-relaxed">
                  {errorInfo.message}
                </p>
              </div>

              {/* Primary & Secondary Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full pt-1">
                {/* Watch on YouTube Prominent CTA */}
                <a
                  href={lecture.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white shadow-lg shadow-terracotta-900/30 transition-all duration-150 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Watch on YouTube</span>
                </a>

                {/* Mark as Complete Companion Button */}
                {onMarkComplete && (
                  <button
                    type="button"
                    onClick={onMarkComplete}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                      lecture.completed
                        ? 'bg-sage-600/20 border-sage-500/40 text-sage-300 hover:bg-sage-600/30'
                        : 'bg-white/10 hover:bg-white/15 border-white/20 text-ivory-100'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${lecture.completed ? 'text-sage-400' : 'text-ivory-300'}`}
                    />
                    <span>{lecture.completed ? 'Completed' : 'Mark as Complete'}</span>
                  </button>
                )}

                {/* Retry Button */}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono text-espresso-400 hover:text-ivory-200 transition cursor-pointer"
                  title="Try reloading the player"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>

              {/* In-App Continuity Indicators Strip */}
              <div className="pt-2 border-t border-ivory-200/10 flex items-center justify-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-mono text-ivory-300/70 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="text-sage-400">✓</span> Notes &amp; PDF Active
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-sage-400">✓</span> Workload Tracked
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-sage-400">✓</span> Focus Timer Ready
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Playback Progress Indicator & Actions Toolbar */}
      <div className="flex items-center justify-between px-1 text-xs text-espresso-600 dark:text-espresso-300 font-mono">
        <div className="flex items-center gap-2">
          <span>{formatDigitalTime(currentTime)}</span>
          <span>/</span>
          <span>{formatDigitalTime(duration || lecture.durationSeconds)}</span>
          {lecture.lastPositionSeconds > 10 && !isPlaying && (
            <span className="text-[11px] text-terracotta-600 dark:text-terracotta-400 font-semibold flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Resumed at {formatDigitalTime(lecture.lastPositionSeconds)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Quick link to open video on YouTube anytime */}
          <a
            href={lecture.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-espresso-500 hover:text-terracotta-600 dark:text-espresso-400 dark:hover:text-terracotta-400 flex items-center gap-1 transition"
            title="Open lecture on YouTube in a new tab"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">YouTube</span>
          </a>

          <div>
            {lecture.completed ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300 border border-sage-200 dark:border-sage-800">
                Completed
              </span>
            ) : (
              <span className="text-[11px] text-espresso-400 dark:text-espresso-500">
                {duration > 0 ? `${Math.round((currentTime / duration) * 100)}% Watched` : 'Ready'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
