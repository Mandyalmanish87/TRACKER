# Milestone 02: Exercise Library, Workout Programs & Muscle Intelligence

**Document ID:** `FITNESS-M02-EXERCISE-INTEL`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 02 — Comprehensive Exercise Library, Multi-Program Creator & Muscle Analytics Engine**

---

## 2. Objective
Incorporate a complete, 100% offline Exercise Library (150+ curated exercises with primary/secondary muscle mappings, coaching cues, common mistakes, and equipment categories); create a multi-split Program Architecture (Push/Pull/Legs, Upper/Lower, Full Body, Bro Split, Arnold Split, Calisthenics, Home Workouts, and Custom Programs); implement a transparent Progressive Overload Engine (1RM estimation, rep-range progression suggestions, deload detection); and build an interactive 2D Muscle Group Heatmap displaying weekly training frequency and recovery volume.

---

## 3. Why This Milestone Exists
A workout logger is ineffective if the user must manually re-type "Barbell Squat" every session without knowing their historical 1RM, what muscles are being stimulated, or when to increase weights. Furthermore, the application must not be locked into a single hardcoded PPL split. Milestone 02 provides the knowledge, structure, and analytics backbone for resistance training.

---

## 4. Repository Areas to Inspect
1. **Gym View:** [`src/components/views/GymView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/GymView.tsx) (hardcoded weekly split schedule card).
2. **Types:** `src/types/fitness.ts` (created in M00).
3. **Icons & Visuals:** `lucide-react` icons and SVGs in `src/components/`.
4. **DayOS Timeline:** [`src/components/dayos/DayOSView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dayos/DayOSView.tsx).

---

## 5. Existing Functionality to Preserve
1. **Existing Custom Exercises:** Any custom exercise created by the user must remain preserved in `localStorage`.
2. **Current Split Display:** The default split for existing users should remain Push/Pull/Legs until they explicitly select or configure a new program.
3. **No External Media APIs:** All exercise illustrations must use local, bundled SVG anatomical diagrams or user-uploaded media. No external third-party API dependencies.

---

## 6. Features Included in Milestone 02

### 6.1 Curated Offline Exercise Library
- **150+ Bundled Exercises:** Stored in `src/data/exerciseLibrary.json` across categories:
  - *Chest:* Barbell Bench Press, Incline Dumbbell Press, Dips, Cable Flyes, Push-ups, etc.
  - *Back & Lats:* Deadlift, Barbell Row, Pull-ups, Lat Pulldown, Chest-Supported Row, Face Pulls, etc.
  - *Shoulders:* Overhead Press, Dumbbell Lateral Raise, Cable Lateral Raise, Reverse Pec Deck, etc.
  - *Legs:* Barbell Back Squat, Front Squat, Romanian Deadlift, Leg Press, Bulgarian Split Squat, Hamstring Curls, Calf Raises, etc.
  - *Arms & Core:* Barbell Curl, Incline Curl, Triceps Pushdown, Skull Crushers, Hanging Leg Raise, Cable Crunch, Planks, etc.
- **Exercise Metadata:** Name, description, primary muscle, secondary muscles, equipment required, difficulty (`beginner` | `intermediate` | `advanced`), step-by-step instructions, coaching cues, common mistakes, recommended rep range, and default rest time.
- **Custom Exercise Builder:** Modal allowing users to create custom exercises with custom muscle tags.
- **Search & Filtering:** Instant offline search with filters for muscle group, equipment, and favorites (`isFavorite`).
- **Exercise Detail Page:** Historical performance chart, PR list, substitution alternatives, and form cues.

### 6.2 Multi-Split Workout Programs & Templates
- **Built-in Program Templates:**
  1. *Push / Pull / Legs (PPL)* (3-day or 6-day cycle)
  2. *Upper / Lower* (4-day cycle)
  3. *Full Body* (3-day cycle)
  4. *Bro Split* (Chest, Back, Arms, Shoulders, Legs)
  5. *Arnold Split* (Chest/Back, Shoulders/Arms, Legs)
  6. *Home & Calisthenics* (Pull-up bar, floor, and resistance bands)
  7. *Custom Program:* Fully customizable 7-day drag-and-drop schedule.
- **Program Management:**
  - Duplicate program, edit day assignments, rename splits.
  - Mark rest days vs. training days.
  - Missed workout rescheduling: option to shift remaining days forward or skip to current day.
  - Active program switcher: easily toggle between PPL and Upper/Lower.

### 6.3 Progressive Overload & Strength Intelligence Engine
- **Brzycki & Epley 1RM Calculators:**
  $$\text{1RM}_{\text{Brzycki}} = \text{weight} \times \frac{36}{37 - \text{reps}}$$
  $$\text{1RM}_{\text{Epley}} = \text{weight} \times \left(1 + \frac{\text{reps}}{30}\right)$$
- **Transparent Progression Recommendations:**
  - *Double Progression Rule:* When a user completes all prescribed sets at the top of their target rep range (e.g., 3 sets of 12 reps @ 60kg with RIR $\ge 1$), suggest: *"Progressive Overload Alert: You hit 3x12. Increase weight to 62.5kg next session."*
  - *Maintenance Advice:* When within range, suggest holding weight.
  - *Deload Recommendation:* If working volume or estimated 1RM drops by $\ge 10\%$ for 2 consecutive weeks across main compounds, suggest: *"Fatigue Accumulation: Consider a 1-week deload (reduce weight by 10% and sets by 40%)."*
- **Strictly Transparent Rule:** Explanations clearly state: *"Based on your last 3 workouts recorded in this app."* No black-box claims.

