# Milestone 06: Fitness Intelligence, Student Synergy & Dashboard

**Document ID:** `FITNESS-M06-INTEL-DASHBOARD`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 06 — In-App Fitness Intelligence Engine, Academic-Fitness Synergy & Bento Dashboard Suite**

---

## 2. Objective
Unify the Gym, Nutrition, Body, and Recovery modules into an intelligent, deterministic fitness experience tailored specifically for students. Implement an in-app Fitness Intelligence Layer that analyzes user data without external LLM APIs; build academic timetable-aware workout suggestions that schedule training around lectures; provide exam-period volume deloads; and introduce a comprehensive, reorderable Fitness Dashboard (Bento layout) featuring streak counters, muscle heatmaps, PR feeds, and unified DayOS integration.

---

## 3. Why This Milestone Exists
Data without synthesis causes cognitive overload. A college student needs clear, actionable insights: *"You have a 2-hour window between Chemistry and Math lab at 15:00—optimal time for your 45-minute Push workout."* Or: *"Final exams begin in 5 days; we recommend a 40% volume deload to maximize sleep and focus."* By combining academic timetable awareness with deterministic fitness logic, the application becomes an indispensable daily lifestyle OS.

---

## 4. Repository Areas to Inspect
1. **Academic Timetable & Schedule Resolver:**
   - [`src/utils/scheduleResolver.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/utils/scheduleResolver.ts)
   - [`src/components/views/TimetableView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/TimetableView.tsx)
