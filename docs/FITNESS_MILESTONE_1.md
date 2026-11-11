# Fitness Milestone 1: Architecture, Data Foundation & Detailed Muscle Taxonomy

## 1. Scope
Establish the architectural and data foundation for the advanced Fitness Ecosystem within Student Tracker. This includes:
- An audit of the existing Gym and Nutrition implementations, types, storage service, and backward-compatibility adapters.
- Complete individual muscle taxonomy tracking over 45+ distinct muscles with anatomical left/right segregation.
- Exercise-to-muscle contribution mapping with percentage weights for compound and isolation movements.
- Safe schema extensions and migration strategies that strictly preserve all existing user data.
- Testing plan for data models, calculation engines, and persistence.

## 2. Existing Files Inspected
- `src/types/fitness.ts`: Core fitness types (WorkoutSession, ExerciseSet, MuscleGroup, FoodItem, etc.).
- `src/types/index.ts`: Unified application types and AppStateData interface.
- `src/services/storage.ts`: LocalStorageService with schema migration from v1 to v2.
- `src/services/defaults.ts`: Default seed values and state initialization.
- `src/utils/fitnessAdapters.ts`: Bidirectional adapters between legacy Gym types and modern Fitness types.
- `src/data/exerciseLibrary.json`: 150+ built-in exercises with equipment, instructions, and muscle tags.
- `src/data/foodCatalogue.ts`: Offline database of Indian and international foods.

## 3. Files to Create
- `src/types/muscleAnatomy.ts`: Anatomically precise muscle definitions, side tags (`left` | `right` | `bilateral`), functional groups, and biomechanical metadata.
- `src/data/muscleTaxonomy.ts`: Comprehensive muscle dictionary (Chest, Shoulders, Back, Arms, Core, Legs, Calves, Neck) with left/right keys and default exercise contribution models.
- `docs/FITNESS_MILESTONE_1.md`: This architecture specification.

## 4. Files to Modify
- `src/types/fitness.ts`: Integrate `DetailedMuscleId` and contribution interfaces into exercise and set types.
- `src/types/index.ts`: Re-export the muscle taxonomy and anatomy interfaces.
- `src/services/storage.ts`: Ensure new detailed muscle preferences and custom exercise mappings serialize cleanly without breaking existing stores.

## 5. Implementation Details
### Muscle Taxonomy Breakdown
- **Chest**: Pectoralis Major (Clavicular Head, Sternal Head), Pectoralis Minor (Left & Right).
- **Shoulders**: Anterior Deltoid, Lateral Deltoid, Posterior Deltoid, Rotator Cuff (Supraspinatus, Infraspinatus, Teres Minor, Subscapularis) (Left & Right).
- **Back**: Upper Trapezius, Middle Trapezius, Lower Trapezius, Latissimus Dorsi, Teres Major, Rhomboid Major, Rhomboid Minor, Erector Spinae, Multifidus, Quadratus Lumborum (Left & Right).
- **Arms**: Biceps Brachii (Long Head, Short Head), Brachialis, Brachioradialis, Triceps (Long Head, Lateral Head, Medial Head), Forearm Flexors, Forearm Extensors, Pronator Teres (Left & Right).
- **Core**: Rectus Abdominis (Upper, Lower), External Obliques, Internal Obliques, Transverse Abdominis, Serratus Anterior (Left & Right).
- **Legs**: Rectus Femoris, Vastus Lateralis, Vastus Medialis, Vastus Intermedius, Biceps Femoris (Long Head, Short Head), Semitendinosus, Semimembranosus, Gluteus Maximus, Gluteus Medius, Gluteus Minimus, Adductor Magnus, Adductor Longus, Adductor Brevis, Gracilis, Sartorius, Tensor Fasciae Latae (Left & Right).
- **Calves**: Gastrocnemius (Medial Head, Lateral Head), Soleus, Tibialis Anterior, Peroneal Muscles (Left & Right).
- **Neck**: Sternocleidomastoid, Splenius, Levator Scapulae (Left & Right).

### Biomechanical Volume Distribution
Compound movements distribute sets and tonnage based on empirical biomechanical contribution weights:
- *Barbell Bench Press*: 50% Pectoralis Major (Sternal & Clavicular), 30% Anterior Deltoid, 20% Triceps.
- *Barbell Squat*: 55% Quadriceps (Rectus Femoris, Vastus Lateralis/Medialis), 25% Gluteus Maximus, 10% Hamstrings, 10% Erector Spinae.
- *Deadlift*: 35% Erector Spinae/Glutes, 30% Hamstrings, 20% Lats/Traps, 15% Forearms/Core.

## 6. Dependencies
- Native TypeScript and existing `three` library (`^0.186.1`). No additional external packages required.

## 7. Acceptance Criteria
- [x] Every individual muscle listed in Section 4 of the Master Prompt is defined with unique IDs.
- [x] Left and right sides are tracked independently.
- [x] Exercise contribution weights scale working set volume proportionally.
- [x] All existing workouts and nutrition records persist unchanged.

## 8. Tests
- `tests/interactive3DAnatomyAndMuscleTaxonomy.test.tsx` verifying taxonomy coverage, bilateral vs unilateral volume calculation, and contribution scaling.

## 9. Completion Checklist
- [x] Taxonomy data structures defined.
- [x] Exercise mapping engine implemented.
- [x] Migration compatibility verified.

