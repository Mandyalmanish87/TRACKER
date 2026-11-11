import React from 'react';

export const CycleWheel: React.FC<{ cycleDay: number | null; totalDays: number | null; privacyMode?: boolean }> = ({ cycleDay, totalDays, privacyMode = false }) => {
  const progress = cycleDay && totalDays ? Math.min(cycleDay / totalDays, 1) : 0;
  const circumference = 2 * Math.PI * 48;
  return <div className="bloom-widget-wheel" role="img" aria-label={cycleDay && totalDays ? `Cycle day ${cycleDay} of estimated ${totalDays}` : 'Log period dates to view cycle progress'}><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="cycle-wheel-gradient"><stop stopColor="#f4adb8"/><stop offset="1" stopColor="#9f84bd"/></linearGradient></defs><circle cx="60" cy="60" r="48" className="bloom-wheel-track"/><circle cx="60" cy="60" r="48" className="bloom-wheel-progress" stroke="url(#cycle-wheel-gradient)" strokeDasharray={circumference} strokeDashoffset={circumference * (1-progress)}/></svg><span><strong>{privacyMode ? '••' : cycleDay ?? '—'}</strong><small>{privacyMode ? 'private' : cycleDay ? `day of ${totalDays ?? 'cycle'}` : 'cycle day'}</small></span></div>;
};
