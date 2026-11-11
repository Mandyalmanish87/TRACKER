import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GymSplitWidget } from '../dashboard/GymSplitWidget';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { MuscleHeatmap } from '../gym/MuscleHeatmap';
import { ExerciseLibraryModal } from '../gym/ExerciseLibraryModal';
import { ProgramManagerModal } from '../gym/ProgramManagerModal';
import { BodyCircumferenceModal } from '../body/BodyCircumferenceModal';
import { RecoveryView } from '../recovery/RecoveryView';
import { ProgressiveOverloadDashboard } from '../gym/ProgressiveOverloadDashboard';
import { PersonalRecordsView } from '../gym/PersonalRecordsView';
import { MuscleVolumeAnalytics } from '../recovery/MuscleVolumeAnalytics';
import { RecentPRsWidget } from '../dashboard/fitness/RecentPRsWidget';
import { AcademicSynergyCard } from '../dashboard/fitness/AcademicSynergyCard';
import { ProFeatureGate } from '../common/ProFeatureGate';
import {
  Dumbbell,
  Calendar,
  BookOpen,
  Flame,
  Trophy,
  Activity,
  Play,
  Ruler,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export const GymView: React.FC = () => {
  const { state, startWorkout, activeWorkout, setWorkoutModalMinimized } = useApp();

  const [activeTab, setActiveTab] = useState<
    'sessions' | 'heatmap' | 'overload' | 'volume' | 'prs' | 'programs' | 'body_recovery'
  >('sessions');

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isBodyModalOpen, setIsBodyModalOpen] = useState(false);

  // 1RM Calculator Scratch State
  const [calcWeight, setCalcWeight] = useState<number>(80);
  const [calcReps, setCalcReps] = useState<number>(8);

  const brzycki1RM = Math.round(calcWeight * (36 / Math.max(1, 37 - calcReps)));
  const epley1RM = Math.round(calcWeight * (1 + calcReps / 30));

  return (
    <div className="gym-page flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="my-space-header flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Iron Lab · Physical Conditioning &amp; Resistance
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
            Resistance Training &amp; Strength Engine
          </h1>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Interactive 3D muscle anatomy, progressive overload, recovery intelligence, and strength PRs.
          </p>
        </div>

        <div className="my-space-header-actions flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setIsLibraryOpen(true)}
          >
            Exercise Library (150+)
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={<Play className="w-4 h-4" />}
            onClick={() => {
              if (activeWorkout) {
                setWorkoutModalMinimized(false);
              } else {
                startWorkout();
              }
            }}
          >
            {activeWorkout ? 'Resume Workout' : 'Start Workout'}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="my-space-section-tabs flex items-center gap-1.5 overflow-x-auto border-b border-ivory-200 dark:border-espresso-750 pb-2 text-xs font-semibold">
        {[
          { id: 'sessions', label: 'Workout Execution', icon: <Dumbbell className="w-3.5 h-3.5" /> },
          { id: 'heatmap', label: '3D Muscle Anatomy', icon: <Flame className="w-3.5 h-3.5" /> },
          { id: 'overload', label: 'Progressive Overload', icon: <TrendingUp className="w-3.5 h-3.5" /> },
          { id: 'volume', label: 'Volume Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'prs', label: 'Personal Records', icon: <Trophy className="w-3.5 h-3.5" /> },
          { id: 'programs', label: 'Programs & Splits', icon: <Calendar className="w-3.5 h-3.5" /> },
          { id: 'body_recovery', label: 'Body OS & Recovery', icon: <Activity className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            aria-pressed={activeTab === tab.id}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-espresso-900 text-white dark:bg-ivory-100 dark:text-espresso-950 shadow-sm'
                : 'text-espresso-600 dark:text-espresso-400 hover:text-espresso-950 dark:hover:text-ivory-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Workout Execution */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <AcademicSynergyCard />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] gap-6 items-start">
            <div className="min-w-0 space-y-6">
              <GymSplitWidget />

              {/* Workout History */}
              <Card
                eyebrow="History Log"
                title="Completed Training Sessions"
                subtitle="Chronological record of completed workouts and volume load"
              >
                <div className="space-y-3">
                  {(state.workoutSessions || []).filter((s) => s.completed).length === 0 ? (
                    <div className="p-8 text-center text-xs text-espresso-400">
                      No completed workouts recorded yet. Finish your first workout to view history.
                    </div>
                  ) : (
                    (state.workoutSessions || [])
                      .filter((s) => s.completed)
                      .slice(0, 6)
                      .map((session) => (
                        <div
                          key={session.id}
                          className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-espresso-950 dark:text-ivory-50">
                                {session.splitName}
                              </span>
                              <span className="font-mono text-[11px] text-espresso-400">
                                {session.date}
                              </span>
                            </div>
                            <p className="text-[11px] text-espresso-500 font-mono mt-0.5">
                              {session.exercises.length} exercises • {session.durationMinutes || 45} mins
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300">
                            Completed
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              <RecentPRsWidget />

              <Card
                eyebrow="Program Protocol"
                title="Quick Program Launcher"
                subtitle="Choose a routine to initiate today's training"
              >
                <div className="space-y-3">
                  <p className="text-xs text-espresso-600 dark:text-espresso-300">
                    Switch split schedules or launch pre-configured Push/Pull/Legs or Upper/Lower routines.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    icon={<Calendar className="w-4 h-4" />}
                    onClick={() => setIsProgramModalOpen(true)}
                  >
                    Manage Multi-Split Programs
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive 3D Muscle Anatomy & Heatmap */}
      {activeTab === 'heatmap' && (
        <ProFeatureGate featureKey="3d_muscle_heatmaps">
          <div className="space-y-6">
            <MuscleHeatmap
              sessions={state.workoutSessions || []}
              bodyModelPreference={state.settings?.bodyModelPreference || 'male'}
              onSelectExercise={() => setIsLibraryOpen(true)}
            />
          </div>
        </ProFeatureGate>
      )}

      {/* TAB 3: Progressive Overload Engine */}
      {activeTab === 'overload' && (
        <div className="space-y-6">
          <ProgressiveOverloadDashboard sessions={state.workoutSessions || []} />
        </div>
      )}

      {/* TAB 4: Muscle Volume Analytics & Kinetic Symmetry */}
      {activeTab === 'volume' && (
        <ProFeatureGate featureKey="advanced_recovery_readiness">
          <div className="space-y-6">
            <MuscleVolumeAnalytics sessions={state.workoutSessions || []} />
          </div>
        </ProFeatureGate>
      )}

      {/* TAB 5: Personal Records & 1RM Calculator */}
      {activeTab === 'prs' && (
        <div className="space-y-6">
          <PersonalRecordsView sessions={state.workoutSessions || []} />

          {/* 1RM Scientific Calculator */}
          <Card
            eyebrow="Biomechanical Calculator"
            title="Estimated 1 Rep Max (1RM)"
            subtitle="Brzycki (1-12 reps) & Epley (>12 reps) strength estimation"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Lifted Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                    Reps to Failure
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={calcReps}
                    onChange={(e) => setCalcReps(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-mono border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                </div>
              </div>

              {/* 1RM Results */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700">
                  <span className="text-[10px] uppercase text-espresso-400">Brzycki 1RM</span>
                  <p className="text-xl font-bold text-terracotta-600 dark:text-terracotta-400 mt-1">
                    {brzycki1RM} kg
                  </p>
                  <p className="text-[10px] text-espresso-400 mt-0.5">High confidence (≤12 reps)</p>
                </div>

                <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-700">
                  <span className="text-[10px] uppercase text-espresso-400">Epley 1RM</span>
                  <p className="text-xl font-bold text-ochre-600 dark:text-ochre-400 mt-1">
                    {epley1RM} kg
                  </p>
                  <p className="text-[10px] text-espresso-400 mt-0.5">Hypertrophy rep range</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: Programs & Splits */}
      {activeTab === 'programs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <div>
              <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                Resistance Programs &amp; Weekly Schedules
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Select from verified PPL, Upper/Lower, or Full Body periodization routines.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Calendar className="w-4 h-4" />}
              onClick={() => setIsProgramModalOpen(true)}
            >
              Open Program Manager
            </Button>
          </div>

          <Card
            eyebrow="Default Hypertrophy Protocol"
            title="Weekly Muscle Group Protocol"
            subtitle="Push / Pull / Legs Hypertrophy Split"
          >
            <div className="space-y-2.5 text-xs">
              {[
                { day: 'Monday', split: 'Push Day (Chest, Shoulders, Triceps)', focus: 'Bench, OHP, Dips' },
                { day: 'Tuesday', split: 'Pull Day (Back, Rear Delts, Biceps)', focus: 'Barbell Rows, Pullups' },
                { day: 'Wednesday', split: 'Legs & Core (Quad dominant)', focus: 'Squats, Romanian Deadlifts' },
                { day: 'Thursday', split: 'Active Recovery & Zone 2 Cardio', focus: 'Mobility, Incline Walk' },
                { day: 'Friday', split: 'Upper Hypertrophy', focus: 'Incline Dumbbell, Lat Pulldowns' },
                { day: 'Saturday', split: 'Lower Hypertrophy & Hamstrings', focus: 'Leg Press, Ham Curls' },
                { day: 'Sunday', split: 'Rest & Nutrition Prep', focus: 'Hydration, Sleep' },
              ].map((item) => (
                <div
                  key={item.day}
                  className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-center justify-between shadow-subtle"
                >
                  <div>
                    <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                      {item.day}:
                    </span>{' '}
                    <span className="text-espresso-700 dark:text-ivory-200">{item.split}</span>
                    <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-0.5">{item.focus}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: Body OS & Recovery */}
      {activeTab === 'body_recovery' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
            <div>
              <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                Body Tracking &amp; Recovery Hub
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                10-site circumferences, U.S. Navy body composition, and sleep readiness
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Ruler className="w-4 h-4" />}
              onClick={() => setIsBodyModalOpen(true)}
            >
              Log 10-Site Circumference
            </Button>
          </div>

          <RecoveryView />
        </div>
      )}

      {/* Modals */}
      <ExerciseLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
      />

      <ProgramManagerModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
      />

      <BodyCircumferenceModal
        isOpen={isBodyModalOpen}
        onClose={() => setIsBodyModalOpen(false)}
      />
    </div>
  );
};
