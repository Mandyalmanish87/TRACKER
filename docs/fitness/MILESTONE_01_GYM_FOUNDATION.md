# Milestone 01: Advanced Gym Tracking & Workout Execution Engine

**Document ID:** `FITNESS-M01-GYM-FOUNDATION`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 01 — Advanced Gym Tracking, Set Mechanics & Workout Execution Engine**

---

## 2. Objective
Transform the basic set-toggle widget in `GymView.tsx` into a full-featured, professional workout execution suite. Support scheduled and actual workouts, multi-type sets (Warm-up, Working, Drop, Failure, AMRAP), actual vs. target weight/reps, RPE (6.0–10.0), RIR (0–5), automatic and manual rest timers, superset and circuit linking, unilateral (left/right) tracking, in-workout exercise substitutions, volume/rep/set analytics, crash/interruption recovery, and personal record (PR) detection.

---

## 3. Why This Milestone Exists
Real-world resistance training requires tracking set intensities (RPE/RIR), different set categories (warm-ups are not scored as working volume), and rest periods. The current implementation only supports toggling fixed reps and weights on a single split. Milestone 01 provides the rigorous execution interface required for progressive overload and strength progression.

---

## 4. Repository Areas to Inspect
1. **Current Gym View:** [`src/components/views/GymView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/GymView.tsx).
2. **Current Gym Widget:** [`src/components/dashboard/GymSplitWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/GymSplitWidget.tsx).
3. **App Context Actions:** [`src/context/AppContext.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/context/AppContext.tsx) (`toggleGymSet`, `toggleGymWorkoutComplete`, `startTodayWorkout`).
4. **DayOS Integration:** [`src/components/dayos/DayOSView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dayos/DayOSView.tsx) (how today's workout split is displayed).

---

## 5. Existing Functionality to Preserve
1. **Existing Workouts In AppState:** Any existing workout in `state.gymWorkouts` must continue to be displayed and editable.
2. **Dashboard Widget Contract:** `GymSplitWidget` must continue to show today's workout split and completed sets counter.
3. **DayOS Timeline Integration:** DayOS must continue to read today's workout split and display its completion status without crash.
4. **Offline Capability:** Workout execution must work 100% offline without network calls.

---

## 6. Features Included in Milestone 01

### 6.1 Workout Session Lifecycle
- **Active Workout Session State:** Support `status: 'idle' | 'in_progress' | 'paused' | 'completed'`.
- **Interrupted Workout Recovery:** Save in-progress workout state to `localStorage` every 10 seconds. If the user refreshes or closes the browser, prompt: *"You have an active workout in progress. Resume / Discard"*.
- **Duration Tracking:** Live workout stopwatch recording elapsed seconds, excluding paused intervals.
- **Workout Notes & Readiness:** Pre-workout readiness rating (1–5) and post-workout session notes.
- **Workout Actions:** Duplicate past workout, edit past workout, delete workout with modal confirmation.

### 6.2 Set-Level Mechanics & Types
- **Set Types:**
  - `working` (Standard scored working set)
  - `warmup` (Low-intensity preparatory set; excluded from working volume calculations)
  - `drop` (Immediate weight reduction without rest)
  - `failure` (Set pushed to momentary concentric muscular failure)
  - `amrap` (As Many Reps As Possible)
- **Intensity Tracking:**
  - `RPE` (Rate of Perceived Exertion): Numeric slider/stepper from 6.0 to 10.0 in 0.5 increments.
  - `RIR` (Reps In Reserve): Integer selector from 0 to 5.
- **Target vs. Actual Values:** Pre-fill targets from the previous workout session for that exercise. Allow entering actual reps and actual weight.
- **Unilateral Tracking:** Toggle for single-limb exercises (`Left` / `Right` / `Both`) with independent weight and reps per limb.

### 6.3 Rest Timer Engine
- **Configurable Rest Timers:** Per-exercise default rest timers (e.g., 180s for heavy compound squats, 60s for isolation curls).
- **Auto-Start Rest Timer:** Completing a set automatically initiates the rest countdown with an audio/visual chime.
- **Manual Adjustments:** `+30s` and `-15s` quick adjustment buttons; skip button.
- **Non-Blocking Background Timer:** Timer continues ticking even when switching between tabs in the app.

### 6.4 Advanced Exercise Groupings
- **Supersets & Giant Sets:** Ability to link 2 or more exercises into a superset group with alternating sets.
- **Exercise Substitution:** In-workout replacement button to swap an exercise (e.g., Barbell Bench Press -> Dumbbell Bench Press) while retaining notes and tracking the substitution history.

### 6.5 Volume & PR Calculation
- **Live Session Metrics:**
  - Total Volume Load: $\sum (\text{weight} \times \text{reps})$ for all completed working sets.
  - Total Working Sets count.
  - Total Reps count.
- **Personal Record (PR) Notification:** Instant gold badge when an all-time highest weight, volume, or estimated 1RM is achieved on any set.

---

## 7. Features Explicitly Excluded
- Long-term multi-week program progression logic (reserved for M02).
- Automatic deload recommendations based on multi-week fatigue (reserved for M02).
- Cloud synchronization to Supabase Postgres (reserved for M07).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00** for consolidated types in `src/types/fitness.ts`.

---

## 9. Data Model Requirements
Use `ExerciseSet`, `WorkoutExercise`, and `WorkoutSession` defined in `FITNESS_MASTER_SPEC.md`.  
Ensure `AppContext` exposes:
```typescript
interface AppContextType {
  // ... existing fields ...
  activeWorkout: WorkoutSession | null;
  startWorkout: (templateOrSplitName?: string) => void;
  updateActiveWorkoutSet: (exerciseIndex: number, setIndex: number, updates: Partial<ExerciseSet>) => void;
  addActiveWorkoutSet: (exerciseIndex: number, setType?: SetType) => void;
  removeActiveWorkoutSet: (exerciseIndex: number, setIndex: number) => void;
  addExerciseToActiveWorkout: (exerciseId: string, exerciseName: string) => void;
  substituteExerciseInActiveWorkout: (exerciseIndex: number, newExerciseId: string, newExerciseName: string) => void;
  completeActiveWorkout: () => void;
  discardActiveWorkout: () => void;
  linkSuperset: (exerciseIndexA: number, exerciseIndexB: number) => void;
}
```

---

## 10. UI Requirements
1. **Interactive Workout Modal / Fullscreen View:** Clean, distraction-free logging interface with high-contrast text suitable for mobile gym use.
2. **Set Row Component:**
   - Set number with color badge for type (`W` for Warmup, `D` for Drop, `F` for Failure, `A` for AMRAP).
   - Previous performance indicator: e.g., `Prev: 80kg x 8`.
   - Weight input (kg) and Reps input.
   - RPE/RIR optional popover.
   - Checkmark button with instant tactile feedback.
3. **Floating Rest Timer Pill:** Persistent floating bar at the bottom of the screen showing remaining rest time with pause, skip, and add-time controls.
4. **Workout Summary Sheet:** Post-workout modal displaying total volume, PRs broken, duration, and sets per muscle group.

---

## 11. Business Logic Requirements
- **Volume Calculation:** Exclude warmup sets from total volume load:
  $$\text{Working Volume} = \sum_{s \in \text{sets}, s.\text{type} \neq \text{'warmup'}} (s.\text{actualWeightKg} \times s.\text{actualReps})$$
- **PR Detection Engine:**
  - Highest weight lifted for $\ge 1$ rep.
  - Highest estimated 1RM using the Brzycki formula:
    $$1\text{RM} = \text{weight} \times \frac{36}{37 - \text{reps}} \quad (\text{for } 1 \le \text{reps} \le 12)$$

---

## 12. Persistence Requirements
- Persist active session in `localStorage` under `tracker_active_workout_${userId}`.
- Upon completion, append to `state.gymWorkouts` (or migrated sessions array) and clear active cache.
- Ensure `state.gymWorkouts` remains backward compatible with `GymSplitWidget.tsx`.

---

## 13. Edge Cases
1. **Zero Weight / Bodyweight Exercises:** Allow weight = 0kg; calculate volume as bodyweight (from `nutritionProfile.weightKg` or 0) or volume as rep-only.
2. **Negative Numbers:** Enforce min constraint (weight $\ge 0$, reps $\ge 1$, RPE between 6 and 10).
3. **App Close During Rest Timer:** Timestamp-based timer: store `targetEndTimeMs = Date.now() + restSeconds * 1000`. On resume, recalculate remaining time.
4. **Rapid Set Toggling:** Idempotent state updates preventing duplicate PR alerts.

---

## 14. Error Handling
- Safe fallback when previous exercise history does not exist (display "First time logging this exercise").
- Discard confirmation dialog to prevent accidental deletion of a 60-minute workout.

---

## 15. Testing Requirements
Create `tests/milestone01GymExecution.test.tsx`:
- Test starting a workout session from scratch.
- Test adding sets and verify warmup sets are excluded from volume calculations.
- Test RPE and RIR assignment.
- Test unilateral exercise sets (left vs right).
- Test rest timer countdown calculation using simulated timers (`vi.useFakeTimers()`).
- Test PR detection when a set exceeds historical max weight.
- Test crash recovery restoration from `localStorage`.
- Verify `GymSplitWidget.tsx` renders updated sets accurately.

---

## 16. Acceptance Criteria
1. Full workout execution interface is usable on both desktop and mobile layouts.
2. Warmup, Drop, Failure, and AMRAP set types are selectable and styled.
3. Rest timer chimes/notifies upon completion and allows manual adjustments.
4. Interrupted workouts are restorable after page refresh.
5. All tests in `tests/milestone01GymExecution.test.tsx` pass.
6. Existing tests in `tests/milestone7.test.tsx` and `tests/personalSpaceDayOSAndTimetableIsolation.test.tsx` pass.

---

## 17. Completion Checklist
- [ ] Implement `activeWorkout` state and actions in `AppContext`.
- [ ] Create `WorkoutSessionLogger` component with set rows and set-type selectors.
- [ ] Implement `RestTimerEngine` with sound/visual indicator and background resilience.
- [ ] Implement PR detection and volume calculation utilities.
- [ ] Wire up interrupted workout recovery dialog.
- [ ] Author `tests/milestone01GymExecution.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Existing `toggleGymSet` in `GymSplitWidget` might conflict with the new active session state.
  - **Mitigation:** Synchronize `GymSplitWidget` to read from the active session if one is in progress, falling back to legacy state if none is active.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 02 (`MILESTONE_02_EXERCISE_LIBRARY_AND_WORKOUT_INTELLIGENCE.md`)** to integrate the 150+ offline Exercise Library, muscle group heatmaps, and multi-split Program Creator.

