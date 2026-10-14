# TRACKER — Engineering Implementation Plan
*Version 2.0 — Revised Roadmap*

**Author**: Lead Engineer  
**Date**: October 14, 2026  
**Status**: Awaiting approval before implementation of Milestones 2–8

---

## 1. Technology Stack (Approved & In Use)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 19 + TypeScript + Vite | Zero-server, instant HMR, native ES modules |
| Styling | Tailwind CSS + CSS custom properties | Direct token sync with DESIGN_SYSTEM.md |
| Iconography | Lucide React | Consistent stroke icons, tree-shakable |
| State | React Context + custom hooks | No external state manager needed at this scale |
| Persistence | `localStorage` behind `IStorageService` interface | Easy to swap to IndexedDB later |
| Testing | Vitest + React Testing Library | Fast, native ESM test runner |
| Charts | Inline SVG (simple shapes) + Recharts (complex charts, added when needed) | No premature dependency |

No paid APIs. No backend. No cloud sync. All features work fully offline except Google Fonts CDN (fallbacks configured) and Focus Radio YouTube embeds (clearly labelled).

---

## 2. Current State — What Is Delivered (Milestone 1 ✅)

All items below are **working, tested, and must be preserved** in every future milestone.

### 2.1 Application Shell
- React 19 + TypeScript + Vite + Tailwind scaffold
- `ThemeProvider`: Light / Dark / System with zero-flicker inline script in `index.html`
- Fluid responsive layout: `max-w-[1680px] 2xl:max-w-[1840px]` container with consistent gutters
- Navigaton: Dashboard, Timetable, Attendance, Focus, Gym, Reminders tabs

### 2.2 Dashboard (All Widgets Functional)
- TodayScheduleWidget — time-ordered, auto-fallback to day 3 for demo
- AttendanceGaugeWidget — live percentage + safety margin
- FocusWidget — Pomodoro / Flow / Custom timer with session logging
- GymSplitWidget — split display, set toggling, workout completion
- RemindersWidget — priority checklist with inline completion

### 2.3 Full Views
- TimetableView, AttendanceView (with simulator), FocusView, GymView, RemindersView

### 2.4 Data Layer
- `IStorageService` interface with `LocalStorageService` implementation
- `exportBackup` / `importBackup` stubs ready for UI
- Sample / user data separation via `isSample: true`
- Schema key: `tracker_app_data_v1`

### 2.5 Calculations
- `calculateSubjectAttendance()` — correct safe-skip and needed-class formulas
- `calculateOverallAttendance()` — aggregate cross-subject stats

### 2.6 Tests (11/11 passing)
- 7 attendance unit tests in `tests/attendance.test.ts`
- 4 component tests in `tests/app.test.tsx`
- Production build: `tsc && vite build` → 88 kB gzip JS, 6.4 kB gzip CSS

---

## 3. Unified Data Model

### 3.1 v1 (Current)
```typescript
interface AppStateData {
  schemaVersion?: undefined; // absent in v1
  hasSampleData: boolean;
  subjects: Subject[];
  timetable: TimetableSlot[];
  attendanceLogs: AttendanceLog[];
  studySessions: StudySession[];
  gymWorkouts: GymWorkout[];
  reminders: Reminder[];
}
```

### 3.2 v2 (Target — added incrementally across milestones)

New top-level keys added without removing v1 keys:
```typescript
schemaVersion: 2
profile: UserProfile
settings: AppSettings
syllabusSubjects: SyllabusSubject[]
studyPlannerTasks: PlannerTask[]
mockTests: MockTest[]
errorLogs: ErrorLogEntry[]
questionLogs: QuestionLog[]
foodDiaryEntries: FoodDiaryEntry[]
weightLogs: WeightLog[]
customFoods: CustomFood[]
recipes: Recipe[]
focusRadioUrls: RadioUrl[]
```

Full interface definitions are in `docs/PRODUCT_SPEC.md` § 4.4.

### 3.3 Migration
- Migration runs on app load when `schemaVersion` is absent or lower than current.
- `migrateV1ToV2(raw: unknown): AppStateData` — pure function, unit tested.
- Old localStorage key preserved until the user clears it.
- Storage key bumped: `tracker_app_data_v2`.

