import React from 'react';
import { motion } from 'motion/react';

export const AmbientGlowBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-1000">
      {/* Primary Accent Orb - Top Left */}
      <motion.div
        animate={{
          x: [0, 45, -35, 0],
          y: [0, -35, 25, 0],
          scale: [1, 1.18, 0.92, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-[110px] opacity-25 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        }}
      />

      {/* Secondary Cyber Violet/Indigo Orb - Top Right */}
      <motion.div
        animate={{
          x: [0, -50, 40, 0],
          y: [0, 45, -30, 0],
          scale: [1, 1.15, 0.88, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
        className="absolute -top-20 right-[5%] w-[480px] h-[480px] rounded-full blur-[120px] opacity-20 dark:opacity-25"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
        }}
      />

      {/* Tertiary Cyan/Teal Orb - Bottom Center / Left */}
      <motion.div
        animate={{
          x: [0, 35, -45, 0],
          y: [0, -30, 40, 0],
          scale: [0.9, 1.12, 1, 0.9],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
        className="absolute bottom-10 left-[20%] w-[560px] h-[560px] rounded-full blur-[130px] opacity-15 dark:opacity-15"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
        }}
      />

      {/* Subtle Digital Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
};

