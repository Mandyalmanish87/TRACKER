import React, { useEffect, useRef, useState } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  className?: string;
  variant?: 'bars' | 'wave' | 'orbital';
  color?: string; // Accepts an app theme color or a fixed CSS color.
}

export const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  className = '',
  variant = 'bars',
  color = 'var(--accent)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);
  // Start with a valid canvas color; the theme token is resolved in an effect
  // after mount and must never reach CanvasGradient.addColorStop directly.
  const [resolvedColor, setResolvedColor] = useState('#C45532');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resolveThemeColor = () => {
      // Canvas APIs require a concrete color, while theme tokens can themselves
      // point at another CSS variable. Resolve through the computed `color` value.
      canvas.style.color = color;
      const computedColor = getComputedStyle(canvas).color;
      setResolvedColor(computedColor && computedColor !== 'canvastext' ? computedColor : '#C45532');
    };
    resolveThemeColor();
    const observer = new MutationObserver(resolveThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent', 'style'] });
    return () => observer.disconnect();
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    // Number of bars or wave points
    const numBars = 48;
    const barHeights = new Array(numBars).fill(4);

    const render = () => {
      if (!running) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      phaseRef.current += isPlaying ? 0.055 : 0;
      const phase = phaseRef.current;

      if (variant === 'bars') {
        const barWidth = Math.max(2, (width - (numBars - 1) * 3) / numBars);
        for (let i = 0; i < numBars; i++) {
          let targetHeight = 4;
          if (isPlaying) {
            // Simulated rhythmic harmonic variation
            const s1 = Math.sin(phase * 1.5 + i * 0.4);
            const s2 = Math.cos(phase * 0.8 + i * 0.2);
            targetHeight = Math.max(4, Math.abs(s1 * 0.6 + s2 * 0.4) * (height - 6));
          }
          // Smooth interpolation
          if (!isPlaying) barHeights[i] = 3;
          else barHeights[i] += (targetHeight - barHeights[i]) * 0.18;

          const x = i * (barWidth + 3);
          const y = height - barHeights[i];

          const gradient = ctx.createLinearGradient(0, y, 0, height);
          gradient.addColorStop(0, resolvedColor);
          gradient.addColorStop(1, resolvedColor);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeights[i], [2, 2, 0, 0]);
          ctx.fill();
        }
      } else if (variant === 'orbital') {
        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(cx, cy) * 0.65;

        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const points = 36;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wobble = isPlaying
            ? Math.sin(angle * 4 + phase * 2) * 6 + Math.cos(angle * 7 - phase) * 4
            : 0;
          const r = baseRadius + wobble;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (variant === 'wave') {
        const centerY = height * 0.53;
        const points = Math.max(60, Math.floor(width / 3));
        const amplitude = isPlaying ? height * 0.32 : height * 0.025;
        const waves = [
          { gain: 1, frequency: 1.25, speed: 1, alpha: 0.95, line: 2.1 },
          { gain: 0.5, frequency: 1.9, speed: -0.72, alpha: 0.4, line: 1.15 },
          { gain: 0.28, frequency: 2.65, speed: 0.48, alpha: 0.24, line: 1 },
        ];
        waves.forEach((wave, waveIndex) => {
          ctx.beginPath();
          for (let i = 0; i <= points; i++) {
            const x = (i / points) * width;
            const progress = i / points;
            const envelope = Math.sin(progress * Math.PI) ** 0.55;
            const fundamental = Math.sin(progress * Math.PI * 2 * wave.frequency + phase * wave.speed);
            const overtone = Math.sin(progress * Math.PI * 5.1 - phase * wave.speed * 0.63 + waveIndex) * 0.24;
            const y = centerY + (fundamental + overtone) * amplitude * wave.gain * envelope;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = resolvedColor;
          ctx.globalAlpha = wave.alpha;
          ctx.lineWidth = wave.line;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = resolvedColor;
          ctx.shadowBlur = isPlaying && waveIndex === 0 ? 13 : 0;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        });

        // A soft centerline keeps the visualizer composed when paused.
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = resolvedColor;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animFrameRef.current = isPlaying ? requestAnimationFrame(render) : null;
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, variant, resolvedColor]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={480}
        height={72}
        className="w-full h-full max-h-12 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};

