import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
  width,
  height,
  style,
  ...props
}) => {
  const variantClasses = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
    text: 'rounded-md h-3.5 my-1',
  }[variant];

  return (
    <div
      aria-hidden="true"
      className={`bg-espresso-200/50 dark:bg-white/10 animate-pulse motion-reduce:animate-none ${variantClasses} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/70 dark:bg-[#18151D]/70 space-y-3 ${className}`}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between">
      <Skeleton width="40%" height={16} />
      <Skeleton variant="circular" width={24} height={24} />
    </div>
    <Skeleton width="70%" height={28} />
    <Skeleton width="50%" height={12} />
  </div>
);

export const ListSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 4,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3.5 p-3.5 rounded-xl border border-ivory-300/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.03]"
      >
        <Skeleton variant="circular" width={36} height={36} className="shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={11} />
        </div>
        <Skeleton width={48} height={20} className="rounded-full shrink-0" />
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 4,
  className = '',
}) => (
  <div
    className={`w-full rounded-2xl border border-ivory-300/80 dark:border-white/10 overflow-hidden bg-white/60 dark:bg-[#18151D]/60 ${className}`}
    aria-hidden="true"
  >
    {/* Table Header */}
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-ivory-300/80 dark:border-white/10 bg-ivory-100/50 dark:bg-white/[0.02]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={`${100 / cols}%`} height={14} />
      ))}
    </div>
    {/* Table Body */}
    <div className="divide-y divide-ivory-200 dark:divide-white/5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${100 / cols}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8 animate-in fade-in duration-300" aria-label="Loading dashboard overview...">
    {/* Hero Banner Skeleton */}
    <div className="p-6 sm:p-8 rounded-3xl border border-ivory-300/80 dark:border-white/10 bg-white/60 dark:bg-[#18151D]/60 space-y-4">
      <Skeleton width={120} height={20} className="rounded-full" />
      <Skeleton width="50%" height={36} />
      <Skeleton width="30%" height={14} />
      <div className="pt-2 flex items-center gap-3 max-w-md">
        <Skeleton width="100%" height={8} className="rounded-full" />
      </div>
    </div>

    {/* KPI Grid Skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>

    {/* Bento Widget Grid Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/60 dark:bg-[#18151D]/60 space-y-4 min-h-[220px]"
        >
          <div className="flex items-center justify-between">
            <Skeleton width="45%" height={16} />
            <Skeleton width={20} height={20} className="rounded-md" />
          </div>
          <ListSkeleton count={3} />
        </div>
      ))}
    </div>
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="max-w-2xl mx-auto space-y-6 p-6 rounded-2xl border border-ivory-300/80 dark:border-white/10 bg-white/70 dark:bg-[#18151D]/70" aria-hidden="true">
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" width={64} height={64} />
      <div className="space-y-2 flex-1">
        <Skeleton width="40%" height={20} />
        <Skeleton width="60%" height={14} />
      </div>
    </div>
    <div className="space-y-4 pt-4 border-t border-ivory-200 dark:border-white/10">
      <Skeleton width="25%" height={14} />
      <Skeleton width="100%" height={40} className="rounded-xl" />
      <Skeleton width="25%" height={14} />
      <Skeleton width="100%" height={40} className="rounded-xl" />
    </div>
  </div>
);
