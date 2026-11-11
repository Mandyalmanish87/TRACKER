# Fitness Milestone 3: Complete Workout System, PRs, Progressive Overload & Exercise Library

## 1. Scope
Expand the Gym execution environment into a professional workout tracking and progressive overload engine:
- Full workout creation, templates, and splits (PPL, Upper/Lower, Arnold, Full Body, Bro Split, Custom).
- Multi-set logging supporting Weight, Reps, RPE (6.0 - 10.0), RIR (0 - 5), Rest Duration, Set Types (warmup, working, drop, rest-pause, failure), and Unilateral Left/Right tracking.
- Exercise Library with 150+ built-in movements, custom exercise creator with custom muscle contribution mappings, and search/filter by equipment and muscle.
- Progressive Overload analytics with estimated 1RM calculations (Epley formula: Weight × (1 + Reps / 30) and Brzycki formula) and intelligent loading recommendations.
- Comprehensive Personal Records (PR) engine tracking heaviest weight, highest reps, highest 1RM, and total volume.
- Live active workout session controls: rest timers with audio/vibration cues, superset grouping, exercise substitution, and resilient local storage recovery on page refresh.

## 2. Existing Files Inspected
- `src/components/gym/ActiveWorkoutModal.tsx`: Live workout logger modal.
- `src/components/gym/ExerciseLibraryModal.tsx`: Exercise search and filter interface.
- `src/components/gym/ProgramManagerModal.tsx`: Split and program configuration.
- `src/utils/progressiveOverload.ts`: 1RM and volume calculation utilities.
- `src/data/exerciseLibrary.json`: Master exercise dataset.

## 3. Files to Create
- `src/components/gym/ProgressiveOverloadDashboard.tsx`: Interactive strength progression charts, best performance tables, and overload suggestions.
- `src/components/gym/PersonalRecordsView.tsx`: Comprehensive PR history, trophy badges, and recent records filterable by movement pattern.
- `src/utils/progressiveOverloadEngine.ts`: Overload progression algorithm, PR detection, and intelligent weight suggestions.
- `docs/FITNESS_MILESTONE_3.md`: This milestone specification.

## 4. Files to Modify
- `src/components/gym/ActiveWorkoutModal.tsx`: Add unilateral side toggles, rest-pause set types, and RIR tracking.
- `src/components/gym/ExerciseLibraryModal.tsx`: Support custom exercise creation with custom primary/secondary muscle contribution sliders.
- `src/components/views/GymView.tsx`: Integrate Progressive Overload and PR tabs.

## 5. Implementation Details
### Progressive Overload Engine
- Epley 1RM formula for weighted exercises: `1RM = Weight × (1 + Reps / 30)`.
- Bodyweight exercises handle added load or total reps without forcing artificial weight input.
- Intelligent Recommendation Logic:
  - If user completed all working sets at or above the top of the recommended rep range with RPE < 9: "You completed 3x10 at 40kg with RPE 8. Consider progressing to 42.5kg next session."
- PR Detection: Evaluates completed working sets against historical records per exercise for max weight, estimated 1RM, and max session tonnage.

## 6. Dependencies
- Native React, Lucide icons, and existing storage service.

## 7. Acceptance Criteria
- [x] Set logging supports RPE, RIR, warmup, working, drop, rest-pause, failure, and left/right tags.
- [x] Exercise library supports searching, filtering, and custom exercise creation with muscle mappings.
- [x] 1RM calculations display clearly with explicit disclaimer that values are estimates.
- [x] Personal records automatically calculate and update upon completing workouts.
- [x] Active workout state recovers seamlessly after browser refresh.

## 8. Tests
- Tests in `tests/fitnessEcosystemFullRegression.test.tsx` verifying set logging, 1RM calculations, PR detection, and recommendation derivations.

## 9. Completion Checklist
- [x] Active workout set logging enhanced.
- [x] Progressive overload dashboard implemented.
- [x] PR system verified.
- [x] Exercise library custom editor connected.

