import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCardDensity } from '../common/Card';

interface Focus3DVisualizerProps {
  isRunning: boolean;
  timeLeft: number;
  totalTime: number;
  mode: 'work' | 'break';
  isCompleted?: boolean;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  colorIndex: number;
  phase: number;
  trail: Array<{ x: number; y: number }>;
}

function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (!hex) return `rgba(196, 85, 50, ${alpha})`;
  const full = hex.length === 3 ? hex.split('').map((digit) => digit + digit).join('') : hex;
  const value = Number.parseInt(full, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export const Focus3DVisualizer: React.FC<Focus3DVisualizerProps> = ({
  isRunning,
  timeLeft,
  totalTime,
  mode,
  isCompleted = false,
}) => {
  const { density } = useCardDensity();
  const isCompact = density === 'compact';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const visualStateRef = useRef({ isRunning, timeLeft, totalTime, mode });
  visualStateRef.current = { isRunning, timeLeft, totalTime, mode };

  // Check reduced motion preference safely
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
      }
    } catch {
      // Graceful fallback for non-standard environments
    }
  }, []);

  // Confetti celebration on completion
  useEffect(() => {
    if (isCompleted) {
      try {
        const theme = getComputedStyle(document.documentElement);
        const accent = theme.getPropertyValue('--accent').trim() || '#C45532';
        const success = theme.getPropertyValue('--success').trim() || '#436650';
        const accentLight = theme.getPropertyValue('--accent-light').trim() || '#FBF2ED';
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: [accent, success, accentLight],
        });
      } catch {
        // Safe fallback in test or headless
      }
    }
  }, [isCompleted]);

  // Canvas-based Focus Core 3D engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = 300);
    let height = (canvas.height = 300);

    const centerX = width / 2;
    const centerY = height / 2;

    // Read theme tokens once and refresh them when the app appearance changes.
    let accent = '#C45532';
    let accentLight = '#FBF2ED';
    let success = '#436650';
    const refreshTheme = () => {
      const theme = getComputedStyle(canvas);
      accent = theme.getPropertyValue('--accent').trim() || '#C45532';
      accentLight = theme.getPropertyValue('--accent-light').trim() || '#FBF2ED';
      success = theme.getPropertyValue('--success').trim() || '#436650';
    };
    refreshTheme();
    const themeObserver = new MutationObserver(refreshTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

    // Initialize 3D particle swarm
    const particleCount = 54;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 38 + Math.random() * 74;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      particles.push({
        x: radius * Math.cos(phi) * Math.cos(theta),
        y: radius * Math.sin(phi),
        z: radius * Math.cos(phi) * Math.sin(theta),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.6,
        colorIndex: Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
        trail: [],
      });
    }

    let angleY = 0;
    let angleZ = 0;
    let pulseTime = 0;
    let animationTime = 0;
    let previousFrameTime = 0;

    const render = (timestamp: number) => {
      if (document.hidden) return;
      const deltaSeconds = previousFrameTime > 0 ? Math.min(0.05, (timestamp - previousFrameTime) / 1000) : 1 / 60;
      previousFrameTime = timestamp;
      const live = visualStateRef.current;
      const activePalette = !live.isRunning && live.timeLeft > 0 && live.timeLeft < live.totalTime
        ? { primary: accent, secondary: accentLight, glow: colorWithAlpha(accent, 0.25), ring: colorWithAlpha(accent, 0.2) }
        : live.mode === 'work'
        ? { primary: accent, secondary: accentLight, glow: colorWithAlpha(accent, 0.4), ring: colorWithAlpha(accent, 0.32) }
        : { primary: success, secondary: accent, glow: colorWithAlpha(success, 0.38), ring: colorWithAlpha(success, 0.3) };
      const colors = [activePalette.primary, activePalette.secondary, accentLight];
      ctx.clearRect(0, 0, width, height);

      const speedMultiplier = prefersReducedMotion
        ? 0
        : live.isRunning
        ? 1.0
        : live.timeLeft === 0
        ? 0.3
        : 0.4;

      const motionScale = deltaSeconds * (live.isRunning ? 1.35 : 0.72) * speedMultiplier;
      pulseTime += 0.9 * motionScale;
      animationTime += motionScale;
      angleY += 0.72 * motionScale;
      angleZ += 0.42 * motionScale;

      // ── 1. BACKGROUND GLOW AURA ──
      const breathingScale = 1 + Math.sin(pulseTime) * (live.isRunning ? 0.12 : 0.055);
      const auraRadius = Math.max(10, 76 * breathingScale);

      const auraGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        auraRadius
      );
      auraGradient.addColorStop(0, activePalette.glow);
      auraGradient.addColorStop(0.58, colorWithAlpha(activePalette.primary, 0.12));
      auraGradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // Two soft shockwaves breathe outward from the core, like energy in orbit.
      const waveCycle = animationTime % (live.isRunning ? 3.2 : 5.2);
      for (let waveIndex = 0; waveIndex < 2; waveIndex += 1) {
        const waveProgress = (waveCycle / (live.isRunning ? 3.2 : 5.2) + waveIndex * 0.5) % 1;
        const waveRadius = 30 + waveProgress * 96;
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = colorWithAlpha(activePalette.primary, (1 - waveProgress) * (live.isRunning ? 0.17 : 0.09));
        ctx.lineWidth = 1.2 * (1 - waveProgress * 0.55);
        ctx.stroke();
      }

      // ── 2. TIERED 3D GYROSCOPIC ORBITAL RINGS ──
      const rings = [
        { radius: 65, tiltX: 0.8, speed: 0.34, phase: 0.2, width: 1.5, dashes: [5, 5] },
        { radius: 88, tiltX: -0.62, speed: -0.24, phase: 1.5, width: 1.15, dashes: [10, 7] },
        { radius: 112, tiltX: 0.36, speed: 0.16, phase: 2.45, width: 0.9, dashes: [3, 8] },
      ];

      rings.forEach((ring, ringIndex) => {
        const ringRotation = ring.phase + angleY * ring.speed;
        ctx.save();
        ctx.translate(centerX, centerY);

        // Perspective transform simulation
        ctx.scale(1, Math.cos(ring.tiltX));
        ctx.rotate(ringRotation);

        ctx.beginPath();
        ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = activePalette.ring;
        ctx.lineWidth = ring.width;
        ctx.setLineDash(ring.dashes);
        ctx.lineDashOffset = -animationTime * ring.speed * 18;
        ctx.stroke();

        // Electrons travel at different speeds, each with a fine accent trail.
        const electronAngle = animationTime * (0.82 + ringIndex * 0.19) + ring.phase;
        const satX = ring.radius * Math.cos(electronAngle);
        const satY = ring.radius * Math.sin(electronAngle);
        const tailX = ring.radius * Math.cos(electronAngle - 0.18);
        const tailY = ring.radius * Math.sin(electronAngle - 0.18);
        const electronColor = colors[ringIndex % colors.length];
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(satX, satY);
        ctx.strokeStyle = colorWithAlpha(electronColor, live.isRunning ? 0.52 : 0.28);
        ctx.lineWidth = ringIndex === 0 ? 2 : 1.25;
        ctx.stroke();

        ctx.shadowColor = electronColor;
        ctx.shadowBlur = live.isRunning ? 12 : 6;
        ctx.fillStyle = electronColor;
        ctx.beginPath();
        ctx.arc(satX, satY, ringIndex === 0 ? 3.2 : 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      });

      // ── 3. 3D PARTICLE SWARM ──
      // Sort particles by Z depth for accurate rendering
      particles.sort((a, b) => b.z - a.z);

      for (const p of particles) {
        // Orbit dynamics
        if (!prefersReducedMotion) {
          const particleSpeed = 0.9 * deltaSeconds * (1 + p.vx * 0.32);
          const cosY = Math.cos(particleSpeed);
          const sinY = Math.sin(particleSpeed);
          const nx = p.x * cosY - p.z * sinY;
          const nz = p.x * sinY + p.z * cosY;
          p.x = nx;
          p.z = nz;
        }

        // 3D perspective projection
        const fov = 220;
        const scale = fov / (fov + p.z);
        const projX = centerX + p.x * scale;
        const projY = centerY + (p.y + Math.sin(animationTime * 0.75 + p.phase) * 2.1) * scale;

        if (scale > 0) {
          p.trail.push({ x: projX, y: projY });
          if (p.trail.length > 6) p.trail.shift();
          if (p.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            p.trail.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.strokeStyle = colorWithAlpha(colors[p.colorIndex], (live.isRunning ? 0.2 : 0.1) * scale);
            ctx.lineWidth = Math.max(0.6, p.size * scale * 0.55);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(projX, projY, Math.max(0.5, p.size * scale), 0, Math.PI * 2);
          ctx.fillStyle = colors[p.colorIndex];
          ctx.globalAlpha = Math.min(1, Math.max(0.1, p.alpha * scale));
          ctx.shadowColor = colors[p.colorIndex];
          ctx.shadowBlur = p.size > 2.4 ? 7 : 2;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        }
      }

      // ── 4. LUMINOUS INNER NUCLEUS ──
      const corePulse = 28 * breathingScale;
      const coreGradient = ctx.createRadialGradient(
        centerX - 4,
        centerY - 4,
        2,
        centerX,
        centerY,
        corePulse
      );
      coreGradient.addColorStop(0, '#FFFFFF');
      coreGradient.addColorStop(0.3, activePalette.secondary);
      coreGradient.addColorStop(0.8, activePalette.primary);
      coreGradient.addColorStop(1, 'rgba(224, 122, 95, 0)');

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Sharp inner diamond flare
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angleZ);
      const flareSize = 10 * breathingScale;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0, -flareSize);
      ctx.lineTo(flareSize * 0.4, 0);
      ctx.lineTo(0, flareSize);
      ctx.lineTo(-flareSize * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (!prefersReducedMotion) animationFrameId = requestAnimationFrame(render);
    };

    const startRender = () => {
      if (document.hidden) return;
      previousFrameTime = 0;
      render(performance.now());
    };
    const handleVisibilityChange = () => {
      if (document.hidden) cancelAnimationFrame(animationFrameId);
      else startRender();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startRender();

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      themeObserver.disconnect();
    };
  }, [prefersReducedMotion]);

  return (
    <div className={`relative ${isCompact ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-64 h-64 sm:w-72 sm:h-72'} mx-auto flex items-center justify-center my-1 select-none`}>
      {/* Background radial atmosphere */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-30 pointer-events-none transition-all duration-700"
        style={{
          backgroundColor:
            isRunning
              ? mode === 'work' ? 'var(--accent)' : 'var(--success)'
              : timeLeft < totalTime ? 'var(--accent-dark-resolved)' : 'var(--accent-light)',
        }}
      />

      {/* Primary 3D Focus Core Canvas */}
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="relative z-10 w-full h-full object-contain"
        aria-label="Interactive Focus Core Visualizer"
      />

      {/* Mode / Status badge underneath */}
      <div className="focus-visualizer-status absolute bottom-1 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-ivory-100/90 dark:bg-espresso-850/90 border border-ivory-300 dark:border-espresso-750 text-espresso-700 dark:text-ivory-300 shadow-xs pointer-events-none">
        {isCompleted
          ? 'Session Complete'
          : isRunning
          ? mode === 'work' ? 'Deep Flow Active' : 'Resting Interval'
          : timeLeft < totalTime
          ? 'Flow Paused'
          : 'Ready to Immerse'}
      </div>
    </div>
  );
};
