import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateNavyBodyComposition } from '../../utils/bodyComposition';
import { Ruler, Check, X } from 'lucide-react';
import { Button } from '../common/Button';

interface BodyCircumferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BodyCircumferenceModal: React.FC<BodyCircumferenceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, logBodyMeasurement, logBodyComposition } = useApp();

  const latest = useMemo(() => {
    const list = state.bodyMeasurements || [];
    return list.length > 0 ? list[0] : null;
  }, [state.bodyMeasurements]);

  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState<number>(() => latest?.weightKg || state.nutritionProfile?.weightKg || 70);
  const [waistCm, setWaistCm] = useState<number>(() => latest?.waistCm || 80);
  const [neckCm, setNeckCm] = useState<number>(() => latest?.neckCm || 38);
  const [hipsCm, setHipsCm] = useState<number>(() => latest?.hipsCm || 95);
  const [chestCm, setChestCm] = useState<number>(() => latest?.chestCm || 98);
  const [bicepLeftCm, setBicepLeftCm] = useState<number>(() => latest?.bicepLeftCm || 35);
  const [bicepRightCm, setBicepRightCm] = useState<number>(() => latest?.bicepRightCm || 35.5);
  const [thighLeftCm, setThighLeftCm] = useState<number>(() => latest?.thighLeftCm || 56);
  const [thighRightCm, setThighRightCm] = useState<number>(() => latest?.thighRightCm || 56);
  const [calvesCm, setCalvesCm] = useState<number>(() => latest?.calvesCm || 37);
  const [shouldersCm, setShouldersCm] = useState<number>(() => latest?.shouldersCm || 115);
  const [notes, setNotes] = useState('');

  const heightCm = state.nutritionProfile?.heightCm || 175;
  const sex = state.nutritionProfile?.sex || 'male';

  // Real-time U.S. Navy Body Composition calculation
  const navyResult = useMemo(() => {
    const res = calculateNavyBodyComposition({
      sex,
      heightCm,
      weightKg,
      waistCm,
      neckCm,
      hipsCm: sex === 'female' ? hipsCm : undefined,
    });
    return res.success ? res.data : null;
  }, [sex, heightCm, weightKg, waistCm, neckCm, hipsCm]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Log measurement
    logBodyMeasurement({
      date: dateStr,
      weightKg,
      waistCm,
      neckCm,
      hipsCm,
      chestCm,
      bicepLeftCm,
      bicepRightCm,
      thighLeftCm,
      thighRightCm,
      calvesCm,
      shouldersCm,
      notes: notes.trim() || undefined,
    });

    // 2. Log calculated body composition
    if (navyResult) {
      logBodyComposition({
        date: dateStr,
        method: 'navy_circumference',
        bodyFatPercentage: navyResult.bodyFatPercentage,
        leanMassKg: navyResult.leanMassKg,
        fatMassKg: navyResult.fatMassKg,
        waistToHeightRatio: navyResult.waistToHeightRatio,
        isEstimated: true,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-espresso-950 dark:text-ivory-50">
                10-Site Body Circumference &amp; Navy Body Fat
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Anthropometric tracking with automated U.S. Navy body composition formulas
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

        {/* Real-time Navy Preview Banner */}
        {navyResult && (
          <div className="p-4 bg-ivory-50 dark:bg-espresso-850 border-b border-ivory-200 dark:border-espresso-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-espresso-400">Navy Body Fat</span>
              <p className="font-mono text-base font-bold text-terracotta-600 dark:text-terracotta-400">
                {navyResult.bodyFatPercentage}%
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-espresso-400">Lean Mass</span>
              <p className="font-mono text-base font-bold text-espresso-900 dark:text-ivory-100">
                {navyResult.leanMassKg} kg
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-espresso-400">Fat Mass</span>
              <p className="font-mono text-base font-bold text-espresso-900 dark:text-ivory-100">
                {navyResult.fatMassKg} kg
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-espresso-400">WHtR Risk</span>
              <p className="font-mono text-xs font-semibold capitalize text-sage-600 dark:text-sage-400">
                {navyResult.categoryLabel}
              </p>
            </div>
          </div>
        )}

        {/* Inputs Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Body Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Waist at Navel (cm)
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={waistCm}
                onChange={(e) => setWaistCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-ivory-200 dark:border-espresso-800">
            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Neck (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={neckCm}
                onChange={(e) => setNeckCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Hips (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={hipsCm}
                onChange={(e) => setHipsCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Chest (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={chestCm}
                onChange={(e) => setChestCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Left Bicep (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={bicepLeftCm}
                onChange={(e) => setBicepLeftCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Right Bicep (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={bicepRightCm}
                onChange={(e) => setBicepRightCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Shoulders (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={shouldersCm}
                onChange={(e) => setShouldersCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Left Thigh (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={thighLeftCm}
                onChange={(e) => setThighLeftCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Right Thigh (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={thighRightCm}
                onChange={(e) => setThighRightCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                Calves (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={calvesCm}
                onChange={(e) => setCalvesCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
              Measurement Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Measured fasted in the morning"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200 dark:border-espresso-800">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" icon={<Check className="w-4 h-4" />}>
              Save Measurements
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
