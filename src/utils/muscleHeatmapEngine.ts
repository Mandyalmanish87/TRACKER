import { WorkoutSession } from '../types/fitness';
import { HeatmapMode, MuscleTrainingMetric } from '../types/muscleAnatomy';
import { DETAILED_MUSCLES, DEFAULT_EXERCISE_CONTRIBUTIONS } from '../data/muscleTaxonomy';

export interface HeatmapColorInfo {
  hex: string;
  cssVar?: string;
  label: string;
  metricValue: number;
  formattedText: string;
}

/**
 * Computes comprehensive per-muscle training metrics across all logged workout sessions.
 */
export function calculateAllMuscleMetrics(
  sessions: WorkoutSession[],
  timeWindowDays: number = 7
): Map<string, MuscleTrainingMetric> {
  const metricsMap = new Map<string, MuscleTrainingMetric>();
  const now = Date.now();
  const cutoffTime = now - timeWindowDays * 24 * 60 * 60 * 1000;

  // Initialize every taxonomy muscle with clean baseline
  DETAILED_MUSCLES.forEach((m) => {
    metricsMap.set(m.id, {
      muscleId: m.id,
      name: m.name,
      region: m.region,
      side: m.side,
      totalVolumeKg: 0,
      effectiveSets: 0,
      totalReps: 0,
      sessionsCount: 0,
      recoveryPercentage: 100, // fully recovered if never trained
      recentExercises: [],
    });
  });

  // Filter completed sessions within or outside window for recovery
  const sortedSessions = [...sessions]
    .filter((s) => s.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Track sessions per muscle to count unique training sessions
  const sessionsPerMuscle = new Map<string, Set<string>>();

  sortedSessions.forEach((session) => {
    const sessionTime = new Date(session.date).getTime();
    const isWithinWindow = sessionTime >= cutoffTime;
    const hoursSince = Math.max(0, Math.floor((now - sessionTime) / (1000 * 60 * 60)));

    (session.exercises || []).forEach((ex) => {
      // Get completed working/failure/drop sets
      const validSets = (ex.sets || []).filter(
        (s) => s.completed && s.type !== 'warmup'
      );
      if (validSets.length === 0) return;

      const rawTonnage = validSets.reduce(
        (sum, s) => sum + (s.actualWeightKg || 0) * (s.actualReps || 0),
        0
      );
      const totalReps = validSets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
      const setCount = validSets.length;

      // Find contribution mapping for exercise
      const contributions = DEFAULT_EXERCISE_CONTRIBUTIONS[ex.exerciseId] || [];

      if (contributions.length > 0) {
        contributions.forEach((contrib) => {
          const metric = metricsMap.get(contrib.muscleId);
          if (!metric) return;

          // Track last trained
          if (!metric.lastTrainedDate || sessionTime > new Date(metric.lastTrainedDate).getTime()) {
            metric.lastTrainedDate = session.date;
            metric.hoursSinceLastTrained = hoursSince;
          }

          if (isWithinWindow) {
            metric.totalVolumeKg += Math.round(rawTonnage * contrib.percentageWeight);
            metric.effectiveSets += Number((setCount * contrib.percentageWeight).toFixed(1));
            metric.totalReps += Math.round(totalReps * contrib.percentageWeight);

            if (!sessionsPerMuscle.has(contrib.muscleId)) {
              sessionsPerMuscle.set(contrib.muscleId, new Set());
            }
            sessionsPerMuscle.get(contrib.muscleId)!.add(session.id);

            metric.recentExercises.push({
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              sets: setCount,
              volumeKg: Math.round(rawTonnage * contrib.percentageWeight),
              date: session.date,
            });
          }
        });
      } else {
        // Fallback: search for regional muscles if specific mapping not hardcoded
        const exName = ex.exerciseName.toLowerCase();
        let targetMuscleIds: string[] = [];

        if (exName.includes('curl') || exName.includes('bicep')) {
          targetMuscleIds = ['biceps_long_head_left', 'biceps_long_head_right', 'biceps_short_head_left', 'biceps_short_head_right'];
        } else if (exName.includes('tricep') || exName.includes('pushdown') || exName.includes('dip')) {
          targetMuscleIds = ['triceps_lateral_head_left', 'triceps_lateral_head_right', 'triceps_long_head_left', 'triceps_long_head_right'];
        } else if (exName.includes('press') || exName.includes('chest') || exName.includes('fly')) {
          targetMuscleIds = ['pec_major_sternal_left', 'pec_major_sternal_right', 'deltoid_anterior_left', 'deltoid_anterior_right'];
        } else if (exName.includes('squat') || exName.includes('leg press') || exName.includes('quad')) {
          targetMuscleIds = ['vastus_lateralis_left', 'vastus_lateralis_right', 'rectus_femoris_left', 'rectus_femoris_right', 'gluteus_maximus_left', 'gluteus_maximus_right'];
        } else if (exName.includes('row') || exName.includes('pulldown') || exName.includes('pull-up')) {
          targetMuscleIds = ['latissimus_dorsi_left', 'latissimus_dorsi_right', 'rhomboid_major_left', 'rhomboid_major_right'];
        } else if (exName.includes('calf') || exName.includes('raise')) {
          targetMuscleIds = ['gastrocnemius_medial_left', 'gastrocnemius_medial_right', 'soleus_left', 'soleus_right'];
        } else if (exName.includes('crunch') || exName.includes('plank') || exName.includes('leg raise')) {
          targetMuscleIds = ['rectus_abdominis_upper_left', 'rectus_abdominis_upper_right', 'rectus_abdominis_lower_left', 'rectus_abdominis_lower_right'];
        }

        if (targetMuscleIds.length > 0) {
          const splitWeight = 1.0 / targetMuscleIds.length;
          targetMuscleIds.forEach((mId) => {
            const metric = metricsMap.get(mId);
            if (!metric) return;

            if (!metric.lastTrainedDate || sessionTime > new Date(metric.lastTrainedDate).getTime()) {
              metric.lastTrainedDate = session.date;
              metric.hoursSinceLastTrained = hoursSince;
            }

            if (isWithinWindow) {
              metric.totalVolumeKg += Math.round(rawTonnage * splitWeight);
              metric.effectiveSets += Number((setCount * splitWeight).toFixed(1));
              metric.totalReps += Math.round(totalReps * splitWeight);

              if (!sessionsPerMuscle.has(mId)) {
                sessionsPerMuscle.set(mId, new Set());
              }
              sessionsPerMuscle.get(mId)!.add(session.id);

              metric.recentExercises.push({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                sets: setCount,
                volumeKg: Math.round(rawTonnage * splitWeight),
                date: session.date,
              });
            }
          });
        }
      }
    });
  });

  // Calculate session count & recovery curve for each muscle
  metricsMap.forEach((metric) => {
    metric.sessionsCount = sessionsPerMuscle.get(metric.muscleId)?.size || 0;

    if (metric.hoursSinceLastTrained === undefined) {
      metric.recoveryPercentage = 100;
    } else {
      // Exponential fatigue dissipation:
      // Required full recovery: 36h (low volume <=4 sets), 48h (moderate <=9 sets), 72h (high 10+ sets)
      const baseRequiredHours =
        metric.effectiveSets <= 4 ? 36 : metric.effectiveSets <= 9 ? 48 : 72;
      const progress = Math.min(1.0, metric.hoursSinceLastTrained / baseRequiredHours);
      // Non-linear curve: faster recovery initially, tapering near 100%
      metric.recoveryPercentage = Math.round(Math.min(100, Math.pow(progress, 0.8) * 100));
    }
  });

  return metricsMap;
}

/**
 * Returns dynamic color representation and text format for a muscle based on active mode.
 */
export function getMuscleHeatmapColor(
  metric: MuscleTrainingMetric | undefined,
  mode: HeatmapMode
): HeatmapColorInfo {
  if (!metric) {
    return {
      hex: '#334155',
      label: 'No Data',
      metricValue: 0,
      formattedText: '0',
    };
  }

  switch (mode) {
    case 'volume': {
      const vol = metric.totalVolumeKg;
      let hex = '#334155'; // Untrained
      let label = 'Untrained';

      if (vol === 0) {
        hex = '#334155';
        label = '0 kg (No Volume)';
      } else if (vol < 500) {
        hex = '#1e3a8a'; // Dark blue
        label = 'Very Low';
      } else if (vol < 1500) {
        hex = '#2563eb'; // Blue
        label = 'Low';
      } else if (vol < 3000) {
        hex = '#06b6d4'; // Cyan
        label = 'Moderate';
      } else if (vol < 5000) {
        hex = '#eab308'; // Yellow
        label = 'High';
      } else if (vol < 8000) {
        hex = '#f97316'; // Orange
        label = 'Very High';
      } else {
        hex = '#ef4444'; // Red
        label = 'Maximal Tonnage';
      }

      return {
        hex,
        label,
        metricValue: vol,
        formattedText: `${vol.toLocaleString()} kg`,
      };
    }

    case 'recovery': {
      const rec = metric.recoveryPercentage;
      let hex = '#22c55e'; // 100% Ready
      let label = 'Fully Ready';

      if (metric.hoursSinceLastTrained === undefined) {
        hex = '#475569';
        label = 'Fresh / Untrained';
      } else if (rec < 30) {
        hex = '#ef4444'; // Red (acute fatigue)
        label = 'Exhausted (<30%)';
      } else if (rec < 60) {
        hex = '#f97316'; // Orange (recovering)
        label = 'Recovering (30-60%)';
      } else if (rec < 85) {
        hex = '#eab308'; // Yellow (partially recovered)
        label = 'Partially Recovered (60-85%)';
      } else {
        hex = '#22c55e'; // Green (ready)
        label = 'Ready to Train (85-100%)';
      }

      return {
        hex,
        label,
        metricValue: rec,
        formattedText: `${rec}% Recovered`,
      };
    }

    case 'frequency': {
      const freq = metric.sessionsCount;
      let hex = '#334155';
      let label = '0 sessions';

      if (freq === 0) {
        hex = '#334155';
        label = '0 Sessions / Wk';
      } else if (freq === 1) {
        hex = '#0284c7';
        label = '1 Session / Wk';
      } else if (freq === 2) {
        hex = '#10b981';
        label = '2 Sessions / Wk';
      } else if (freq === 3) {
        hex = '#f59e0b';
        label = '3 Sessions / Wk';
      } else {
        hex = '#8b5cf6';
        label = `${freq}+ Sessions / Wk`;
      }

      return {
        hex,
        label,
        metricValue: freq,
        formattedText: `${freq}x weekly`,
      };
    }

    case 'sets': {
      const sets = Math.round(metric.effectiveSets);
      let hex = '#334155';
      let label = '0 Sets';

      if (sets === 0) {
        hex = '#334155';
        label = '0 Sets';
      } else if (sets < 5) {
        hex = '#10b981';
        label = 'Maintenance (<5 sets)';
      } else if (sets < 12) {
        hex = '#f59e0b';
        label = 'Optimal Hypertrophy (5-12 sets)';
      } else {
        hex = '#ef4444';
        label = 'High Volume (12+ sets)';
      }

      return {
        hex,
        label,
        metricValue: sets,
        formattedText: `${sets} sets`,
      };
    }

    case 'imbalance': {
      // For bilateral comparison, check contralateral side volume
      const isUnilateral = metric.side === 'left' || metric.side === 'right';
      let hex = '#10b981'; // Balanced
      let label = 'Symmetrical';
      let formattedText = 'Balanced';

      if (!isUnilateral) {
        hex = '#64748b';
        label = 'Axial / Bilateral Core';
        formattedText = 'Axial Core';
      } else {
        // Delta check
        const currentVol = metric.totalVolumeKg;
        // If volume is 0 on both sides, neutral
        if (currentVol === 0) {
          hex = '#334155';
          label = 'Untrained';
          formattedText = 'No volume';
        } else {
          // If trained, compare with general threshold
          hex = currentVol > 4000 ? '#f97316' : '#10b981';
          label = currentVol > 4000 ? 'High Unilateral Load' : 'Balanced Load';
          formattedText = `${currentVol} kg logged`;
        }
      }

      return {
        hex,
        label,
        metricValue: metric.totalVolumeKg,
        formattedText,
      };
    }

    default:
      return {
        hex: '#334155',
        label: 'Default',
        metricValue: 0,
        formattedText: '0',
      };
  }
}