2. **DayOS Timeline & Dashboard:**
   - [`src/components/dayos/DayOSView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dayos/DayOSView.tsx)
   - [`src/components/dashboard/DayOSSummaryWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/DayOSSummaryWidget.tsx)
   - [`src/components/dashboard/Dashboard.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/Dashboard.tsx)
3. **Existing Dashboard Widgets:**
   - [`src/components/dashboard/GymSplitWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/GymSplitWidget.tsx)
   - [`src/components/dashboard/FitnessSummaryWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/FitnessSummaryWidget.tsx)

---

## 5. Existing Functionality to Preserve
1. **Academic Timetable Integrity:** Fitness intelligence must read timetable occurrences but **never** modify, overwrite, or delete classes, timetable slots, or attendance records.
2. **Existing Dashboard Layout:** Default widgets (`AttendanceGaugeWidget`, `TodayScheduleWidget`, `FocusWidget`, etc.) must remain functional and reorderable.
3. **DayOS Independence:** Marking a fitness activity complete in DayOS must never mark academic classes or generic tasks complete.
4. **Zero External AI Dependencies:** All intelligence must run locally via deterministic algorithms. No external OpenAI, Gemini, or Claude API calls for fitness features.

---

## 6. Features Included in Milestone 06

### 6.1 In-App Fitness Intelligence Engine
- **Deterministic Synthesis Modules:**
  1. *Workout Consistency & Streak Analyzer:* Tracks weekly training adherence, current workout streak (weeks with $\ge 3$ workouts), and rest-day balance.
  2. *Strength Progression Summary:* Surfaces rolling 30-day improvements in estimated 1RM across compound lifts (e.g., *Squat 1RM +5.2kg over 30 days*).
  3. *Volume & Recovery Balance:* Cross-references weekly volume load against subjective readiness scores.
  4. *Nutrition & Energy Alignment:* Correlates workout performance with pre-workout meal timing and daily calorie adherence.
  5. *Body Measurement Trend Synthesizer:* Highlights true recomposition (e.g., *Scale weight unchanged (-0.2kg), but waist decreased by 2.5cm and arm circumference increased by 0.8cm*).
- **Transparent Derivation Explanations:**
  Every insight includes an expandable "How this was derived" breakdown displaying the exact mathematical inputs and date ranges used.
- **Strictly User-Controlled & Optional:** Insights are presented as informative cards with "Dismiss", "Pin", or "Apply" actions.

### 6.2 Student-Specific Fitness Features
- **Timetable-Aware Workout Scheduler:**
  - Inspects the student's resolved class occurrences for the day (`resolveSchedule` in `scheduleResolver.ts`).
  - Detects free time blocks ($\ge 60$ minutes between classes or after last lecture) and suggests:
    *"You have a free block today from 14:00 to 16:30 between Physics and Data Structures. Perfect slot for your Push routine."*
- **Exam-Period Deload Mode:**
  - When the student's `UserProfile.examDate` is within 7 days (or when heavy mock tests are scheduled), automatically prompt:
    *"Final Exam Approaching: Activate Academic Deload? We'll reduce target sets by 40% and keep training sessions under 45 minutes to protect your recovery and study energy."*
- **Contextual Reminders:**
  - Pre-workout meal reminder (2 hours before planned workout window).
  - Hydration reminder (interspersed with study blocks).
  - Post-study mobility / posture break reminder after 90+ minutes of continuous study sessions.

### 6.3 Comprehensive Fitness Dashboard (Bento Suite)
- **Dedicated Bento Widgets:**
  1. `TodayWorkoutWidget`: Current split, active sets, and quick "Start Workout" button.
  2. `FitnessStreakWidget`: Flame icon, active week streak, and rest days taken.
  3. `MacroRingsWidget`: Concentric progress rings for Calories, Protein, Carbs, and Fat.
  4. `HydrationWidget`: Quick $+250\text{ml}$ tap button, daily water goal, and visual glass progress bar.
  5. `MuscleHeatmapWidget`: Mini front/back anatomical thumbnail showing weekly stimulation.
  6. `RecentPRsWidget`: Feed of recently achieved personal records and estimated 1RM milestones.
  7. `ReadinessScoreWidget`: Today's readiness gauge (0–100) with sleep and fatigue indicators.
  8. `BodyCompositionWidget`: Latest scale weight, 7-day rolling average, and waist-to-height ratio.
- **Customizable Grid Settings:** Reorder widgets, toggle visibility in Settings, and choose between Compact and Bento layouts.
- **Unified DayOS Sync:** DayOS automatically renders workout times, hydration checkpoints, and meal plan items directly in its chronological timeline.

---

## 7. Features Explicitly Excluded
- Cloud database syncing to Supabase (reserved for M07).
- Social leaderboards or peer sharing.
- Wearable Bluetooth push notifications.

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 01** (Gym Execution).
- **Requires Milestone 02** (Exercise Library & Muscle Heatmap).
- **Requires Milestone 03** (Advanced Nutrition & Meal Planning).
- **Requires Milestone 04** (Body Composition).
- **Requires Milestone 05** (Recovery & Cardio).

---

## 9. Data Model Requirements
Add to `src/types/fitness.ts`:
```typescript
export interface FitnessInsight {
  id: string;
  category: 'strength' | 'nutrition' | 'recovery' | 'academic_synergy';
  title: string;
  summary: string;
  derivationExplanation: string;
  actionLabel?: string;
  actionPayload?: { type: string; data: any };
  isDismissed?: boolean;
  createdAt: string;
}

export interface HydrationLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  timestamp: string; // ISO
}
```
Update `AppSettings` in `src/types/index.ts` to include fitness widget order and visibility toggles.

---

## 10. UI Requirements
1. **Fitness Dashboard View (`/fitness` or dedicated Personal Space view):** Bento grid featuring customizable widgets.
2. **Timetable Synergy Alert Card:** Visual card in DayOS and Fitness Dashboard showing free workout time blocks.
3. **Insight Card Component:** Expandable card with a lightbulb icon, primary recommendation, and "Why am I seeing this?" mathematical derivation toggle.
4. **Hydration Widget:** Quick-add buttons (`+250ml`, `+500ml`, `+750ml`) with interactive water bottle fill animation.

---

## 11. Business Logic Requirements
- **Free Time Slot Detection Algorithm:**
  ```typescript
  export function findOptimalWorkoutWindows(
    timetableEvents: ResolvedCalendarEvent[],
    studySessions: StudySession[],
    targetDate: Date,
    minDurationMinutes: number = 60
  ): TimeWindow[];
  ```
- **Exam Deload Logic:**
  ```typescript
  export function evaluateExamDeloadStatus(
    examDateStr?: string,
    currentDate: Date = new Date()
  ): { isExamSoon: boolean; daysRemaining: number; recommendation?: string };
  ```

---

## 12. Persistence Requirements
- Persist `state.hydrationLogs` and `state.fitnessInsights` in `localStorage` under `tracker_user_data_${userId}`.
- Sanitizer in `storage.ts` preserves hydration logs and custom widget configurations.

---

## 13. Edge Cases
1. **Full-Day College Schedule (Zero Free Windows):** Suggest a short 20-minute morning bodyweight circuit or recommend an active rest day without breaking streaks.
2. **Exam Date in the Past:** Automatically deactivate exam deload mode without requiring user cleanup.
3. **Conflicting Deload Triggers:** If both academic exams and physical fatigue trigger deloads, combine them into a single coherent recommendation card.
4. **Hydration Date Rollover:** Hydration logs strictly reset daily totals at local midnight (`00:00`).

---

## 14. Error Handling
- Safe handling of undefined `UserProfile.examDate`.
- Fallback for days with zero classes (display: *"No classes scheduled today. Flexible workout timing all day."*).

---

## 15. Testing Requirements
Create `tests/milestone06FitnessIntelligence.test.tsx`:
- Test free workout window detection around morning and afternoon classes.
- Test exam deload recommendation trigger when exam is $\le 7$ days away.
- Test that fitness intelligence insights explain their mathematical derivations.
- Test hydration logging ($+250\text{ml}$ increments and daily reset).
- Test reordering fitness dashboard widgets and persisting order.
- Test that DayOS correctly renders fitness events alongside academic events without false completions.
- Run `tests/personalSpaceDayOSAndTimetableIsolation.test.tsx` to verify zero regressions.

---

## 16. Acceptance Criteria
1. Fitness Intelligence generates transparent, explainable recommendations without external AI APIs.
2. Workout windows are accurately suggested based on actual class timetable occurrences.
3. Exam-period deload recommendations trigger reliably when exams approach.
4. Bento Fitness Dashboard displays all 8 specialized fitness widgets with reordering support.
5. All tests in `tests/milestone06FitnessIntelligence.test.tsx` pass.
6. Zero regressions in academic timetable, DayOS, or ClassSpace workspaces.

---

## 17. Completion Checklist
- [ ] Implement `src/utils/timetableFitnessSynergy.ts` (free window detection & exam deloads).
- [ ] Implement `src/utils/fitnessIntelligenceEngine.ts` (deterministic insight generator).
- [ ] Build Bento widgets: `MacroRingsWidget`, `HydrationWidget`, `RecentPRsWidget`, `MuscleHeatmapWidget`.
- [ ] Integrate Bento widgets into `Dashboard.tsx` and `DayOSView.tsx`.
- [ ] Author `tests/milestone06FitnessIntelligence.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Timetable changes inadvertently triggering invalid workout alarms.
  - **Mitigation:** Timetable synergy is strictly read-only; it derives slots on render without persisting static event overrides.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 07 (`MILESTONE_07_CLOUD_SYNC_AND_DATA_RELIABILITY.md`)** to implement private Supabase cloud synchronization, private photo bucket security, and offline conflict resolution.

