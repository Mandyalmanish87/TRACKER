# Milestone 00: Audit, Baseline Consolidation & Architecture Foundation

**Document ID:** `FITNESS-M00-AUDIT`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 00 — Codebase Audit, Baseline Consolidation & Fitness Architecture Foundation**

---

## 2. Objective
Audit the entire existing Student Tracker codebase to map every existing Gym, Nutrition, Weight, and Dashboard integration; extract and consolidate all fitness type definitions into a dedicated, clean module (`src/types/fitness.ts`); establish safe, backward-compatible migration paths in `storage.ts`; and guarantee that zero regressions can occur to pre-existing data or tests.

---

## 3. Why This Milestone Exists
Attempting to implement advanced gym tracking or micronutrients directly on top of the existing `AppStateData` without first consolidating types and setting architectural boundaries leads to broken builds, corrupted local storage, and regressions in academic features. Milestone 00 establishes the foundation, verifies existing test baselines, and creates the safety net for all subsequent milestones.

---

## 4. Repository Areas to Inspect
Before implementing Milestone 00, inspect:
1. **Types:** [`src/types/index.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/types/index.ts) (specifically lines 95–120 for `GymWorkout`, and lines 507–616 for `FoodItem`, `FoodDiaryEntry`, `WeightLogEntry`, `NutritionProfile`).
2. **Context & State:** [`src/context/AppContext.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/context/AppContext.tsx) (lines 93–97, 159–170, 917–985, 2139–2277).
3. **Storage & Serialization:** [`src/services/storage.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/services/storage.ts) (lines 142–220, 755–813, 875–915).
4. **Calculators & Engines:** [`src/utils/nutritionCalculators.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/utils/nutritionCalculators.ts).
5. **Existing UI Components:**
   - [`src/components/views/GymView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/GymView.tsx)
   - [`src/components/views/NutritionView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/NutritionView.tsx)
   - [`src/components/dashboard/GymSplitWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/GymSplitWidget.tsx)
   - [`src/components/dashboard/FitnessSummaryWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/FitnessSummaryWidget.tsx)