---

## 4. Phased Milestones

> Each milestone delivers a **usable application** at its completion. No milestone breaks existing functionality.

---

### Milestone 1 — Foundation & Daily Dashboard ✅ COMPLETE
**Delivered**: Full application shell, ThemeProvider, 5-widget dashboard, attendance math, timetable view, focus timer, gym logger, reminders, StorageService, 11 passing tests, production build verified.

---

### Milestone 2 — Profile, Personalization & Academic Countdown ✅ COMPLETE

**Goal**: give the app a personal identity, rich appearance personalization, and an academic countdown.

**Delivered**:
- [x] `UserProfile` and `AppSettings` types added to v2 schema with non-hardcoded generic academic goals.
- [x] Schema migration: v1 → v2 (preserves all existing data, adds profile/settings, bumps key).
- [x] `storageService` and `AppContext` persistence safely preserves profile, settings, and v1 data across reloads.
- [x] Settings page: display name, academic target & date with calendar picker, study-day rollover hour slider, theme toggle, 6 accent colour swatches, and 5 background styles.
- [x] Functional accent colours: Terracotta, Forest Sage, Ochre, Dusty Blue, Plum, Slate — CSS custom properties live on `<html>`.
- [x] Functional background styles: Minimal, Abstract, Space, Ocean, Custom (with URL validator, presets, and contrast-preserving scrim).
- [x] Academic Countdown panel on Dashboard: calculates full days to target date, handles past dates, today state, and empty states. Toggleable in Settings.
- [x] Dashboard greeting and Header badge dynamically use `profile.displayName`.
- [x] JSON export/import data backup triggers.
- [x] 17 passing tests across 3 test suites (`tests/attendance.test.ts`, `tests/app.test.tsx`, `tests/milestone2.test.tsx`).
- [x] Production build passes cleanly with zero TypeScript errors.

---

### Milestone 3 — Syllabus Tracker

**Goal**: track subject coverage down to subtopic level with revision management.

**Scope**:
- [ ] `SyllabusSubject`, `SyllabusChapter`, `Subtopic` types.
- [ ] Default subjects seeded (Physics, Chemistry, Mathematics, Biology) with `isSample: false` — these are user-configurable starters, not demo data.
- [ ] Subject management: add, rename, reorder, delete (with confirmation).
- [ ] Chapter accordion UI: collapsible, progress bar, completion fraction.
- [ ] Subtopic status cycle: `not_started → in_progress → done → revision_needed`.
- [ ] Revision count incremented on each "mark revised" action.
- [ ] PYQ coverage toggle per subtopic.
- [ ] Global search across all subjects/chapters/subtopics.
- [ ] Subject summary cards: total, done, in-progress, revision-pending counts.
- [ ] Confirmation dialog before any destructive reset.
- [ ] Chapter-complete confirmation warns if subtopics are revision-pending.

**Integration**:
- Completing a chapter prompts: "Add a mock-test task?" (user confirms).
- Error Log entries can set a subtopic to `revision_needed` (wired in Milestone 6).

**Tests**:
- Subtopic status transitions (all valid paths).
- Revision count increments correctly.
- Search filters correctly across nested structure.
- Destructive reset actually clears the target scope only.

---

### Milestone 4 — Deep-Focus System (Enhanced)

**Goal**: replace the basic timer with a full study-session tracker with analytics.

**Scope**:
- [ ] Persist all existing `StudySession` records (schema compatible, no migration needed).
- [ ] Timer state persisted to `localStorage` every second (recovery after accidental close).
- [ ] Subject selector sourced from Syllabus Tracker subjects (Module 2/3) and Attendance subjects (Module 10) — unified subject list.
- [ ] Session history list with date, duration, subject, notes, focus score.
- [ ] Weekly bar chart (7 days) — derived from real session records via inline SVG bars.
- [ ] Streak calculation: current and longest daily study streaks.
- [ ] Rolling average: 7-day and 30-day study time per day.
- [ ] Productivity insights panel: most-studied subject, most productive hour-of-day.
- [ ] PiP button: `document.requestPictureInPicture()` on a canvas-in-video element. Feature-detected; hidden on unsupported browsers.
- [ ] Honest background-timer warning banner when tab visibility changes.

