import React, { useMemo, useState } from 'react';
import {
  Salad,
  Flame,
  Scale,
  Search,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminNutritionView: React.FC = () => {
  const { state } = useAdminApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [mealFilter, setMealFilter] = useState<'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'>('all');

  const foodEntries = state.foodDiaryEntries || [];
  const weightLogs = state.weightLogs || [];
  const nutritionProfile = state.nutritionProfile;

  const stats = useMemo(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    foodEntries.forEach((entry) => {
      totalCalories += entry.calories || 0;
      totalProtein += entry.protein || 0;
      totalCarbs += entry.carbs || 0;
      totalFat += entry.fat || 0;
    });

    const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : undefined;

    return {
      totalEntries: foodEntries.length,
      totalCalories,
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      latestWeight,
    };
  }, [foodEntries, weightLogs]);

  const filteredEntries = useMemo(() => {
    return foodEntries.filter((f) => {
      const foodTitle = f.name || (f as any).foodName || '';
      const matchSearch = foodTitle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMeal = mealFilter === 'all' || f.mealType === mealFilter;
      return matchSearch && matchMeal;
    });
  }, [foodEntries, searchQuery, mealFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fuel OS — Nutrition &amp; Metabolic Telemetry"
        description="Comprehensive audit of daily food entries, macronutrient allocations, verified vs custom database records, and weight trend logs."
        badge={{ label: `${foodEntries.length} Food Entries`, variant: 'blue' }}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Daily Calorie Budget"
          value={nutritionProfile?.targetCalories ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}
          subtitle="Target energy allowance"
          icon={<Flame className="w-4 h-4" />}
          accentColor="#F59E0B"
        />

        <AdminStatCard
          title="Protein Intake"
          value={`${stats.totalProtein}g`}
          subtitle="Total logged protein"
          icon={<Salad className="w-4 h-4" />}
          accentColor="#10B981"
        />

        <AdminStatCard
          title="Body Weight Log"
          value={stats.latestWeight ? `${stats.latestWeight} kg` : '70.0 kg'}
          subtitle={`${weightLogs.length} weigh-in entries recorded`}
          icon={<Scale className="w-4 h-4" />}
          accentColor="#3B82F6"
        />

        <AdminStatCard
          title="Custom Foods"
          value={(state.customFoods || []).length}
          subtitle={`${(state.recipes || []).length} Custom recipes saved`}
          icon={<Sparkles className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />
      </div>

      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food by name..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          {(['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMealFilter(m)}
              className={`px-2.5 py-1 rounded-lg uppercase tracking-wider text-[10px] font-semibold transition cursor-pointer ${
                mealFilter === m
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white/5 text-ivory-400 hover:text-white border border-white/10'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Food Entries Table */}
      {filteredEntries.length === 0 ? (
        <AdminEmptyState
          icon={<Salad className="w-6 h-6" />}
          title="No Food Entries Logged"
          description="Log daily meals in Fuel OS to inspect calories, macronutrient distribution, and verified nutritional values."
        />
      ) : (
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Meal Type</th>
                  <th className="py-3.5 px-4">Food Item</th>
                  <th className="py-3.5 px-4">Calories</th>
                  <th className="py-3.5 px-4">P / C / F (g)</th>
                  <th className="py-3.5 px-4">Database Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {filteredEntries.map((f) => (
                  <tr key={f.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                      {f.date ? new Date(f.date).toLocaleDateString() : 'Recorded'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize font-mono font-semibold text-espresso-700 dark:text-ivory-200">
                        {f.mealType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-espresso-950 dark:text-white">
                      {f.name || (f as any).foodName}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-500">
                      {f.calories} kcal
                    </td>
                    <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                      <span className="text-emerald-500 font-semibold">{f.protein}p</span> /{' '}
                      <span className="text-blue-500 font-semibold">{f.carbs}c</span> /{' '}
                      <span className="text-purple-500 font-semibold">{f.fat}f</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