6. **Existing Tests:**
   - [`tests/nutrition.test.ts`](file:///c:/Users/mandy/Downloads/TRACKER/tests/nutrition.test.ts)
   - [`tests/milestone7.test.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/tests/milestone7.test.tsx)
   - [`tests/personalSpaceDayOSAndTimetableIsolation.test.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/tests/personalSpaceDayOSAndTimetableIsolation.test.tsx)

---

## 5. Existing Functionality to Preserve
The following working behaviors must remain untouched:
1. **Gym Set Toggle:** `toggleGymSet(exerciseIndex, setIndex)` marking sets completed/uncompleted.
2. **Workout Completion:** `toggleGymWorkoutComplete()` updating today's workout status.
3. **Workout Creation:** `startTodayWorkout(splitTitle?)` creating a blank session.
4. **Food Diary Logging:** Single and batch logging via `addFoodDiaryEntry` and `addMultipleFoodDiaryEntries`.
5. **Offline Food Catalogue:** The 783 items in `src/data/foodCatalogue.ts`.
6. **Mifflin–St Jeor & TDEE Calculations:** `calculateBMR`, `calculateTDEE`, `calculateCalorieTarget`, `deriveMacroTargets`.
7. **Adult vs. Minor BMI:** `calculateBMI` with pediatric growth percentile disclaimer.
8. **Weight Trend Evaluation:** Linear regression in `evaluateWeightTrend`.
9. **Dashboard Widgets:** `GymSplitWidget` and `FitnessSummaryWidget` rendering on the Today dashboard.
10. **Sample Data Hygiene:** `clearSampleData()` preserving user-logged food, gym, and weight logs.

---

## 6. Features Included in Milestone 00
- **Dedicated Fitness Types Module:** Creation of `src/types/fitness.ts` containing the complete type specifications defined in `FITNESS_MASTER_SPEC.md`.
- **Clean Type Re-Export:** Re-exporting all fitness types from `src/types/index.ts` to ensure 100% backward compatibility for all existing files and tests.
- **Storage Sanitizer Expansion:** Updating `sanitizeEntityArray` in `src/services/storage.ts` to handle upcoming fitness collections (`workoutTemplates`, `exerciseLibrary`, `bodyMeasurements`, `sleepLogs`, `cardioSessions`, `mealPlans`).
- **Default State Initialization:** Adding empty arrays and default profiles in `src/services/defaults.ts` for new fitness collections so undefined access crashes are impossible.
- **Fitness Test Fixtures:** Authoring baseline validation tests in `tests/fitnessArchitectureBaseline.test.ts` to verify that existing state structures serialize and deserialize without loss.

---

## 7. Features Explicitly Excluded
- No changes to UI components or user-facing forms (reserved for M01–M06).
- No new database tables in Supabase (reserved for M07).
- No removal or refactoring of legacy properties like `GymWorkout.exercises` (they must remain supported via backward-compatible adapters).

---

## 8. Dependencies on Earlier Milestones
None. Milestone 00 is the entry point.

---

## 9. Data Model Requirements
Create `src/types/fitness.ts` with:
- `SetType`, `ExerciseSet`, `WorkoutExercise`, `WorkoutSession`
- `MuscleGroup`, `EquipmentRequired`, `ExerciseLibraryItem`, `WorkoutTemplate`, `WorkoutProgram`
- `MicronutrientProfile`, `LocalBarcodeMapping`, `MealPlanDay`
- `BodyMeasurementEntry`, `BodyCompositionEntry`, `ProgressPhotoEntry`
- `SleepRecoveryEntry`, `CardioType`, `CardioSession`
- Update `AppStateData` in `src/types/index.ts` to include optional fields for these new collections.

---

## 10. UI Requirements
No new UI surfaces are built in this milestone. Existing UI surfaces must continue rendering without visual disruption.

---

## 11. Business Logic Requirements
- **Backward Compatibility Adapters:** Provide utility functions:
  ```typescript
  export function adaptLegacyWorkout(legacy: GymWorkout): WorkoutSession;
  export function adaptSessionToLegacy(session: WorkoutSession): GymWorkout;
  ```
  This ensures that existing components reading `GymWorkout` continue working even when data is migrated.

---

## 12. Persistence Requirements
- Modify `src/services/storage.ts`:
  - Ensure `loadData()` gracefully supplies defaults (`[]`) for new collections if they are absent in existing JSON.
  - Ensure `clearSampleData()` retains all genuine user fitness data.
  - Bump `schemaVersion` check gracefully without discarding v2 data.

---

## 13. Edge Cases
1. **Existing User With No Fitness Data:** Must initialize all fitness arrays as `[]` without triggering null reference errors in widgets.
2. **Corrupted LocalStorage Array:** `sanitizeEntityArray` must drop non-object records and assign random fallback UUIDs to records missing IDs.
3. **Date String Formats:** Enforce `YYYY-MM-DD` standard across all date keys.

---

## 14. Error Handling
- Safe JSON parse fallbacks in `storage.ts`.
- Non-throwing sanitization: if a legacy record has invalid types, default fields must be inserted rather than throwing unhandled exceptions.

---

## 15. Testing Requirements
Create `tests/fitnessArchitectureBaseline.test.ts`:
- Test that `adaptLegacyWorkout` converts an existing `GymWorkout` into a `WorkoutSession` without losing sets, reps, weights, or notes.
- Test that `loadData()` parses an existing v2 `AppStateData` string and populates all fitness collections as valid arrays.
- Test that `clearSampleData()` strips sample records while preserving custom foods and real workouts.
- Run `tests/nutrition.test.ts` and `tests/personalSpaceDayOSAndTimetableIsolation.test.tsx` to verify zero regressions.

---

## 16. Acceptance Criteria
1. `src/types/fitness.ts` is created and all types compile cleanly.
2. `src/types/index.ts` cleanly re-exports all fitness types.
3. `npx tsc --noEmit` exits with 0 errors.
4. `npm run build` succeeds cleanly.
5. All tests in `tests/nutrition.test.ts` pass.
6. All tests in `tests/fitnessArchitectureBaseline.test.ts` pass.

---

## 17. Completion Checklist
- [x] Inspect existing `src/types/index.ts` gym and nutrition types.
- [x] Create `src/types/fitness.ts`.
- [x] Add backward compatibility adapters in `src/utils/fitnessAdapters.ts`.
- [x] Update `src/services/defaults.ts` with initial states.
- [x] Update `src/services/storage.ts` sanitizers.
- [x] Author `tests/fitnessArchitectureBaseline.test.ts`.
- [x] Run `npx tsc --noEmit` and verify 0 errors.
- [x] Run full test suite and confirm zero regressions.

---

## 18. Regression Risks
- **Risk:** Renaming existing fields in `GymWorkout` or `FoodDiaryEntry` breaks existing UI components.
  - **Mitigation:** Retain existing interfaces unchanged and extend via union types or non-breaking optional properties.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 01 (`MILESTONE_01_GYM_FOUNDATION.md`)** to implement the advanced resistance workout tracking engine, multi-set types, RPE/RIR tracking, and interactive rest timers.