**Tests**:
- Streak calculation (gap handling, timezone-safe date comparison).
- Weekly chart data aggregation (groups sessions by local date, not UTC).
- Timer state recovery (simulate interrupted session, verify resumption values).
- PiP feature detection returns `false` when API is absent.

---

### Milestone 5 — Study Planner & Daily Questions

**Goal**: structured task management and daily question habit tracking.

**Scope**:
- [ ] `PlannerTask` type and CRUD.
- [ ] Kanban-style To Do / In Progress / Done columns.
- [ ] Task fields: title, subject, subtopic link, estimated minutes, due date, priority.
- [ ] Weekly study-hour targets (per subject, configurable).
- [ ] Long-term goals (title, target date, linked subject/chapter).
- [ ] Spaced-repetition review task creation: auto-created when subtopic marked `done` in Syllabus; configurable interval; no duplicate creation.
- [ ] Dashboard integration: today's planner tasks shown in command center.
- [ ] `QuestionLog` type: one record per date, edit replaces (no duplicates).
- [ ] Daily question tracker UI: today's count vs. target, 7-day trend chart, streak.
- [ ] Question target configurable in Settings.

**Tests**:
- Completing a task updates Dashboard completed-task count.
- No duplicate review task created for same subtopic.
- Question log edit replaces — total count matches actual entries.
- 7-day trend chart data matches stored logs.

---

### Milestone 6 — Mock-Test Analytics & Error Log

**Goal**: quantitative test performance tracking and systematic error review.

**Scope**:
- [ ] `MockTest` type and CRUD.
- [ ] Test categories: user-defined (e.g., "JEE Full Syllabus", "Chapter Test — Thermodynamics").
- [ ] Score entry: total, subject-wise breakdown, questions attempted, questions correct.
- [ ] Score % and accuracy % calculated and displayed separately.
- [ ] Score history chart per category (chronological, inline SVG or Recharts bar chart).
- [ ] Average, best, and trend (N-test moving average) per category.
- [ ] Subject-wise performance breakdown chart.
- [ ] Cross-category comparison blocked: UI prevents averaging across different `maxMarks` configs.
- [ ] `ErrorLogEntry` type and CRUD.
- [ ] Error categories: conceptual / calculation / silly / formula.
- [ ] Chapter/subtopic linkage → sets subtopic to `revision_needed`.
- [ ] Recurring-weakness detection: ≥ 3 errors in same chapter → flag as recurring.
- [ ] Convert error to Study Planner revision task (user confirms, duplicate check).
- [ ] Review history per error entry.
- [ ] Weak-chapter suggestions from mock tests → Error Log (user confirms).

**Tests**:
- Score % = `score / maxMarks × 100` (not swapped with accuracy).
- Accuracy % = `correct / attempted × 100` (guarded against `attempted = 0`).
- Different-`maxMarks` tests not aggregated together.
- Recurring-weakness flag set at exactly 3 errors, not 2.
- No silent duplicate task creation.

---

### Milestone 7 — Gym & Nutrition (Full)

**Goal**: extend the gym logger with a complete food diary and fitness onboarding.

**Scope**:

#### 7a — Nutrition Data Foundation
- [ ] Curate offline food catalogue (~500–800 foods: common Indian staples, international basics, packaged goods). Source: Open Food Facts curated subset (ODbL licence, no API key). Stored as a static JSON file bundled with the app.
- [ ] `NutrientValues` type (all fields optional except `dataComplete`).
- [ ] `CustomFood` type and CRUD.
- [ ] `Recipe` type (ingredient list → computed nutrients).
- [ ] Food search: fuzzy match on name, 50-item result limit.
- [ ] Serving size scaling: `(logged_quantity / reference_quantity) × nutrient_value`.

