import React from 'react';

interface ProgressBarProps {
  value: number; // 0 - 100
  threshold?: number; // e.g. 75% for attendance minimum
  status?: 'safe' | 'warning' | 'danger';
  height?: 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  threshold,
  status = 'safe',
  height = 'md',
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  const statusColor =
    status === 'safe'
      ? 'bg-sage-500'
      : status === 'warning'
      ? 'bg-ochre-500'
      : 'bg-red-500';

  const heightClasses = height === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className={`relative w-full bg-ivory-200 dark:bg-espresso-800 rounded-full overflow-hidden ${heightClasses} ${className}`}>
      <div
        className={`h-full transition-all duration-500 ease-out rounded-full ${statusColor}`}
        style={{ width: `${clamped}%` }}
      />
      {threshold !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-espresso-600 dark:bg-ivory-300 opacity-60 z-10"
          style={{ left: `${threshold}%` }}
          title={`Target threshold: ${threshold}%`}
        />
      )}
    </div>
  );
};
