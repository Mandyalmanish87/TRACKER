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
  color: string;
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
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E07A5F', '#3D405B', '#81B29A', '#F2CC8F'],
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

    // Palette tokens based on mode and state
    const coreColors = {
      work: {
        primary: '#E07A5F',      // Terracotta
        secondary: '#F2CC8F',    // Warm Ochre
        glow: 'rgba(224, 122, 95, 0.45)',
        ring: 'rgba(224, 122, 95, 0.35)',
      },
      break: {
        primary: '#81B29A',      // Sage green
        secondary: '#3D405B',    // Slate blue
        glow: 'rgba(129, 178, 154, 0.45)',
        ring: 'rgba(129, 178, 154, 0.35)',
      },
      paused: {
        primary: '#D4A373',      // Calm amber
        secondary: '#B08968',
        glow: 'rgba(212, 163, 115, 0.3)',
        ring: 'rgba(212, 163, 115, 0.25)',
      },
    };

    // Determine active palette
    const activePalette = !isRunning && timeLeft > 0 && timeLeft < totalTime
      ? coreColors.paused
      : mode === 'work'
      ? coreColors.work
      : coreColors.break;

    // Initialize 3D particle swarm
    const particleCount = 42;
    const particles: Particle[] = [];
    const colors = [activePalette.primary, activePalette.secondary, '#F4F1DE'];

    for (let i = 0; i < particleCount; i++) {
      const radius = 45 + Math.random() * 65;
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
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let angleY = 0;
    let angleZ = 0;
    let pulseTime = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const speedMultiplier = prefersReducedMotion
        ? 0
        : isRunning
        ? 1.0
        : timeLeft === 0
        ? 0.3
        : 0.4;

      pulseTime += 0.025 * (isRunning ? 1.4 : 0.8);
      angleY += 0.012 * speedMultiplier;
      angleZ += 0.007 * speedMultiplier;

      // ── 1. BACKGROUND GLOW AURA ──
      const breathingScale = 1 + Math.sin(pulseTime) * (isRunning ? 0.08 : 0.04);
      const auraRadius = Math.max(10, 60 * breathingScale);

      const auraGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        auraRadius
      );
      auraGradient.addColorStop(0, activePalette.glow);
      auraGradient.addColorStop(0.6, activePalette.glow.replace('0.45', '0.12').replace('0.3', '0.08'));
      auraGradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── 2. TIERED 3D GYROSCOPIC ORBITAL RINGS ──
      const rings = [
        { radius: 68, tiltX: 0.8, tiltY: angleY * 1.2, width: 1.5, dashes: [6, 4] },
        { radius: 88, tiltX: -0.6, tiltY: -angleY * 0.9, width: 1.2, dashes: [12, 6] },
        { radius: 108, tiltX: 0.3, tiltY: angleY * 0.6, width: 1, dashes: [4, 8] },
      ];

      for (const ring of rings) {
        ctx.save();
        ctx.translate(centerX, centerY);

        // Perspective transform simulation
        ctx.scale(1, Math.cos(ring.tiltX));
        ctx.rotate(ring.tiltY);

        ctx.beginPath();
        ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = activePalette.ring;
        ctx.lineWidth = ring.width;
        ctx.setLineDash(ring.dashes);
        ctx.stroke();

        // Orbital Satellites / Nodes
        const satAngle = (ring.tiltY * 2) % (Math.PI * 2);
        const satX = ring.radius * Math.cos(satAngle);
        const satY = ring.radius * Math.sin(satAngle);

        ctx.fillStyle = activePalette.primary;
        ctx.beginPath();
        ctx.arc(satX, satY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // ── 3. 3D PARTICLE SWARM ──
      // Sort particles by Z depth for accurate rendering
      particles.sort((a, b) => b.z - a.z);

      for (const p of particles) {
        // Orbit dynamics
        if (!prefersReducedMotion) {
          const cosY = Math.cos(0.015 * speedMultiplier);
          const sinY = Math.sin(0.015 * speedMultiplier);
          const nx = p.x * cosY - p.z * sinY;
          const nz = p.x * sinY + p.z * cosY;
          p.x = nx;
          p.z = nz;
        }

        // 3D perspective projection
        const fov = 220;
        const scale = fov / (fov + p.z);
        const projX = centerX + p.x * scale;
        const projY = centerY + p.y * scale;

        if (scale > 0) {
          ctx.beginPath();
          ctx.arc(projX, projY, Math.max(0.5, p.size * scale), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, Math.max(0.1, p.alpha * scale));
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      // ── 4. LUMINOUS INNER NUCLEUS ──
      const corePulse = 26 * breathingScale;
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

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRunning, timeLeft, totalTime, mode, isCompleted, prefersReducedMotion]);

  return (
    <div className={`relative ${isCompact ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-64 h-64 sm:w-72 sm:h-72'} mx-auto flex items-center justify-center my-1 select-none`}>
      {/* Background radial atmosphere */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-30 pointer-events-none transition-all duration-700"
        style={{
          backgroundColor:
            isRunning
              ? mode === 'work' ? '#E07A5F' : '#81B29A'
              : '#D4A373',
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
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-ivory-100/90 dark:bg-espresso-850/90 border border-ivory-300 dark:border-espresso-750 text-espresso-700 dark:text-ivory-300 shadow-xs pointer-events-none">
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