### 6.4 Muscle Group Analytics & 2D Anatomical Heatmap
- **Interactive SVG Heatmap:** Anterior (Front) and Posterior (Back) muscle diagrams colored by stimulation volume:
  - Grey: 0 sets this week (Untrained).
  - Light Emerald: 1–9 sets (Maintenance volume).
  - Deep Emerald: 10–19 sets (Optimal hypertrophy volume).
  - Amber/Rose: 20+ sets (High volume / fatigue watch).
- **Weekly Muscle Breakdown:** Frequency per muscle, sets completed, and volume distribution pie chart.
- **Undertrained Indicators:** Subtle alerts when a muscle group has received 0 working sets in the past 14 days.

---

## 7. Features Explicitly Excluded
- Food diary and meal tracking (reserved for M03).
- Progress photos (reserved for M04).
- Sleep and HRV recovery (reserved for M05).
- External third-party exercise video streaming (local diagrams only).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00** for types.
- **Requires Milestone 01** for active workout execution and set logging.

---

## 9. Data Model Requirements
Use `ExerciseLibraryItem`, `WorkoutTemplate`, `WorkoutProgram`, and `MuscleGroup` from `src/types/fitness.ts`.  
Add to `AppStateData`:
```typescript
interface AppStateData {
  // ...
  exerciseLibrary?: ExerciseLibraryItem[]; // Custom + overrides
  workoutPrograms?: WorkoutProgram[];
  activeProgramId?: string;
}
```

---

## 10. UI Requirements
1. **Exercise Library Browser:** Search bar with pill filters for `All`, `Chest`, `Back`, `Legs`, `Shoulders`, `Arms`, `Core`. Card grid with muscle badges and difficulty tags.
2. **Exercise Detail Drawer:** Form cues, common mistakes, historical 1RM trend graph, and one-click "Add to Today's Workout".
3. **Program Manager View:** Visual 7-day calendar strip with drag-and-drop or dropdown day assignments.
4. **2D Anatomical Heatmap Component:** Responsive SVG front and back muscle map with interactive hover tooltips showing weekly sets.

---

## 11. Business Logic Requirements
- **Weekly Volume Aggregator:**
  Iterate all completed workouts in the past 7 days (`today - 6 days` to `today`):
  For each completed working set, add 1.0 set to the exercise's primary muscle, and 0.5 sets to each secondary muscle.
- **Progression Suggester:**
  ```typescript
  export function evaluateProgressiveOverload(
    exerciseId: string, 
    recentSessions: WorkoutSession[], 
    targetRepRange: { min: number; max: number }
  ): ProgressionRecommendation;
  ```

---

## 12. Persistence Requirements
- Store custom exercises in `state.exerciseLibrary` (synced to local storage).
- Store custom and active programs in `state.workoutPrograms` and `state.activeProgramId`.
- Built-in exercises are read from static JSON and merged in-memory with user custom exercises.

---

## 13. Edge Cases
1. **Exercise with Missing Equipment:** Provide alternatives immediately (e.g., if Barbell is missing, show Dumbbell Bench Press).
2. **Duplicate Exercise Names:** Prevent creating custom exercises with identical names to built-in items.
3. **Empty Program Schedule:** Ensure empty days default to `isRestDay: true` without errors.
4. **Extreme 1RM Calculation:** Clamp Brzycki formula to $\le 12$ reps (for $>12$ reps, use Epley formula to avoid divide-by-zero or negative results).

---

## 14. Error Handling
- Safe handling of deleted custom exercises: if a historical workout references a deleted custom exercise, display its saved name with a `(Custom - Removed)` badge instead of crashing.
- Fallback for missing SVG paths: render a stylized generic dumbbell icon.

---

## 15. Testing Requirements
Create `tests/milestone02ExerciseLibraryAndPrograms.test.tsx`:
- Test searching and filtering the exercise library by muscle and equipment.
- Test custom exercise creation and favorite toggling.
- Test 1RM calculations with known inputs (e.g., 100kg x 5 reps = ~116kg 1RM).
- Test progressive overload recommendation when top of rep range is achieved.
- Test muscle heatmap volume calculation (primary = 1.0, secondary = 0.5).
- Test switching active workout program and verifying DayOS receives the correct split.

---

## 16. Acceptance Criteria
1. 150+ offline exercises are searchable and display form cues and muscle tags.
2. Users can create, edit, and switch workout programs (PPL, Upper/Lower, Bro Split, Custom).
3. 2D Anatomical Heatmap correctly renders stimulus volume based on logged workouts.
4. Progressive overload suggestions appear transparently after successful set targets.
5. All tests in `tests/milestone02ExerciseLibraryAndPrograms.test.tsx` pass.
6. Zero regressions in academic timetable, DayOS, or existing gym tests.

---

## 17. Completion Checklist
- [ ] Bundle `src/data/exerciseLibrary.json` with 150+ curated exercises.
- [ ] Implement `ExerciseLibraryView` and `ExerciseDetailDrawer`.
- [ ] Implement `WorkoutProgramManager` with multi-split support.
- [ ] Implement `MuscleHeatmap` SVG component.
- [ ] Implement 1RM and progressive overload recommendation engine in `src/utils/progressiveOverload.ts`.
- [ ] Author `tests/milestone02ExerciseLibraryAndPrograms.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Changing split templates overwrites or resets today's in-progress workout.
  - **Mitigation:** Active workouts must be decoupled from the template once started; editing a program template only affects future scheduled sessions.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 03 (`MILESTONE_03_ADVANCED_NUTRITION.md`)** to expand nutrition with comprehensive micronutrient tracking (20+ vitamins & minerals), local barcode database, recipe-based meal planning, and planned vs. actual intake comparisons.