#### 7b — Food Diary
- [ ] `FoodDiaryEntry` type and CRUD. One `lastEditedAt` timestamp per entry to prevent double-counting.
- [ ] Meal categories: Breakfast, Lunch, Dinner, Snacks, Pre-Workout (optional), Post-Workout (optional).
- [ ] Per-meal totals and daily totals.
- [ ] Missing-data handling: `—` for absent nutrients, never `0`. Daily total notes count of incomplete foods.
- [ ] Macro donut chart (inline SVG, three segments: protein/carbs/fat).
- [ ] Nutrient progress bars for vitamins/minerals (collapsed under "More nutrients").
- [ ] Historical diary: navigate by date.

#### 7c — Fitness & Nutrition Onboarding
- [ ] `UserProfile` fields (added in Milestone 2) consumed here.
- [ ] BMI calculation with adult / minor interpretation (see PRODUCT_SPEC.md § 11.3.3).
- [ ] Mifflin–St Jeor BMR + activity multiplier → TDEE (see § 11.3.4).
- [ ] Goal-based calorie adjustment (bulk / cut / maintain) with configurable surplus/deficit.
- [ ] Macro target derivation consistent with calorie total (see § 11.3.5).
- [ ] Manual override for all targets.
- [ ] All outputs labelled `[ESTIMATE]`.
- [ ] Weight log: one entry per day, edit replaces.
- [ ] Weight history chart (line chart, Recharts or inline SVG).
- [ ] 2-week recalibration suggestion (trend vs. goal, see § 11.3.6).
- [ ] Onboarding can be skipped entirely.

#### 7d — Dashboard Integration
- [ ] Fitness summary card on Dashboard: today's gym status + calorie budget remaining.

**Tests** (nutrition & fitness — highest priority):
- BMI: valid range, metric/imperial conversion, minor vs. adult interpretation.
- BMR: Mifflin–St Jeor male/female formulas (known reference values).
- TDEE: all five activity multipliers.
- Macro arithmetic: `(P×4) + (C×4) + (F×9) = calorie_target ± 5 kcal`.
- Carb adjustment corrects discrepancy > 5 kcal.
- Serving-size scaling: `(qty / ref) × nutrient`.
- Missing-data handling: `dataComplete: false` food not counted in aggregate totals for that nutrient.
- Invalid inputs: non-numeric, out-of-range, missing sex (no BMR without sex).
- Weight-log edit replaces (no duplicate dates).
- Calorie surplus/deficit clamped to allowed range.

---

### Milestone 8 — Focus Radio & Remaining Settings

**Goal**: ambient focus soundscapes and complete the settings surface.

**Scope**:
- [ ] YouTube IFrame embed with URL validation (must be a well-formed `youtube.com` or `youtu.be` URL).
- [ ] `onError` handler → "This video cannot be played here" message with guidance.
- [ ] Autoplay blocked → "Click to play" prompt.
- [ ] Pre-seeded playlist of embed-safe URLs (5–10 ambient/lo-fi channels).
- [ ] User-managed URL list (add / remove / reorder).
- [ ] Player controls: play/pause, volume, mute.
- [ ] ICS export: generate RFC 5545-compliant VEVENT blocks for reminders and planner tasks with due dates (< 100-line custom builder, no library).
- [ ] Settings: all remaining fields (background image URL, study-day rollover, weekly question target, meal category visibility, review interval).
- [ ] Full reset (two-step: type "RESET").
- [ ] App version display.

**Tests**:
- URL validator accepts valid YouTube URLs, rejects non-YouTube and malformed URLs.
- ICS output contains valid DTSTART, DTEND, SUMMARY fields and can be parsed by a reference parser.
- Two-step reset requires exact string "RESET" before wiping data.

---

### Milestone 9 — Polish, Testing & PWA Preparation

**Goal**: production quality, comprehensive tests, offline readiness.

