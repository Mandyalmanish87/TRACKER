# Fitness Milestone 4: Recovery Dashboard, Muscle Volume Analytics & Kinetic Imbalance

## 1. Scope
Create an athletic recovery and volume intelligence dashboard inspired by the LIFT recovery system:
- Comprehensive Recovery Overview: days since last workout, fresh muscle count, recovering count, ready to train count, and current workout streak.
- Interactive 3D/2D Recovery Map showing individual muscle fatigue levels based on volume, intensity, and time elapsed.
- Dynamic Recovery Timeline: per-muscle readiness gauges, hours since last stimulation, and estimated optimal training windows.
- Muscle Volume Analytics: weekly and monthly volume, effective sets, primary vs secondary contribution, and time-range filters (7d, 30d, 90d, 1y, all time).
- Biomechanical Muscle Imbalance Engine: detects agonist/antagonist volume disparities (e.g. Chest to Back, Biceps to Triceps, Quads to Hamstrings) and left vs right bilateral asymmetries.

## 2. Existing Files Inspected
- `src/components/recovery/RecoveryView.tsx`: Sleep quality and cardio session logger.
- `src/utils/readinessEngine.ts`: Daily readiness score derivation.
- `src/utils/timetableFitnessSynergy.ts`: Academic timetable and workout density coordination.

## 3. Files to Create
- `src/components/recovery/RecoveryDashboard.tsx`: Unified recovery hub combining sleep quality, DOMS soreness mapping, recovery timeline, and readiness score.
- `src/components/recovery/MuscleVolumeAnalytics.tsx`: Advanced charting for muscle set volume, tonnage distribution, and bilateral symmetry.
- `src/utils/recoveryCalculationEngine.ts`: Mathematical model of muscle fatigue dissipation over time (24h - 72h based on set volume and intensity).
- `docs/FITNESS_MILESTONE_4.md`: This milestone specification.

## 4. Files to Modify
- `src/components/views/GymView.tsx`: Expose the dedicated Recovery Dashboard and Muscle Volume Analytics views.
- `src/components/recovery/RecoveryView.tsx`: Integrate with the comprehensive Recovery Dashboard.

## 5. Implementation Details
### Recovery Fatigue Decay Model
- Baseline recovery window:
  - Low volume (1 - 4 sets): ~24 - 36 hours.
  - Moderate volume (5 - 9 sets): ~36 - 48 hours.
  - High volume (10+ sets): ~48 - 72 hours.
- Soreness modifier: User-logged DOMS rating (0 to 3) extends recovery window by 12h per severity point.
- Disclaimer: Clearly labeled as an empirical estimate to guide training, not medical diagnosis.

### Kinetic Imbalance Ratios
- Push / Pull Ratio: Compares Chest + Front Deltoids volume to Upper Back + Lats volume (ideal ratio ~0.8 to 1.1).
- Quad / Hamstring Ratio: Compares Quadriceps volume to Hamstrings volume (ideal ratio ~1.0 to 1.3).
- Bilateral Asymmetry: Identifies left vs right discrepancies exceeding 15% in unilateral movements.

## 6. Dependencies
- Native React and Lucide icons.

## 7. Acceptance Criteria
- [x] Recovery metrics update dynamically upon logging workouts and sleep entries.
- [x] Muscle recovery status displays clear color codes with numerical percentages.
- [x] Volume analytics support 7d, 30d, 90d, 1y, and all-time date filters.
- [x] Imbalance engine identifies push/pull and bilateral volume discrepancies.

## 8. Tests
- Tests in `tests/fitnessArchitectureBaseline.test.ts` and `tests/fitnessEcosystemFullRegression.test.tsx` verifying recovery calculations and volume aggregation.

## 9. Completion Checklist
- [x] Recovery calculation engine implemented.
- [x] Recovery dashboard with timeline created.
- [x] Muscle volume analytics with symmetry charts created.

