import React, { useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { FoodDiaryEntry, NutritionProfile } from '../../types';

interface NutritionAnalyticsProps {
  entries: FoodDiaryEntry[];
  profile: NutritionProfile;
  onSelectDate: (date: string) => void;
  onSwitchToDayView: () => void;
}

export const NutritionAnalytics: React.FC<NutritionAnalyticsProps> = ({
  entries,
  profile,
  onSelectDate,
  onSwitchToDayView,
}) => {
  const [analyticsRange, setAnalyticsRange] = useState<'week' | 'year'>('week');
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    itemsCount: number;
  } | null>(null);

  const targetCalories = profile.targetCalories || 2200;

  // Group all entries by YYYY-MM-DD
  const dailyAggregates = useMemo(() => {
    const map = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number; items: FoodDiaryEntry[] }
    >();

    entries.forEach((e) => {
      const current = map.get(e.date) || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        items: [],
      };
      current.calories += e.calories;
      current.protein += e.protein;
      current.carbs += e.carbs;
      current.fat += e.fat;
      current.items.push(e);
      map.set(e.date, current);
    });

    return map;
  }, [entries]);

  // ─── 7-Day (Week) Data ──────────────────────────────────────────────────────────
  const weekData = useMemo(() => {
    const today = new Date();
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const agg = dailyAggregates.get(dateStr) || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        items: [],
      };

      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

      days.push({
        date: dateStr,
        dayLabel,
        calories: agg.calories,
        protein: Number(agg.protein.toFixed(1)),
        carbs: Number(agg.carbs.toFixed(1)),
        fat: Number(agg.fat.toFixed(1)),
        isToday: i === 0,
        itemsCount: agg.items.length,
      });
    }

    const activeDays = days.filter((d) => d.calories > 0);
    const avgCalories =
      activeDays.length > 0
        ? Math.round(activeDays.reduce((acc, d) => acc + d.calories, 0) / activeDays.length)
        : 0;
    const avgProtein =
      activeDays.length > 0
        ? Number(
            (activeDays.reduce((acc, d) => acc + d.protein, 0) / activeDays.length).toFixed(1)
          )
        : 0;

    return { days, avgCalories, avgProtein, activeCount: activeDays.length };
  }, [dailyAggregates]);

  // ─── Year Heatmap Data (Last 52 weeks = 364 days) ────────────────────────────────
  const yearHeatmapWeeks = useMemo(() => {
    const today = new Date();
    const totalDays = 52 * 7;
    const weeks: Array<
      Array<{
        date: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        itemsCount: number;
        status: 'on_target' | 'surplus' | 'deficit' | 'empty';
      }>
    > = [];

    let currentWeek: Array<{
      date: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      itemsCount: number;
      status: 'on_target' | 'surplus' | 'deficit' | 'empty';
    }> = [];

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const agg = dailyAggregates.get(dateStr);
      let status: 'on_target' | 'surplus' | 'deficit' | 'empty' = 'empty';

      if (agg && agg.calories > 0) {
        const diff = agg.calories - targetCalories;
        if (Math.abs(diff) <= targetCalories * 0.1) {
          status = 'on_target';
        } else if (diff > 0) {
          status = 'surplus';
        } else {
          status = 'deficit';
        }
      }

      currentWeek.push({
        date: dateStr,
        calories: agg?.calories || 0,
        protein: Number((agg?.protein || 0).toFixed(1)),
        carbs: Number((agg?.carbs || 0).toFixed(1)),
        fat: Number((agg?.fat || 0).toFixed(1)),
        itemsCount: agg?.items.length || 0,
        status,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [dailyAggregates, targetCalories]);

  return (
    <div className="space-y-6">
      {/* Sub-navigation pill: Week vs Year */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 bg-ivory-200 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-750">
          <button
            onClick={() => setAnalyticsRange('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              analyticsRange === 'week'
                ? 'bg-white dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 shadow-xs'
                : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            Past 7 Days (Week)
          </button>
          <button
            onClick={() => setAnalyticsRange('year')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              analyticsRange === 'year'
                ? 'bg-white dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 shadow-xs'
                : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            Annual Calendar Heatmap (365 Days)
          </button>
        </div>

        <button
          onClick={onSwitchToDayView}
          className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:text-terracotta-700 flex items-center gap-1"
        >
          <span>Open Daily Diary</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ─── WEEK VIEW ────────────────────────────────────────────────────────── */}
      {analyticsRange === 'week' && (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 shadow-sm">
              <span className="text-[11px] font-mono uppercase text-espresso-400 font-semibold block mb-1">
                7-Day Average Energy
              </span>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
                {weekData.avgCalories}{' '}
                <span className="text-xs font-normal text-espresso-500">kcal/day</span>
              </p>
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-1">
                Target: {targetCalories} kcal ({weekData.avgCalories - targetCalories >= 0 ? '+' : ''}
                {weekData.avgCalories - targetCalories} kcal)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 shadow-sm">
              <span className="text-[11px] font-mono uppercase text-espresso-400 font-semibold block mb-1">
                7-Day Average Protein
              </span>
              <p className="font-serif text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {weekData.avgProtein}{' '}
                <span className="text-xs font-normal text-espresso-500">g/day</span>
              </p>
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-1">
                Target: {profile.macroTargets?.protein || 140}g protein
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 shadow-sm">
              <span className="text-[11px] font-mono uppercase text-espresso-400 font-semibold block mb-1">
                Consistency Score
              </span>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 tabular-nums">
                {weekData.activeCount} <span className="text-xs font-normal text-espresso-500">/ 7 days</span>
              </p>
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-1">
                Active food logs recorded
              </p>
            </div>
          </div>

          {/* 7-Day Bar Chart */}
          <div className="p-5 rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                  Daily Calorie Intake vs. Target
                </h3>
                <p className="text-xs text-espresso-500 dark:text-espresso-400">
                  Past 7 consecutive days compared to your {profile.goal.toUpperCase()} budget.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-espresso-600 dark:text-espresso-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-terracotta-500 inline-block" />
                  Calories Consumed
                </span>
                <span className="flex items-center gap-1.5 text-espresso-500 dark:text-espresso-400">
                  <span className="w-2.5 h-0.5 bg-espresso-400 inline-block" />
                  Target ({targetCalories})
                </span>
              </div>
            </div>

            {/* SVG / Flex Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-ivory-200 dark:border-espresso-800">
              {weekData.days.map((day) => {
                const maxChartCal = Math.max(targetCalories * 1.3, 3000);
                const heightPct = Math.min(100, Math.round((day.calories / maxChartCal) * 100));
                const targetLinePct = Math.min(100, Math.round((targetCalories / maxChartCal) * 100));
                const isOver = day.calories > targetCalories;

                return (
                  <div
                    key={day.date}
                    onClick={() => {
                      onSelectDate(day.date);
                      onSwitchToDayView();
                    }}
                    className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-espresso-900 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap z-20 font-mono">
                      {day.date}: {day.calories} kcal ({day.protein}g P)
                    </div>

                    {/* Target line guideline */}
                    <div
                      className="absolute w-full border-t border-dashed border-espresso-300 dark:border-espresso-700 pointer-events-none"
                      style={{ bottom: `${targetLinePct}%` }}
                    />

                    {/* Bar */}
                    <div className="w-full max-w-[40px] bg-ivory-100 dark:bg-espresso-850 rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isOver ? 'bg-amber-500' : 'bg-terracotta-500 group-hover:bg-terracotta-600'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Day label */}
                    <span
                      className={`text-[11px] font-mono mt-2 ${
                        day.isToday
                          ? 'font-bold text-terracotta-600 dark:text-terracotta-400'
                          : 'text-espresso-500 dark:text-espresso-400'
                      }`}
                    >
                      {day.dayLabel}
                    </span>
                    <span className="text-[10px] text-espresso-400 tabular-nums">
                      {day.calories > 0 ? `${day.calories}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── YEAR HEATMAP VIEW ────────────────────────────────────────────────── */}
      {analyticsRange === 'year' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Annual Nutrition Adherence Heatmap
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                52-week calendar tracking daily caloric compliance against your {targetCalories} kcal goal.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-[11px] text-espresso-600 dark:text-espresso-300">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                Target (±10%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
                Deficit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                Surplus
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-ivory-200 dark:bg-espresso-800 inline-block" />
                No logs
              </span>
            </div>
          </div>

          {/* Grid of 52 weeks x 7 days */}
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <div className="flex gap-1 min-w-[700px]">
              {yearHeatmapWeeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((day) => {
                    let bg = 'bg-ivory-200 dark:bg-espresso-800';
                    if (day.status === 'on_target') bg = 'bg-emerald-500';
                    else if (day.status === 'deficit') bg = 'bg-blue-500';
                    else if (day.status === 'surplus') bg = 'bg-amber-500';

                    return (
                      <div
                        key={day.date}
                        onClick={() => setSelectedHeatmapDay(day)}
                        className={`w-3.5 h-3.5 rounded-xs ${bg} cursor-pointer hover:ring-2 hover:ring-espresso-900 dark:hover:ring-ivory-100 transition`}
                        title={`${day.date}: ${day.calories} kcal`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Day Detail Card on Selection */}
          {selectedHeatmapDay && (
            <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-300 dark:border-espresso-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <span className="text-[11px] font-mono text-espresso-400 uppercase">Selected Day</span>
                <p className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                  {selectedHeatmapDay.date}
                </p>
                <p className="text-xs text-espresso-600 dark:text-espresso-300 mt-0.5">
                  <strong>{selectedHeatmapDay.calories} kcal</strong> ({selectedHeatmapDay.protein}g P · {selectedHeatmapDay.carbs}g C · {selectedHeatmapDay.fat}g F) · {selectedHeatmapDay.itemsCount} food items
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedHeatmapDay(null)}
                  className="px-3 py-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 text-xs text-espresso-600 dark:text-espresso-400 hover:bg-ivory-100 dark:hover:bg-espresso-850"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    onSelectDate(selectedHeatmapDay.date);
                    onSwitchToDayView();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <span>Open in Diary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
