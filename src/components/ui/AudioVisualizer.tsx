import React from 'react';
import { motion } from 'motion/react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barsCount?: number;
  barWidth?: string;
  maxHeight?: number;
  className?: string;
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barsCount = 5,
  barWidth = 'w-1',
  maxHeight = 18,
  className = '',
  color = 'var(--accent)',
}) => {
  const bars = Array.from({ length: barsCount });

  // Variations in bar animation timings to look authentic
  const durations = [0.65, 0.85, 0.72, 0.95, 0.8, 0.9, 0.75, 0.88];
  const delayFactors = [0.1, 0.3, 0.15, 0.4, 0.2, 0.35, 0.25, 0.18];

  return (
    <div className={`flex items-end gap-1 h-[${maxHeight}px] ${className}`} style={{ height: maxHeight }}>
      {bars.map((_, i) => {
        const dur = durations[i % durations.length];
        const del = delayFactors[i % delayFactors.length];

        return (
          <motion.div
            key={i}
            className={`${barWidth} rounded-full`}
            style={{ backgroundColor: color }}
            animate={
              isPlaying
                ? {
                    height: [
                      `${Math.max(4, maxHeight * 0.2)}px`,
                      `${maxHeight}px`,
                      `${Math.max(4, maxHeight * 0.45)}px`,
                      `${maxHeight * 0.85}px`,
                      `${Math.max(4, maxHeight * 0.2)}px`,
                    ],
                  }
                : {
                    height: '4px',
                  }
            }
            transition={
              isPlaying
                ? {
                    duration: dur,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'easeInOut',
                    delay: del,
                  }
                : {
                    duration: 0.3,
                  }
            }
          />
        );
      })}
    </div>
  );
};

