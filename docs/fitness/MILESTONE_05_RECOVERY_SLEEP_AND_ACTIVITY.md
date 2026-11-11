# Milestone 05: Recovery, Sleep & Cardio Activity Tracking

**Document ID:** `FITNESS-M05-RECOVERY-CARDIO`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 05 — Recovery, Sleep Architecture, Soreness Mapping & Cardio Engine**

---

## 2. Objective
Build an integrated physical readiness and aerobic conditioning system without third-party wearable APIs. Track sleep duration, sleep quality, and manual resting HR/HRV; implement a localized Muscle Soreness (DOMS) Heatmap; compute a transparent, deterministic Daily Readiness Index (0–100); and build a versatile Cardio & Conditioning Session Logger (running, walking, cycling, rowing, swimming, HIIT) with manual pace, distance, Zone 2 tracking, and transparent calorie estimation formulas.

---

## 3. Why This Milestone Exists
Academic exhaustion and physical training fatigue compound each other. A student who slept 4 hours before an exam cannot safely hit heavy deadlifts. Without wearable reliance, users need an honest, frictionless way to log their subjective recovery, track localized muscle soreness, and record cardiovascular conditioning to prevent overtraining and burnout.

---

## 4. Repository Areas to Inspect
1. **Types:** `src/types/fitness.ts` (`SleepRecoveryEntry`, `CardioSession`, `CardioType`).
2. **Context:** [`src/context/AppContext.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/context/AppContext.tsx).
3. **DayOS Integration:** [`src/components/dayos/DayOSView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dayos/DayOSView.tsx).
4. **Dashboard:** [`src/components/dashboard/Dashboard.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/Dashboard.tsx).

---

## 5. Existing Functionality to Preserve
1. **Academic Calendar & Timetable:** Recovery logging must not alter academic schedules.
2. **Gym Workouts & Nutrition:** Existing workout sessions and food logs must remain unaffected.
3. **No Fake Hardware Sensor Access:** The application must explicitly indicate that sleep, resting HR, and steps are user-entered and not harvested from unauthorized device sensors.

---

## 6. Features Included in Milestone 05

### 6.1 Sleep & Holistic Recovery Tracking
- **Sleep Metrics:**
  - Bedtime and Wake-up time (with automatic duration calculation).
  - Sleep Duration (hours and minutes).
  - Sleep Quality Rating (1 to 5 stars: *1=Restless/Disrupted, 3=Average, 5=Deep & Restorative*).
- **Subjective Fatigue Markers:**
  - Energy Level (1 to 5).
  - Mental Stress Level (1 to 5).
  - Recovery Notes (e.g., "Late night cramming for physics exam").
- **Optional Cardiovascular Entry:**
  - Resting Heart Rate (BPM) when measured manually (pulse check or personal monitor).
  - Heart Rate Variability (rMSSD in ms) when manually entered from a personal monitor.
  - Explicit provenance label: `[Manually Entered Metric]`.

### 6.2 Localized Muscle Soreness (DOMS) Map
- **Muscle-Specific Soreness Level:**
  - Interactive clickable muscle map allowing users to rate soreness from 0 to 3:
    - `0`: Fresh / Recovered
    - `1`: Mild Soreness (stiff but fully trainable)
    - `2`: Moderate Soreness (noticeable DOMS; reduce volume)
    - `3`: Severe DOMS (painful; requires active rest)
- **Integration with Workout Suggestions:**
  - If Quads are marked `3 (Severe)`, highlight an alert if today's scheduled workout is "Leg Day": *"High quad soreness reported. Consider shifting Leg Day or performing active recovery mobility."*

### 6.3 Deterministic Readiness Index Engine
- **Readiness Score Calculation (0 to 100):**
  A transparent, weighted mathematical score based on user inputs:
  $$\text{Readiness Score} = (S_{\text{duration}} \times 0.35) + (S_{\text{quality}} \times 0.25) + (E_{\text{energy}} \times 0.20) + ((6 - S_{\text{stress}}) \times 0.10) + ((3 - \bar{D}_{\text{soreness}}) \times 0.10)$$
  *(All component scores normalized to 0–100).*
- **Readiness Brackets & Guidance:**
  - `80–100` (Optimal): Ready for high intensity or PR attempts.
  - `60–79` (Moderate): Standard training volume.
  - `<60` (Low / Fatigued): Recommend reduced volume, Zone 2 active recovery, or an extra rest day.
- **Medical Disclaimer:** Explicit note: *"Readiness is an informational estimate derived from your logged subjective inputs. It is not a clinical medical assessment."*

### 6.4 Cardio & Conditioning Session Logger
- **Supported Cardio Modalities:**
  - Walking, Running, Outdoor Cycling, Treadmill, Swimming, Rowing, Stair Climbing, HIIT.
- **Cardio Parameters:**
  - Duration (minutes and seconds).
  - Distance (km or miles).
  - Average Pace (calculated: $\text{duration} / \text{distance}$, min/km).
  - Speed (calculated: $\text{distance} / \text{hours}$, km/h).
  - Elevation Gain (meters, optional).
  - Average Heart Rate (BPM, optional manual entry).
  - Zone 2 Cardio Time (minutes spent in conversational aerobic threshold).
- **Transparent Calorie Burning Formula:**
  Uses standard Metabolic Equivalent of Task (MET) calculations:
  $$\text{Calories Burned} = \text{MET} \times \text{Weight (kg)} \times \left(\frac{\text{Duration (min)}}{60}\right)$$
  - Walking (4.8 km/h): $\text{MET} = 3.5$
  - Jogging (8.0 km/h): $\text{MET} = 8.0$
  - Cycling (moderate): $\text{MET} = 6.0$
  - Rowing: $\text{MET} = 7.0$
  - Swimming: $\text{MET} = 8.0$
  - HIIT: $\text{MET} = 10.0$
- Every calorie estimate displays a label: `[Formula Estimate: MET x Weight x Time]`.

---

## 7. Features Explicitly Excluded
- Background Bluetooth sensor polling (Web Bluetooth API for fitness bands is excluded to maintain zero external hardware dependencies).
- GPS background location tracking (distance is manually entered or read from treadmill/cycle displays).
- Advanced fitness intelligence summaries (consolidated in M06).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00** for types.
- **Requires Milestone 01** to link soreness to resistance exercises.

---

## 9. Data Model Requirements
Use `SleepRecoveryEntry`, `CardioType`, and `CardioSession` from `src/types/fitness.ts`.  
Ensure `AppContext` exposes:
```typescript
interface AppContextType {
  // ... existing fields ...
  sleepRecoveryLogs: SleepRecoveryEntry[];
  cardioSessions: CardioSession[];
  logSleepRecovery: (entry: Omit<SleepRecoveryEntry, 'id' | 'createdAt'>) => void;
  deleteSleepRecovery: (id: string) => void;
  logCardioSession: (session: Omit<CardioSession, 'id' | 'createdAt'>) => void;
  deleteCardioSession: (id: string) => void;
  getTodayReadiness: () => { score: number; interpretation: string; alert?: string };
}
```

---

## 10. UI Requirements
1. **Sleep & Recovery Modal / Card:** Quick 60-second morning check-in slider for sleep hours, sleep quality stars, energy, and stress.
2. **Clickable Soreness Map:** Anatomical silhouette where tapping muscle regions cycles soreness: Green (0) -> Yellow (1) -> Orange (2) -> Red (3).
3. **Cardio Logging Form:** Select sport type icon, input distance and time, with live calculation of pace, speed, and MET calories.
4. **Cardio History & PRs:** Table displaying longest distance, fastest 5k pace, and weekly cardio volume.

---

## 11. Business Logic Requirements
- **MET Calorie Engine:** Implement `src/utils/cardioCalculators.ts`:
  ```typescript
  export function calculateCardioMetrics(
    type: CardioType, 
    durationMinutes: number, 
    distanceKm?: number, 
    userWeightKg: number = 70
  ): { pace: number; speed: number; estimatedCalories: number };
  ```
- **Readiness Scoring Engine:** Implement `src/utils/readinessEngine.ts`.

---

## 12. Persistence Requirements
- Persist `state.sleepRecoveryLogs` and `state.cardioSessions` in `localStorage` under `tracker_user_data_${userId}`.
- Update `sanitizeEntityArray` in `storage.ts` to retain recovery and cardio collections during demo data purges.

---

## 13. Edge Cases
1. **Negative Time or Overnight Sleep:** If Bedtime is `23:00` and Wake time is `07:00`, correctly calculate 8 hours duration across the midnight boundary.
2. **Missing User Weight for Calorie Calculation:** Default safely to 70kg and display an informational note: `*Estimated using 70kg baseline. Set body weight in Profile for precision.`
3. **Zero Distance Entered for Cardio (e.g., HIIT or stationary bike):** Calculate calories based purely on duration and sport MET value without crashing pace division by zero.
4. **Conflicting Soreness Inputs:** Allow multiple soreness updates on the same date; the latest submission represents current state.

---

## 14. Error Handling
- Safe division guards: $\text{distance} > 0$ before computing pace or speed.
- Form validation: duration $> 0$, sleep duration between 1 and 24 hours.

---

## 15. Testing Requirements
Create `tests/milestone05RecoveryAndCardio.test.tsx`:
- Test sleep duration calculation across midnight boundaries (e.g., 22:30 to 06:45 = 8h 15m).
- Test readiness score calculation with varying inputs (poor sleep + high stress vs. great sleep + low stress).
- Test muscle soreness map state cycling (0 -> 1 -> 2 -> 3).
- Test MET calorie calculations for running, cycling, and walking against verified reference values.
- Test pace and speed calculations for running 5km in 25 minutes (Pace: 5:00 min/km, Speed: 12.0 km/h).
- Test zero-distance cardio sessions (e.g., 30 min HIIT) avoiding division-by-zero crashes.

---

## 16. Acceptance Criteria
1. Morning sleep and recovery check-in can be completed in under 60 seconds.
2. Muscle soreness map allows rating DOMS per muscle group and displays training alerts.
3. Cardio session logger supports running, cycling, rowing, swimming, HIIT, and Zone 2 tracking.
4. Calorie estimates feature transparent MET provenance labels.
5. All tests in `tests/milestone05RecoveryAndCardio.test.tsx` pass.
6. Zero regressions in academic, gym, or nutrition components.

---

## 17. Completion Checklist
- [ ] Implement `src/utils/cardioCalculators.ts` with MET formulas and pace converters.
- [ ] Implement `src/utils/readinessEngine.ts` with transparent readiness algorithms.
- [ ] Build `SleepRecoveryModal` and `ReadinessCard`.
- [ ] Build `MuscleSorenessMap` interactive component.
- [ ] Build `CardioSessionLogger` and cardio history table.
- [ ] Author `tests/milestone05RecoveryAndCardio.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Recovery alerts interfering with academic reminders or timetable notifications.
  - **Mitigation:** Keep recovery notifications strictly contained within the fitness views and DayOS fitness cards; never block academic timetable alarms.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 06 (`MILESTONE_06_FITNESS_INTELLIGENCE_AND_DASHBOARD.md`)** to integrate Fitness Intelligence, Bento dashboard widgets, and academic timetable-aware scheduling.

