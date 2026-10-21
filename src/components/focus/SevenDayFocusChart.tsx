import React, { useState } from 'react';
import { DayFocusMetric } from '../../utils/focusAnalytics';

interface SevenDayFocusChartProps {
  data: DayFocusMetric[];
}

export const SevenDayFocusChart: React.FC<SevenDayFocusChartProps> = ({ data }) => {
  const [hoveredDay, setHoveredDay] = useState<DayFocusMetric | null>(null);

  const maxMinutes = Math.max(60, ...data.map((d) => d.minutes));

  // Chart dimensions
  const barAreaHeight = 110;

  return (
    <div className="w-full bg-white dark:bg-espresso-850 rounded-2xl border border-ivory-300 dark:border-espresso-750 p-5 shadow-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
            7-Day Focus Distribution
          </h3>
          <p className="text-xs text-espresso-500 dark:text-espresso-400">
            Daily focused study time (including zero-study days)
          </p>
        </div>

        {/* Hovered day tooltip / detail */}
        <div className="text-xs font-mono font-medium text-espresso-700 dark:text-ivory-200 h-5">
          {hoveredDay ? (
            <span>
              {hoveredDay.dayName} ({hoveredDay.dateStr}):{' '}
              <strong style={{ color: 'var(--accent)' }}>{hoveredDay.minutes} min</strong> (
              {hoveredDay.completedCount} completed)
            </span>
          ) : (
            <span className="text-espresso-400 dark:text-espresso-500 italic">
              Hover bar for session breakdown
            </span>
          )}
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="relative w-full">
        <svg
          viewBox="0 0 700 170"
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1={barAreaHeight}
            x2="700"
            y2={barAreaHeight}
            stroke="currentColor"
            className="text-ivory-300 dark:text-espresso-750"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={barAreaHeight / 2}
            x2="700"
            y2={barAreaHeight / 2}
            stroke="currentColor"
            className="text-ivory-200 dark:text-espresso-800"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {data.map((day, idx) => {
            const barWidth = 46;
            const groupWidth = 700 / 7;
            const xCenter = idx * groupWidth + groupWidth / 2;
            const x = xCenter - barWidth / 2;

            // Height calculation: minimum 4px for zero days so baseline is clean
            const height =
              day.minutes > 0
                ? Math.max(8, (day.minutes / maxMinutes) * barAreaHeight)
                : 3;
            const y = barAreaHeight - height;

            const isHovered = hoveredDay?.dateStr === day.dateStr;

            return (
              <g
                key={day.dateStr}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className="cursor-pointer transition-opacity"
              >
                {/* Background column highlight on hover */}
                <rect
                  x={idx * groupWidth + 4}
                  y={0}
                  width={groupWidth - 8}
                  height={barAreaHeight + 40}
                  className={`transition-colors rounded-xl ${
                    isHovered
                      ? 'fill-ivory-200/60 dark:fill-espresso-750/50'
                      : 'fill-transparent'
                  }`}
                  rx="8"
                />

                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="6"
                  className="transition-all duration-300"
                  fill={
                    day.minutes > 0
                      ? isHovered
                        ? 'var(--accent)'
                        : 'var(--accent)'
                      : undefined
                  }
                  style={{
                    fill: day.minutes > 0 ? 'var(--accent)' : undefined,
                    opacity: day.minutes > 0 ? (isHovered ? 1 : 0.85) : 0.3,
                  }}
                />

                {/* Minute Label above bar if > 0 */}
                {day.minutes > 0 && (
                  <text
                    x={xCenter}
                    y={Math.max(12, y - 6)}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold fill-espresso-800 dark:fill-ivory-100"
                  >
                    {day.minutes}m
                  </text>
                )}

                {/* Day label */}
                <text
                  x={xCenter}
                  y={barAreaHeight + 20}
                  textAnchor="middle"
                  className={`text-[12px] font-mono font-semibold ${
                    day.isToday
                      ? 'fill-terracotta-600 dark:fill-terracotta-400 font-bold'
                      : 'fill-espresso-600 dark:fill-espresso-400'
                  }`}
                >
                  {day.dayShort}
                </text>

                {/* Date sub-label */}
                <text
                  x={xCenter}
                  y={barAreaHeight + 35}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-espresso-400 dark:fill-espresso-500"
                >
                  {day.date.getMonth() + 1}/{day.date.getDate()}
                </text>

                {/* Today indicator dot */}
                {day.isToday && (
                  <circle
                    cx={xCenter}
                    cy={barAreaHeight + 46}
                    r="2.5"
                    style={{ fill: 'var(--accent)' }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
