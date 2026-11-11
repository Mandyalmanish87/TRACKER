import React, { useState, useMemo } from 'react';
import { FoodDiaryEntry } from '../../types/fitness';
import { MICRONUTRIENT_REFERENCE_TARGETS } from '../../utils/micronutrientReferenceData';
import {
  Search,
  Apple,
} from 'lucide-react';

interface CronometerMicronutrientDashboardProps {
  dayEntries: FoodDiaryEntry[];
}

export const CronometerMicronutrientDashboard: React.FC<CronometerMicronutrientDashboardProps> = ({
  dayEntries = [],
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'vitamins' | 'minerals' | 'lipids_other'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Aggregate all micronutrients from dayEntries
  const aggregatedMicros = useMemo(() => {
    const totals: Record<string, number> = {};

    dayEntries.forEach((entry) => {
      // Top-level entry fields
      if (typeof entry.fiber === 'number') totals['fiberGrams'] = (totals['fiberGrams'] || 0) + entry.fiber;
      if (typeof entry.sugar === 'number') totals['sugarGrams'] = (totals['sugarGrams'] || 0) + entry.sugar;
      if (typeof entry.sodium === 'number') totals['sodiumMg'] = (totals['sodiumMg'] || 0) + entry.sodium;

      // Nested micronutrients object
      if (entry.micronutrients) {
        const m = entry.micronutrients as Record<string, number | undefined>;
        Object.entries(m).forEach(([key, val]) => {
          if (typeof val === 'number') {
            totals[key] = (totals[key] || 0) + val;
          }
        });
      }
    });

    return totals;
  }, [dayEntries]);

  // Filter nutrient list
  const filteredNutrients = useMemo(() => {
    return MICRONUTRIENT_REFERENCE_TARGETS.filter((n) => {
      const matchesCat = activeCategory === 'all' || n.category === activeCategory;
      const matchesQuery =
        !searchQuery.trim() ||
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Apple className="w-5 h-5 text-sage-600 dark:text-sage-400" />
            <div>
              <h3 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                Micronutrient Fulfillment Dashboard
              </h3>
              <p className="text-xs text-espresso-500">
                Cronometer-style tracking of vitamins, essential minerals, electrolytes, and lipid targets
              </p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All Nutrients' },
              { id: 'vitamins', label: 'Vitamins' },
              { id: 'minerals', label: 'Minerals' },
              { id: 'lipids_other', label: 'Lipids & Other' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-xs'
                    : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-espresso-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nutrient (e.g. Iron, Vitamin D, Zinc)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-100 placeholder:text-espresso-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
        </div>
      </div>

      {/* Micronutrients Progress Bars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredNutrients.map((n) => {
          const rawVal = aggregatedMicros[n.key];
          const val = typeof rawVal === 'number' ? Number(rawVal.toFixed(1)) : 0;
          const pct = Math.round((val / n.standardTarget) * 100);

          // Color calculation
          let barColor = '#22c55e'; // Green
          if (n.isUpperLimit) {
            barColor = pct > 100 ? '#ef4444' : '#22c55e';
          } else {
            barColor = pct >= 100 ? '#22c55e' : pct >= 60 ? '#eab308' : '#f97316';
          }

          return (
            <div
              key={n.key}
              className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2 hover:border-ivory-400 dark:hover:border-espresso-700 transition"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-espresso-950 dark:text-ivory-50">{n.name}</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-espresso-950 dark:text-ivory-50">
                    {val} / {n.standardTarget} {n.unit}
                  </span>
                  <span
                    className="font-bold text-[11px] px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${barColor}15`,
                      color: barColor,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              <p className="text-[11px] text-espresso-500 dark:text-espresso-400 leading-snug">
                {n.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
