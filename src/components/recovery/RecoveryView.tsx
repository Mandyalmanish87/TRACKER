import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CardioType,
  MuscleGroup,
} from '../../types';
import {
  calculateSleepDurationMinutes,
  calculateDailyReadiness,
} from '../../utils/readinessEngine';
import { calculateCardioCalories } from '../../utils/cardioCalculators';
import {
  Flame,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { Button } from '../common/Button';

export const RecoveryView: React.FC = () => {
  const {
    state,
    logSleepRecovery,
    logCardioSession,
    deleteCardioSession,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'sleep_readiness' | 'cardio'>('sleep_readiness');

  // Sleep logger state
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(4);
  const stressLevel = 2;
  const rhr = '';
  const hrv = '';
  const [sorenessMap, setSorenessMap] = useState<Partial<Record<MuscleGroup, 0 | 1 | 2 | 3>>>({});
  const [isSleepLoggedToday, setIsSleepLoggedToday] = useState(false);

  // Cardio logger state
  const [isAddingCardio, setIsAddingCardio] = useState(false);
  const [cardioType, setCardioType] = useState<CardioType>('running');
  const [cardioDuration, setCardioDuration] = useState<number>(30);
  const [cardioDistance, setCardioDistance] = useState<number>(5.0);
  const [cardioAvgHr, setCardioAvgHr] = useState<number | ''>('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculated sleep duration with cross-midnight handling
  const liveSleepMinutes = useMemo(() => {
    return calculateSleepDurationMinutes(bedTime, wakeTime);
  }, [bedTime, wakeTime]);

  // Calculated readiness
  const liveReadiness = useMemo(() => {
    return calculateDailyReadiness({
      date: todayStr,
      bedTime,
      wakeTime,
      sleepDurationMinutes: liveSleepMinutes,
      sleepQualityRating: sleepQuality,
      energyLevel,
      stressLevel,
      restingHeartRateBpm: rhr ? Number(rhr) : undefined,
      hrvMs: hrv ? Number(hrv) : undefined,
      muscleSorenessMap: sorenessMap,
      estimatedReadinessScore: 0,
      id: '',
      createdAt: '',
    });
  }, [bedTime, wakeTime, liveSleepMinutes, sleepQuality, energyLevel, stressLevel, rhr, hrv, sorenessMap, todayStr]);

  const handleSaveSleep = (e: React.FormEvent) => {
    e.preventDefault();
    logSleepRecovery({
      date: todayStr,
      bedTime,
      wakeTime,
      sleepDurationMinutes: liveSleepMinutes,
      sleepQualityRating: sleepQuality,
      energyLevel,
      stressLevel,
      restingHeartRateBpm: rhr ? Number(rhr) : undefined,
      hrvMs: hrv ? Number(hrv) : undefined,
      muscleSorenessMap: sorenessMap,
      estimatedReadinessScore: liveReadiness.readinessScore,
    });
    setIsSleepLoggedToday(true);
    setTimeout(() => setIsSleepLoggedToday(false), 3000);
  };

  const handleSaveCardio = (e: React.FormEvent) => {
    e.preventDefault();
    const userWeightKg = state.nutritionProfile?.weightKg || 70;
    const caloriesResult = calculateCardioCalories({
      cardioType,
      durationMinutes: cardioDuration,
      weightKg: userWeightKg,
      distanceKm: cardioDistance || undefined,
      averageHeartRateBpm: cardioAvgHr ? Number(cardioAvgHr) : undefined,
    });

    logCardioSession({
      date: todayStr,
      cardioType,
      durationMinutes: cardioDuration,
      distanceKm: cardioDistance || undefined,
      averageHeartRateBpm: cardioAvgHr ? Number(cardioAvgHr) : undefined,
      estimatedCaloriesBurned: caloriesResult.caloriesBurned,
      calorieCalculationSource: caloriesResult.calculationSource,
    });

    setIsAddingCardio(false);
  };

  const muscleList: { id: MuscleGroup; label: string }[] = [
    { id: 'chest', label: 'Chest' },
    { id: 'upper_back', label: 'Upper Back' },
    { id: 'lats', label: 'Lats' },
    { id: 'quads', label: 'Quads' },
    { id: 'hamstrings', label: 'Hamstrings' },
    { id: 'glutes', label: 'Glutes' },
    { id: 'front_delts', label: 'Shoulders' },
    { id: 'biceps', label: 'Biceps' },
    { id: 'triceps', label: 'Triceps' },
    { id: 'calves', label: 'Calves' },
    { id: 'abs', label: 'Abs' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-ivory-200 dark:border-espresso-750 pb-2">
        <button
          onClick={() => setActiveSubTab('sleep_readiness')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'sleep_readiness'
              ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-sm'
              : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950'
          }`}
        >
          Daily Readiness &amp; Sleep
        </button>
        <button
          onClick={() => setActiveSubTab('cardio')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'cardio'
              ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-sm'
              : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950'
          }`}
        >
          Cardio &amp; Zone 2 Activity
        </button>
      </div>

      {activeSubTab === 'sleep_readiness' && (
        <div className="space-y-6">
          {/* Readiness Score Banner */}
          <div className="p-6 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-mono text-2xl font-bold ${
                  liveReadiness.tier === 'optimal'
                    ? 'bg-sage-100 dark:bg-sage-900/40 text-sage-600 dark:text-sage-400'
                    : liveReadiness.tier === 'moderate'
                    ? 'bg-ochre-100 dark:bg-ochre-900/40 text-ochre-600 dark:text-ochre-400'
                    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                }`}
              >
                {liveReadiness.readinessScore}
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-terracotta-600 dark:text-terracotta-400">
                  Daily Readiness Index (0-100)
                </span>
                <h3 className="font-bold text-lg text-espresso-950 dark:text-ivory-50">
                  {liveReadiness.headline}
                </h3>
                <p className="text-xs text-espresso-600 dark:text-espresso-300 mt-0.5 max-w-xl">
                  {liveReadiness.recommendation}
                </p>
              </div>
            </div>

            <div className="text-right sm:border-l border-ivory-200 dark:border-espresso-750 sm:pl-5 text-xs font-mono text-espresso-500">
              <p>Computed Sleep:</p>
              <p className="font-bold text-sm text-espresso-900 dark:text-ivory-100">
                {(liveSleepMinutes / 60).toFixed(1)} hrs ({liveSleepMinutes} mins)
              </p>
            </div>
          </div>

          {/* Morning Check-In Form */}
          <form
            onSubmit={handleSaveSleep}
            className="p-6 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-6"
          >
            <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-750 pb-3">
              <div>
                <h4 className="font-bold text-sm text-espresso-950 dark:text-ivory-50">
                  Morning Sleep &amp; Recovery Check-In
                </h4>
                <p className="text-xs text-espresso-500 dark:text-espresso-400">
                  Log your sleep duration and autonomic recovery parameters for {todayStr}
                </p>
              </div>
              {isSleepLoggedToday && (
                <span className="text-xs font-semibold text-sage-600 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-4 h-4" /> Check-in saved!
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Bedtime
                </label>
                <input
                  type="time"
                  required
                  value={bedTime}
                  onChange={(e) => setBedTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Wake Time
                </label>
                <input
                  type="time"
                  required
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Sleep Quality (1-5)
                </label>
                <select
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(parseInt(e.target.value, 10) as any)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                >
                  <option value="1">1 - Restless / Interrupted</option>
                  <option value="2">2 - Light &amp; Suboptimal</option>
                  <option value="3">3 - Fair Baseline</option>
                  <option value="4">4 - Good Restorative</option>
                  <option value="5">5 - Deep &amp; Excellent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Energy Level (1-5)
                </label>
                <select
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(parseInt(e.target.value, 10) as any)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                >
                  <option value="1">1 - Lethargic</option>
                  <option value="2">2 - Sluggish</option>
                  <option value="3">3 - Normal</option>
                  <option value="4">4 - Energized</option>
                  <option value="5">5 - Peaking</option>
                </select>
              </div>
            </div>

            {/* DOMS Muscle Soreness Map */}
            <div className="space-y-3 pt-2 border-t border-ivory-200 dark:border-espresso-750">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-espresso-900 dark:text-ivory-100">
                    DOMS Muscle Soreness Map
                  </span>
                  <p className="text-[11px] text-espresso-400">
                    Click each muscle to toggle soreness: 0=None, 1=Mild, 2=Moderate, 3=Severe
                  </p>
                </div>
                {liveReadiness.sorenessAlert && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> {liveReadiness.sorenessAlert}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {muscleList.map((m) => {
                  const level = sorenessMap[m.id] || 0;
                  const colors = [
                    'bg-ivory-100 dark:bg-espresso-800 text-espresso-600 border-ivory-300 dark:border-espresso-700',
                    'bg-amber-100 dark:bg-amber-950/40 text-amber-800 border-amber-300',
                    'bg-orange-100 dark:bg-orange-950/40 text-orange-800 border-orange-400',
                    'bg-rose-100 dark:bg-rose-950/40 text-rose-800 border-rose-400 font-bold',
                  ];

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const nextLevel = ((level + 1) % 4) as 0 | 1 | 2 | 3;
                        setSorenessMap((prev) => ({ ...prev, [m.id]: nextLevel }));
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-1.5 ${colors[level]}`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-75 font-bold">[{level}]</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="md">
                Log Today's Recovery
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'cardio' && (
        <div className="space-y-6">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sage-100 dark:bg-sage-900/40 text-sage-600 dark:text-sage-400 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                  Cardio &amp; Aerobic Conditioning
                </h3>
                <p className="text-xs text-espresso-500 dark:text-espresso-400">
                  Zone 2 base building, running, swimming, cycling, and MET expenditure calculations
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddingCardio(!isAddingCardio)}
            >
              {isAddingCardio ? 'Cancel' : 'Log Cardio Session'}
            </Button>
          </div>

          {/* Cardio Creator Form */}
          {isAddingCardio && (
            <form
              onSubmit={handleSaveCardio}
              className="p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4 animate-in fade-in"
            >
              <h4 className="font-bold text-sm text-espresso-950 dark:text-ivory-50">
                New Cardio Workout
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={cardioType}
                    onChange={(e) => setCardioType(e.target.value as CardioType)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  >
                    <option value="running">Running (Outdoor)</option>
                    <option value="treadmill">Treadmill Running</option>
                    <option value="cycling">Cycling</option>
                    <option value="swimming">Swimming</option>
                    <option value="rowing">Rowing Machine</option>
                    <option value="walking">Incline Walking / Rucking</option>
                    <option value="hiit">HIIT Intervals</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cardioDuration}
                    onChange={(e) => setCardioDuration(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardioDistance}
                    onChange={(e) => setCardioDistance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Avg Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="220"
                    placeholder="e.g. 142"
                    value={cardioAvgHr}
                    onChange={(e) => setCardioAvgHr(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingCardio(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Session
                </Button>
              </div>
            </form>
          )}

          {/* Logged Cardio Sessions */}
          <div className="space-y-3">
            {(state.cardioSessions || []).length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-ivory-200 dark:border-espresso-750 rounded-2xl bg-white dark:bg-espresso-850">
                <Activity className="w-8 h-8 mx-auto text-espresso-300" />
                <p className="font-semibold text-xs text-espresso-900 dark:text-ivory-50 mt-2">
                  No cardio workouts logged yet.
                </p>
                <p className="text-[11px] text-espresso-400 mt-0.5">
                  Log Zone 2 running or cycling to balance academic study posture.
                </p>
              </div>
            ) : (
              (state.cardioSessions || []).map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sage-100 dark:bg-sage-900/40 text-sage-600 dark:text-sage-400 flex items-center justify-center font-bold">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-espresso-950 dark:text-ivory-50 capitalize">
                          {session.cardioType}
                        </span>
                        <span className="text-[11px] font-mono text-espresso-400">
                          {session.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-espresso-500 mt-0.5">
                        <span>{session.durationMinutes} mins</span>
                        {session.distanceKm && <span>• {session.distanceKm} km</span>}
                        {session.estimatedCaloriesBurned && (
                          <span className="text-terracotta-600 dark:text-terracotta-400 font-semibold">
                            • ~{session.estimatedCaloriesBurned} kcal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteCardioSession(session.id)}
                    className="p-1 rounded text-espresso-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
