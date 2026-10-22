import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  className?: string;
  variant?: 'bars' | 'wave' | 'orbital';
  color?: string; // default lime #C8FF45
}

export const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  className = '',
  variant = 'bars',
  color = '#C8FF45',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    // Number of bars or wave points
    const numBars = 24;
    const barHeights = new Array(numBars).fill(4);

    const render = () => {
      if (!running) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      phaseRef.current += isPlaying ? 0.08 : 0.01;
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
          barHeights[i] += (targetHeight - barHeights[i]) * 0.2;

          const x = i * (barWidth + 3);
          const y = height - barHeights[i];

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeights[i], [2, 2, 0, 0]);
          ctx.fill();
        }
      } else if (variant === 'orbital') {
        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(cx, cy) * 0.65;

        ctx.strokeStyle = color;
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
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, variant, color]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={160}
        height={40}
        className="w-full h-full max-h-12 pointer-events-none"
        title="Simulated Ambient Audio Visualizer"
      />
    </div>
  );
};

