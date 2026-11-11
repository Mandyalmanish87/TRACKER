import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ExerciseLibraryItem, MuscleGroup, EquipmentRequired } from '../../types';
import BUILTIN_EXERCISES from '../../data/exerciseLibrary.json';
import { Search, Plus, Filter, Star, Info, X, Dumbbell } from 'lucide-react';
import { Button } from '../common/Button';

interface ExerciseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise?: (exercise: ExerciseLibraryItem) => void;
}

export const ExerciseLibraryModal: React.FC<ExerciseLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
}) => {
  const { state, addCustomExercise, toggleExerciseFavorite } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  // Custom exercise form state
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrimaryMuscle, setCustomPrimaryMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<EquipmentRequired>('dumbbell');
  const [customCategory, setCustomCategory] = useState<'strength' | 'hypertrophy' | 'calisthenics' | 'cardio' | 'mobility'>('hypertrophy');
  const [customCues, setCustomCues] = useState('');

  // Combine built-in exercises with any user-created custom exercises
  const allExercises = useMemo(() => {
    const customList = state.exerciseLibrary || [];
    const builtinList = BUILTIN_EXERCISES as unknown as ExerciseLibraryItem[];
    // Builtin IDs take precedence, custom prepend
    const map = new Map<string, ExerciseLibraryItem>();
    builtinList.forEach((e) => map.set(e.id, e));
    customList.forEach((e) => map.set(e.id, e));
    return Array.from(map.values());
  }, [state.exerciseLibrary]);

  const filteredExercises = useMemo(() => {
    return allExercises.filter((ex) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = ex.name.toLowerCase().includes(q);
        const matchMuscle = ex.primaryMuscle.toLowerCase().includes(q);
        const matchEquip = ex.equipment.toLowerCase().includes(q);
        if (!matchName && !matchMuscle && !matchEquip) return false;
      }
      if (selectedMuscle !== 'all' && ex.primaryMuscle !== selectedMuscle) return false;
      if (selectedEquipment !== 'all' && ex.equipment !== selectedEquipment) return false;
      if (selectedCategory !== 'all' && ex.category !== selectedCategory) return false;
      return true;
    });
  }, [allExercises, searchQuery, selectedMuscle, selectedEquipment, selectedCategory]);

  if (!isOpen) return null;

  const handleSaveCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const cuesArray = customCues
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    addCustomExercise({
      name: customName.trim(),
      category: customCategory,
      primaryMuscle: customPrimaryMuscle,
      secondaryMuscles: [],
      equipment: customEquipment,
      difficulty: 'intermediate',
      instructions: ['Execute with controlled eccentric and explosive concentric.'],
      coachingCues: cuesArray.length > 0 ? cuesArray : ['Maintain full range of motion.'],
      commonMistakes: ['Rushing the negative phase.'],
      recommendedRepRange: { min: 8, max: 12 },
      defaultRestSeconds: 90,
      alternativeExerciseIds: [],
    });

    setCustomName('');
    setCustomCues('');
    setIsCreatingCustom(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 flex items-center justify-center text-terracotta-600 dark:text-terracotta-400">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Exercise Library
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                150+ offline resistance exercises with cues, biomechanics &amp; rep ranges
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsCreatingCustom(!isCreatingCustom)}
            >
              {isCreatingCustom ? 'Cancel' : 'New Exercise'}
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Exercise Creator Form */}
        {isCreatingCustom && (
          <form
            onSubmit={handleSaveCustomExercise}
            className="p-5 bg-ivory-50 dark:bg-espresso-850 border-b border-ivory-200 dark:border-espresso-800 space-y-4 animate-in fade-in"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Create Custom Movement
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Exercise Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nordic Hamstring Curl"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Primary Muscle Group
                </label>
                <select
                  value={customPrimaryMuscle}
                  onChange={(e) => setCustomPrimaryMuscle(e.target.value as MuscleGroup)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  <option value="chest">Chest</option>
                  <option value="upper_back">Upper Back</option>
                  <option value="lats">Lats</option>
                  <option value="quads">Quads</option>
                  <option value="hamstrings">Hamstrings</option>
                  <option value="glutes">Glutes</option>
                  <option value="front_delts">Front Delts</option>
                  <option value="side_delts">Side Delts</option>
                  <option value="rear_delts">Rear Delts</option>
                  <option value="biceps">Biceps</option>
                  <option value="triceps">Triceps</option>
                  <option value="calves">Calves</option>
                  <option value="abs">Abs & Core</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Equipment
                </label>
                <select
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value as EquipmentRequired)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  <option value="barbell">Barbell</option>
                  <option value="dumbbell">Dumbbell</option>
                  <option value="cable">Cable Machine</option>
                  <option value="machine">Selectorized Machine</option>
                  <option value="bodyweight">Bodyweight / Calisthenics</option>
                  <option value="kettlebell">Kettlebell</option>
                  <option value="resistance_band">Resistance Band</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-ivory-200 mb-1">
                  Training Focus
                </label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  <option value="hypertrophy">Hypertrophy (Muscle Building)</option>
                  <option value="strength">Strength (1-6 rep power)</option>
                  <option value="calisthenics">Calisthenics</option>
                  <option value="mobility">Mobility & Rehab</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreatingCustom(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save to Library
              </Button>
            </div>
          </form>
        )}

        {/* Search & Filters */}
        <div className="p-4 bg-ivory-50/70 dark:bg-espresso-850/60 border-b border-ivory-200 dark:border-espresso-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              placeholder="Search exercise name, equipment, or muscle group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-espresso-400 shrink-0 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>

            {/* Muscle Filter */}
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs font-mono text-espresso-800 dark:text-ivory-100"
            >
              <option value="all">All Muscles</option>
              <option value="chest">Chest</option>
              <option value="upper_back">Upper Back</option>
              <option value="lats">Lats</option>
              <option value="quads">Quads</option>
              <option value="hamstrings">Hamstrings</option>
              <option value="glutes">Glutes</option>
              <option value="front_delts">Front Delts</option>
              <option value="side_delts">Side Delts</option>
              <option value="rear_delts">Rear Delts</option>
              <option value="biceps">Biceps</option>
              <option value="triceps">Triceps</option>
              <option value="abs">Abs</option>
            </select>

            {/* Equipment Filter */}
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs font-mono text-espresso-800 dark:text-ivory-100"
            >
              <option value="all">All Equipment</option>
              <option value="barbell">Barbell</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="cable">Cable</option>
              <option value="machine">Machine</option>
              <option value="bodyweight">Bodyweight</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs font-mono text-espresso-800 dark:text-ivory-100"
            >
              <option value="all">All Categories</option>
              <option value="hypertrophy">Hypertrophy</option>
              <option value="strength">Strength</option>
              <option value="calisthenics">Calisthenics</option>
              <option value="mobility">Mobility</option>
            </select>

            <span className="text-[11px] text-espresso-400 font-mono ml-auto shrink-0">
              {filteredExercises.length} items
            </span>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredExercises.map((ex) => {
            const isExpanded = expandedExerciseId === ex.id;
            return (
              <div
                key={ex.id}
                className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-terracotta-300 dark:hover:border-terracotta-700/50 transition-all shadow-subtle space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-espresso-950 dark:text-ivory-50">
                        {ex.name}
                      </span>
                      {ex.isCustom && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-espresso-500 dark:text-espresso-400 font-mono mt-0.5">
                      <span className="capitalize">{ex.primaryMuscle.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className="capitalize">{ex.equipment}</span>
                      <span>•</span>
                      <span>{ex.recommendedRepRange.min}-{ex.recommendedRepRange.max} reps</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleExerciseFavorite(ex.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        ex.isFavorite
                          ? 'text-ochre-500 bg-ochre-50 dark:bg-ochre-950/40'
                          : 'text-espresso-400 hover:text-espresso-700'
                      }`}
                      title={ex.isFavorite ? 'Favorited' : 'Favorite'}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>

                    <button
                      onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                      className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
                      title="View Cues & Mistakes"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {onSelectExercise && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onSelectExercise(ex);
                          onClose();
                        }}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Details: Biomechanical cues, Common mistakes, instructions */}
                {isExpanded && (
                  <div className="pt-2.5 border-t border-ivory-200 dark:border-espresso-750 space-y-2 text-xs">
                    {ex.coachingCues && ex.coachingCues.length > 0 && (
                      <div>
                        <span className="font-semibold text-espresso-700 dark:text-ivory-200">
                          Coaching Cues:
                        </span>
                        <ul className="list-disc list-inside mt-0.5 text-espresso-600 dark:text-espresso-300 space-y-0.5">
                          {ex.coachingCues.map((cue, idx) => (
                            <li key={idx}>{cue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ex.commonMistakes && ex.commonMistakes.length > 0 && (
                      <div>
                        <span className="font-semibold text-terracotta-700 dark:text-terracotta-400">
                          Common Mistakes:
                        </span>
                        <ul className="list-disc list-inside mt-0.5 text-espresso-600 dark:text-espresso-300 space-y-0.5">
                          {ex.commonMistakes.map((mistake, idx) => (
                            <li key={idx}>{mistake}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
