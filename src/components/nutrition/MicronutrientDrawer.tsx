import React, { useMemo } from 'react';
import { FoodDiaryEntry } from '../../types';
import { aggregateMicronutrients, MicronutrientAggregateItem } from '../../utils/smartNutritionEngine';
import { ShieldCheck, HelpCircle, X } from 'lucide-react';

interface MicronutrientDrawerProps {
  entries: FoodDiaryEntry[];
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
}

export const MicronutrientDrawer: React.FC<MicronutrientDrawerProps> = ({
  entries,
  isOpen,
  onClose,
  dateStr,
}) => {
  const aggregates = useMemo((): MicronutrientAggregateItem[] => {
    const summary = aggregateMicronutrients(entries);
    return Object.values(summary.vitaminsAndMinerals);
  }, [entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sage-100 dark:bg-sage-900/40 text-sage-600 dark:text-sage-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Micronutrient Spectrum Analysis
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Daily vitamin, mineral, and electrolyte intake for {dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Philosophy Callout */}
        <div className="p-4 bg-ivory-50 dark:bg-espresso-850 border-b border-ivory-200 dark:border-espresso-800 flex items-start gap-2.5 text-xs text-espresso-600 dark:text-espresso-300">
          <HelpCircle className="w-4 h-4 text-ochre-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-espresso-900 dark:text-ivory-100">
              Evidence-based transparency:
            </span>{' '}
            Foods without laboratory-tested micronutrient breakdowns are tracked as{' '}
            <span className="font-semibold italic">Unknown</span>, rather than misleadingly reported as zero.
          </div>
        </div>

        {/* Aggregates List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {aggregates.map((item: MicronutrientAggregateItem) => {
              const isUnknown = item.knownEntriesCount === 0;
              const percentOfRDA = item.rdaReference ? Math.min(100, item.percentageOfRda) : null;

              return (
                <div
                  key={item.name}
                  className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-espresso-950 dark:text-ivory-100">
                      {item.name}
                    </span>
                    {isUnknown ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-ivory-200 dark:bg-espresso-750 text-espresso-500">
                        Unknown
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-bold text-espresso-900 dark:text-ivory-50">
                        {item.totalAmount.toLocaleString()} {item.unit}
                      </span>
                    )}
                  </div>

                  {item.rdaReference > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-espresso-400">
                        <span>RDA Target: {item.rdaReference} {item.unit}</span>
                        {!isUnknown && (
                          <span className={percentOfRDA && percentOfRDA >= 100 ? 'text-sage-600 font-bold' : ''}>
                            {percentOfRDA}%
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-ivory-200 dark:bg-espresso-750 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isUnknown
                              ? 'bg-transparent'
                              : percentOfRDA && percentOfRDA >= 100
                              ? 'bg-sage-600'
                              : 'bg-terracotta-500'
                          }`}
                          style={{ width: `${isUnknown ? 0 : percentOfRDA}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-espresso-400 font-mono">
                    {item.knownEntriesCount} of {entries.length} items logged with data
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