**Scope**:
- [ ] Accessibility audit: focus rings, ARIA labels, chart descriptions, contrast check on all new components.
- [ ] Reduced-motion audit: all new animations respect `prefers-reduced-motion`.
- [ ] Responsive check: all new views at 375px, 768px, 1280px, 1440px, 1920px.
- [ ] Expand test coverage to all new calculation modules.
- [ ] Service Worker (basic offline caching of app shell — no background timers or push notifications in this milestone).
- [ ] PWA manifest (`manifest.json`, icons).
- [ ] README.md: complete setup guide, module descriptions, data location, backup/restore instructions.
- [ ] Performance: Lighthouse audit, lazy-load heavy modules (Nutrition catalogue, Recharts).

---

## 5. Implementation Order Rationale

```
M1 (done) → M2 (profile/settings: unlocks countdown + personalization)
          → M3 (syllabus: foundational for focus/planner integration)
          → M4 (enhanced focus: depends on unified subject list from M3)
          → M5 (planner + questions: depends on syllabus subtopic links)
          → M6 (mock tests + error log: depends on planner + syllabus)
          → M7 (nutrition: large but independent; can start after M2 profile)
          → M8 (radio + settings: small, fills gaps)
          → M9 (polish: runs in parallel with later milestones)
```

M7 (nutrition) is independent enough to be worked on in parallel with M3–M6 once M2 (profile) is done, if bandwidth allows.

---

## 6. Dependency & Feasibility Assessment

| Feature | Verdict | Notes |
|---------|---------|-------|
| PiP timer | ✅ Feasible | `document.requestPictureInPicture()` on canvas-in-video. Feature-detected, gracefully disabled. |
| Browser background timer | ⚠️ Unreliable | `setInterval` throttled on mobile. State persisted per second. Honest warning shown. |
| Alarm on browser close | ❌ Not deliverable | Requires Service Worker + Push subscription (needs backend). Deferred. |
| YouTube IFrame embeds | ✅ Feasible | Standard embed API. Autoplay blocked by browsers — handled. Non-embeddable detected via `onError`. |
| Timetable OCR | 🔬 Spike needed | Tesseract.js is viable but accuracy on schedule images is variable. Do not implement until a focused spike confirms acceptable quality. |
| Nutrition data (offline) | ✅ Feasible | Open Food Facts curated subset. ~500–800 food static JSON. No API key. Nutrient completeness must be surfaced. |
| ICS export | ✅ Feasible | < 100-line custom VEVENT builder. No library. |
| Recharts | ✅ Feasible | ~140 kB minified, tree-shakable. Introduce only in M4/M7 when complex charts are needed. |
| IndexedDB migration | 🔜 Future | `IStorageService` interface makes this a one-file swap when needed. |
| Paid APIs | ✅ None required | All planned features work without paid services. |

---

## 7. Verification Strategy

Each milestone must satisfy all of the following before the next begins:

1. **All prior tests still pass** (`npm test -- --run`).
2. **Production build succeeds** (`npm run build`), zero TypeScript errors.
3. **New unit tests written** for every calculation, date arithmetic, and edge case introduced.
4. **Browser check**: app launched (`npm run dev`), rendered at 1440px width in both light and dark themes, no console errors.
5. **No regression** in previously working interactions (manual smoke test of Dashboard, Attendance mark, Focus timer, Gym set toggle).

---

## 8. Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev          # → http://localhost:5173/

# Run tests
npm test -- --run    # Single-pass (CI)
npm test             # Watch mode (development)

# Production build
npm run build        # tsc + vite build → dist/

# Preview production build
npm run preview
```

---

## 9. Known Issues & Pre-existing Technical Debt

| Issue | Impact | Resolution |
|-------|--------|-----------|
| `espresso-850` / `espresso-750` used in JSX but not defined in `tailwind.config.js` | Renders as empty string (silent) | Define these shades in `tailwind.config.js` in M2 |
| Google Fonts require internet connection | Offline: falls back to Georgia / system-ui / Menlo | Acceptable; document in README |
| No Service Worker | No offline app shell | Deferred to M9 |
| `localStorage` 5 MB browser limit | Nutrition catalogue must be bundled as static JS, not stored in localStorage | Food catalogue is imported as a module, not persisted |
| Timer drift when tab is backgrounded | Honest warning displayed | Documented as known constraint in M4 |
