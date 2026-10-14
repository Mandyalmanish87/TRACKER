# TRACKER — Product Specification
*Personal Daily Operating System · Version 2.0*

**Last updated**: October 14, 2026  
**Status**: Approved for phased implementation

---

## 0. Vision

TRACKER is a premium, fully private, local-first personal operating system for focused students and athletes. It unifies academic management, deep-focus study, fitness, and nutrition into one deliberately designed application. The aesthetic is inspired by Ventriloc's editorial minimalism: warm ivory paper, deep espresso type, restrained terracotta accents, and generous breathing room.

All data stays on the user's device. No accounts, no cloud sync, no paid services required at any stage.

---

## 1. Modules Overview

| # | Module | Status |
|---|--------|--------|
| 1 | Dashboard & Exam Countdown | Active (Milestone 1 delivered) |
| 2 | Syllabus Tracker | Planned |
| 3 | Deep-Focus System | Active (basic timer delivered; enhancement planned) |
| 4 | Study Planner | Planned |
| 5 | Mock-Test Analytics | Planned |
| 6 | Error Log | Planned |
| 7 | Daily Question Tracker | Planned |
| 8 | Focus Radio | Planned |
| 9 | Personalization & Settings | Active (theme delivered; enhancement planned) |
| 10 | College Attendance & Timetable | Active (Milestone 1 delivered) |
| 11 | Gym & Nutrition | Active (gym delivered; nutrition planned) |
| 12 | Friends & Accountability | **Deferred — do not build** |
| 13 | Kio AI Study Mentor | **Deferred — do not build** |

---

## 2. Module Specifications

---

### Module 1 — Dashboard & Exam Countdown

#### 1.1 Daily Command Center
- **Personalized greeting** using the display name set in Settings.
- **Quick Stats Ribbon**: today's class count, overall attendance %, daily study minutes logged, gym completion status, pending reminders.
- **Today's Schedule Widget**: time-ordered list of today's timetable slots with auto-highlight of the ongoing or next class. Attendance can be marked directly.
- **Attendance Health Gauge**: per-subject percentage, safety margin or deficit, and the aggregate cross-subject figure.
- **Focus Timer Widget**: launch Pomodoro or custom timer directly from the dashboard; session is linked to the selected subject.
- **Gym Split Widget**: today's scheduled split with set toggling and overall completion status.
- **Urgent Checklist**: top high-priority reminders with one-tap completion toggle.

#### 1.2 Exam Countdown
- User sets a named exam and an exam date in Settings.
- Dashboard shows: **days remaining**, **Sundays remaining** (as non-study rest days), **approximate sleep time remaining** (days × 8 h), and a **Reality Check** table of study-time scenarios (e.g., 4 h/day, 6 h/day, 8 h/day of effective study).
- Countdown panel is hidden gracefully when no exam date is configured.
- Completed tasks count and daily focused time appear alongside the countdown.

#### 1.3 Data Rules
- Sample records carry `isSample: true` and are always clearly labelled `[DEMO DATA]`.
- Sample data can be cleared without affecting user records.
- Theme preference and display name are persisted separately from domain data.

---

### Module 2 — Syllabus Tracker

#### 2.1 Subject & Chapter Management
- Default subjects: **Physics, Chemistry, Mathematics, Biology** (configurable — user can rename, add, or remove subjects).
- Each subject contains **chapters**; each chapter contains **subtopics**.
- Completion states: `not_started` | `in_progress` | `done` | `revision_needed`.
- **Revision count** per subtopic (incremented each time the user marks it revised).
- **PYQ coverage flag** per subtopic: whether a past-year question from that topic has been attempted.

#### 2.2 UI & Interaction
- Collapsible chapter accordion with subject-level and chapter-level progress bars.
- Global search across subjects, chapters, and subtopics.
- Subject summaries: total subtopics, completed, in-progress, revision-pending.
- **Confirmation required** before any destructive reset (resetting a chapter or subject to "not started").
- Chapter completion requires explicit confirmation if it contains revision-pending subtopics.

#### 2.3 Integration
- Completing a chapter can suggest adding a Mock-Test task (user-confirmed, no silent duplicates).
- Error Log entries link back to specific subtopics, marking them `revision_needed`.

---

### Module 3 — Deep-Focus System

#### 3.1 Timer Modes
- **Flow Timer** (stopwatch — runs until manually stopped).
- **Pomodoro** (25-min work / 5-min break, configurable).
- **Custom Timer** (user-defined duration).
- **Picture-in-Picture (PiP)**: activated via the standard `document.pictureInPictureElement` API on a `<video>` element containing a canvas-drawn timer. Clearly labelled as browser-dependent; gracefully disabled when unsupported.

#### 3.2 Session Linking
- Each session is linked to a **subject** (from the Syllabus Tracker or Attendance subject list) or tagged as "General".
- Subject-linked sessions automatically update that subject's cumulative study-time statistics.
- Session notes field (optional, free text).
- Focus score (1–5 stars, optional).

#### 3.3 Session History & Analytics
- Full persistent session log with date, duration, subject, and notes.
- **Weekly chart**: bar chart of daily study minutes for the past 7 days, derived from real session records only.
- **Streaks**: current and longest daily streak (a day counts if ≥ 1 session was completed).
- **Average daily study time** (rolling 7-day and 30-day windows).
- **Productivity insights**: e.g., most-studied subject, most productive time of day, sessions-per-week trend. All derived from real records.

#### 3.4 Constraints
- Browser timers (`setTimeout`/`setInterval`) pause when the browser tab is backgrounded on mobile or when the device is locked. The UI must display an honest warning: *"Timer may drift when the tab is in the background."*
- No "alarm" feature that promises to ring when the browser is closed — this cannot be reliably delivered without a Service Worker with a Push subscription, which is deferred.
- Timer state is persisted to `localStorage` on every tick so sessions are recoverable after accidental tab closure.

---

### Module 4 — Study Planner

#### 4.1 Daily Tasks
- Create tasks with: title, subject, estimated duration (minutes), due date, priority.
- Workflow states: **To Do → In Progress → Done**.
- Tasks can be linked to a Syllabus subtopic.
- Completing a task can be linked to a Pomodoro session (auto-fills estimated duration).

#### 4.2 Weekly & Long-Term Targets
- Set a weekly study-hour target per subject.
- Set a long-term goal (e.g., "complete Chapter 5 by Oct 20").
- Progress bars show actual vs. target.

#### 4.3 Review Intervals
- Configurable spaced-repetition review interval (e.g., review in 1 day, 3 days, 7 days, 14 days, 30 days).
- Review tasks are created automatically when a subtopic is marked `done`; user can edit or delete them.
- No silent duplicate creation: if a review task for the same subtopic already exists and is pending, a new one is not created.

#### 4.4 Editable Targets
- Weekly and long-term targets can be edited at any time.
- Dashboard reflects the current planner state (today's tasks, tasks completed today).

---

### Module 5 — Mock-Test Analytics

#### 5.1 Test Definition
- User defines test categories (e.g., JEE Full Syllabus, NEET Physics, Chapter Test).
- Each test record stores: category, date, maximum marks, subject-wise mark breakdown (where applicable).

#### 5.2 Score Entry
- Per test: total score, subject-wise scores, questions attempted, questions correct.
- **Score %** = `(score / max_marks) × 100`. Only compared within the same category/max-marks configuration.
- **Accuracy** = `(correct / attempted) × 100`. Displayed as a separate figure, not conflated with score %.
- Target score is configurable per category. Progress toward the target is shown.

#### 5.3 Analytics
- Score history chart (per category, chronological).
- Average score and best score (per category).
- Subject-wise breakdown chart.
- Performance trend (moving average over the last N tests, configurable N).
- Accuracy trend displayed separately from score trend.
- **Important constraint**: tests with different maximum marks are never compared directly. Aggregate averages are computed only within the same category. The UI will make this explicit.

#### 5.4 Integration
- Weak subjects/chapters identified from mock tests can be suggested as revision tasks in the Error Log (user confirms before creating).

---

### Module 6 — Error Log

#### 6.1 Entry Fields
- Subject (from subject list).
- Chapter / subtopic (optional link to Syllabus Tracker).
- Error category: `conceptual` | `calculation` | `silly` | `formula`.
- Description (free text, required).
- Date logged (auto-filled, editable).
- Review status: `pending` | `reviewed`.
- Recurring flag: automatically set if the same chapter accumulates ≥ 3 errors.

#### 6.2 Review History
- Each entry has a review log: date reviewed, notes added on review.
- The recurring-weakness view filters entries by chapter and shows the cluster.

#### 6.3 Integration
- Any entry can be converted into a Study Planner revision task (user confirms, no silent duplicates).
- Entries linked to a Syllabus subtopic set that subtopic to `revision_needed`.

---

### Module 7 — Daily Question Tracker

#### 7.1 Daily Target
- User sets a target number of questions to solve per day.
- For each day the user logs the number of questions solved.
- One log entry per calendar date. Editing the count for today replaces the existing record — no double-counting.

#### 7.2 History & Streak
- Date-keyed records show a calendar or list view of daily counts.
- **Streak**: consecutive days meeting or exceeding the daily target.
- **7-day trend chart**: bar chart of the last 7 days' question counts vs. target.

---

### Module 8 — Focus Radio

#### 8.1 Playback
- User provides a YouTube URL (video or playlist).
- Playback is embedded via the standard YouTube `<iframe>` embed API (no download, no circumvention of platform restrictions).
- The app validates that the URL is a well-formed YouTube URL before attempting embed.

#### 8.2 Honest Constraints
- Autoplay may be blocked by the browser; the UI shows a clear "Click to play" prompt when autoplay is blocked.
- Background playback on mobile depends entirely on the browser and OS — the app does not claim to guarantee it.
- Videos that are not embeddable or are unavailable are detected via the YouTube iframe Player API's `onError` event, and the user is shown an appropriate message with guidance to find an embeddable alternative.
- No audio is downloaded. No platform restrictions are circumvented.

#### 8.3 Controls
- Play / Pause, volume, mute.
- Predefined playlist of embed-safe lo-fi / ambient YouTube URLs provided as a starting point. User can add and remove URLs.

---

### Module 9 — Personalization & Settings

#### 9.1 Appearance
- **Theme**: Light / Dark / System.
- **Accent color**: user selects from a predefined palette of 6 editorial accent colors (not free-form hex to maintain design integrity).
- **Subject-tag colors**: per-subject color selector using the same palette.
- **Background style**: Minimal (default), Abstract, Space, Ocean — applied as a CSS class. No paid asset required.
- **Background image URL**: optional; validated for HTTPS and reasonable length; loaded as a CSS `background-image`. Falls back to Minimal on error.

#### 9.2 Profile
- **Display name**: shown in dashboard greeting.
- **Exam setup**: exam name and exam date for countdown widget.
- **Study-day rollover time**: the hour at which a new "study day" begins (default: 00:00; can be set to e.g., 04:00 for late-night studiers).

#### 9.3 Data Management
- **JSON export**: exports the full `AppStateData` object as a timestamped `.json` file.
- **JSON import**: validates the schema before applying; prompts the user to confirm before overwriting existing data.
- **ICS export**: exports reminders and due-date tasks as an `.ics` calendar file (RFC 5545 compliant, no external library required for the basic subset).
- **Reset**: wipes all user data and resets to the empty state. Requires a two-step confirmation ("Type RESET to confirm").

#### 9.4 App Info
- Version string, last-modified date.
- Refresh guidance (hard reload instructions for stale cache).

---

### Module 10 — College Attendance & Timetable

*Preserves and extends Module 2.2 from the original spec.*

#### 10.1 Timetable Entry
- Manual entry via the existing timetable editor (day, time, subject, room, instructor).
- **Image/PDF upload** (future enhancement): OCR extraction of schedule from a photo or PDF. Results are shown as a review-and-correct form before being committed. **This is a stretch goal** — it requires Tesseract.js or a similar offline OCR library and will be assessed for feasibility separately. Do not implement OCR until the feasibility assessment is complete.
- Recurring schedule: slots repeat weekly by default; one-off cancellations can be recorded.

#### 10.2 Attendance
- Mark each slot: **Present / Absent / Cancelled** (cancelled does not count toward conducted).
- Attendance logs are date-keyed and slot-keyed.
- Per-subject attendance: `attended` / `totalConducted`, configurable target %.
- **Safety calculation** uses the validated formula in `src/utils/attendance.ts`: no rounding error, correct boundary handling.

#### 10.3 Simulator
- User can ask: "If I skip N more classes, what will my attendance be?"
- If attendance is below target: "How many consecutive classes do I need to attend to recover?"
- These are projections, not predictions.

---

### Module 11 — Gym & Nutrition

#### 11.1 Gym (Existing — Preserved)
- Preset and custom workout splits (Push / Pull / Legs / Upper / Lower / Full Body / Rest / Custom).
- Per-split exercise list with sets (reps, weight kg, completion toggle).
- Workout notes.
- Streak counters (current and longest).
- Weekly consistency view.

#### 11.2 Nutrition — Food Diary

##### 11.2.1 Meal Categories
Each day is divided into meals: **Breakfast, Lunch, Dinner, Snacks, Pre-Workout, Post-Workout** (the last two are optional and can be hidden in settings).

##### 11.2.2 Food Search & Entry
- Searchable food catalogue.
- MVP food data source: **Open Food Facts** curated offline JSON subset (no API key, MIT-compatible license) for common foods, or a manually curated catalogue of ~500 common Indian and international foods. The chosen source and any estimated values are labelled explicitly.
- Each food entry stores: name, standard serving size and unit, and per-100g or per-serving nutrient values.
- Users can add **custom foods** with manually entered nutrient values. Custom entries are labelled `[Custom]`.
- Users can define **recipes** (named groups of food items + quantities) that appear as single searchable entries.

##### 11.2.3 Nutrients Tracked
**Always shown:**
- Energy (kcal)
- Protein (g)
- Carbohydrates (g) — total
- Fats (g) — total

**Shown when available in the data source:**
- Saturated fats (g)
- Dietary fiber (g)
- Sugar (g)

**Shown when available (collapsed under "More nutrients"):**
- Vitamins: A, C, D, B12, Folate (when available)
- Minerals: Iron, Calcium, Potassium, Sodium, Zinc (when available)

**Honest missing-data handling**: if a nutrient value is unavailable for a food, it is shown as `—` (not `0`). A missing value is never silently counted as zero in aggregates. Per-day totals note the number of foods with incomplete data.

##### 11.2.4 Aggregation
- **Per-food**: nutrients for the logged serving.
- **Per-meal**: sum of all foods within that meal for the day.
- **Daily totals**: sum across all meals.
- **Macro distribution chart**: donut chart of calories from protein / carbs / fat (only counts foods with complete macro data; missing foods are noted).

##### 11.2.5 History
- Diary entries are date-keyed. Past dates are viewable and editable.
- Each entry records the timestamp of last edit to prevent silent double-counting from repeated form submissions.

##### 11.2.6 Serving Sizes & Units
- Serving sizes are stored in the unit native to the food (g, ml, piece, cup, tbsp, etc.).
- When logging, the user enters a quantity and selects a unit from the food's available units.
- Nutrient values are scaled proportionally: `(logged_quantity / reference_quantity) × nutrient_value`.
- Rounding: display to 1 decimal place for macros, 0 decimals for kcal.

---

### Module 11.3 — Fitness & Nutrition Onboarding

#### 11.3.1 Goal Selection
Users choose one of:
- **Bulk / Muscle Gain** — calorie surplus, higher protein target.
- **Cut / Fat Loss** — calorie deficit, maintained protein to preserve muscle.
- **Maintain** — calories at estimated TDEE, balanced macros.

All goal-selection options can be changed at any time in Settings.

#### 11.3.2 Optional Profile Inputs
All fields are optional. The app functions fully without any profile data, with the user setting targets manually.

| Field | Notes |
|-------|-------|
| Age | Integer, ≥ 10. Required for BMI and energy calculations when provided. |
| Height | cm (metric) or ft+in (imperial). Validated: 50–300 cm. |
| Current weight | kg (metric) or lb (imperial). Validated: 20–500 kg. |
| Biological sex | `male` / `female` / `prefer not to say`. Used only in energy estimation formula. If omitted, a sex-neutral estimate is used or targets must be entered manually. |
| Activity level | Sedentary / Lightly active / Moderately active / Very active / Extra active. Maps to Mifflin–St Jeor activity multipliers. |

#### 11.3.3 BMI Calculation
```
BMI = weight_kg / (height_m)²
```
- Height and weight are converted to metric before calculation.
- Interpretation for adults (≥ 18): WHO standard cutoffs (Underweight < 18.5, Normal 18.5–24.9, Overweight 25–29.9, Obese ≥ 30).
- Interpretation for minors (10–17): age-and-sex-specific percentile language (`< 5th percentile`, `5th–85th`, `85th–95th`, `≥ 95th`). The app does **not** apply adult cutoffs to minors. The interpretation text notes that clinical assessment requires a healthcare professional.
- BMI is displayed as an informational figure only. No body composition inference is made from BMI alone.
- Invalid inputs (non-numeric, out of range) produce a visible validation error, not a silent NaN.

#### 11.3.4 Energy Estimation — Mifflin–St Jeor Formula
```
BMR (male)   = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
BMR (female) = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
```
Activity multipliers (Harris–Benedict standard):

| Level | Multiplier |
|-------|-----------|
| Sedentary (little/no exercise) | 1.2 |
| Lightly active (1–3 days/week) | 1.375 |
| Moderately active (3–5 days/week) | 1.55 |
| Very active (6–7 days/week) | 1.725 |
| Extra active (physical job + training) | 1.9 |

`TDEE = BMR × activity_multiplier`

Goal adjustments (conservative, configurable within the allowed range):

| Goal | Default adjustment | Allowed range |
|------|--------------------|--------------|
| Bulk | +250 to +500 kcal | +100 to +1000 kcal |
| Cut | −250 to −500 kcal | −750 to −100 kcal |
| Maintain | 0 kcal | 0 kcal |

If biological sex is not provided, the formula cannot be applied. The UI shows a message explaining this and offers a **Manual calorie target** field instead.

All outputs are labelled: *"Estimated daily calorie target — consult a registered dietitian for medical guidance."*

**Manual override**: user can always replace the calculated target with a manually entered value.

#### 11.3.5 Macro Targets
Derived consistently from the calorie target to avoid arithmetic discrepancies:

| Macro | Bulk | Cut | Maintain |
|-------|------|-----|---------|
| Protein | 2.0–2.2 g/kg body weight | 2.2–2.4 g/kg (to preserve muscle) | 1.6–2.0 g/kg |
| Fat | ~25–30% of kcal | ~25–30% of kcal | ~25–30% of kcal |
| Carbs | Remaining kcal ÷ 4 | Remaining kcal ÷ 4 | Remaining kcal ÷ 4 |

Calorie consistency check (always enforced):
```
total_kcal = (protein_g × 4) + (carbs_g × 4) + (fat_g × 9)
```
If rounding causes a discrepancy > 5 kcal, carbs are adjusted by ±1 g to restore consistency.

All macro targets are editable by the user after calculation. The UI notes when manual edits cause the total to diverge from the calorie target.

#### 11.3.6 Weight History & Target Recalibration
- User logs current weight on any date. One log entry per day (editing replaces, does not duplicate).
- **Weight history chart**: line chart of logged weights over time.
- **Review process**: after 2 weeks of weight logs, the app calculates the weekly trend (linear regression on logged weights) and compares it to the expected trend for the selected goal (e.g., ~0.25–0.5 kg/week gain for bulk).
- If the trend diverges significantly from the goal (> 50% off), the app surfaces a recalibration suggestion: *"Your weight has changed by X over Y weeks. Would you like to recalculate targets?"* — user must confirm.
- Recalibration uses the same Mifflin–St Jeor formula with the updated weight.
- Daily fluctuations (< 1 kg) are not acted upon.

#### 11.3.7 Privacy & Sensitive Data
- All body measurements are stored locally in `localStorage`, never transmitted.
- All profile fields can be individually deleted or cleared from Settings.
- The onboarding flow can be skipped entirely; modules function without profile data.
- The app explicitly states: *"These are estimates, not medical advice. Consult a qualified professional for health or medical decisions."*

---

### Module 12 — Friends & Accountability
**DEFERRED.** No social infrastructure, shared data, or network communication will be built in this phase. The data model will not include user IDs, friend lists, or shared records that would complicate a later addition.

---

### Module 13 — Kio AI Study Mentor
**DEFERRED.** No AI API integration, prompt engineering, or AI-specific UI will be built in this phase. The module will be designed as an optional add-on that requires no changes to the core data model when added later.

---

## 3. Cross-Module Data Integration

| Action | Effect |
|--------|--------|
| Complete a Pomodoro session (linked to subject) | Updates subject's cumulative study time; shows on Dashboard today-stats |
| Mark a Study Planner task Done | Updates Dashboard completed-tasks count |
| Complete a Syllabus chapter | Prompts: suggest Mock-Test task? (user confirms) |
| Add an Error Log entry with subtopic link | Sets that subtopic to `revision_needed` in Syllabus Tracker |
| Convert Error Log entry to revision task | Creates Study Planner task (checks for existing pending task first) |
| Mock-test identifies a weak chapter | Suggests Error Log entry (user confirms) |
| Log a gym workout | Updates gym streak; contributes to fitness summary |
| Log food diary entries | Aggregates to daily nutrition totals; macro chart updates |
| Mark attendance on timetable slot | Updates subject `attended` / `totalConducted` counters |

**Rule**: no cross-module integration creates records silently. Every cross-module action is user-confirmed or presented as a suggestion.

---

## 4. Data Architecture

### 4.1 Storage Key Versioning
- Current key: `tracker_app_data_v1`
- On version bump (schema changes): a migration function reads v1 and writes v2. Old key is preserved until confirmed working.

### 4.2 AppStateData (Current — v1)
```typescript
interface AppStateData {
  subjects: Subject[];
  timetable: TimetableSlot[];
  attendanceLogs: AttendanceLog[];
  studySessions: StudySession[];
  gymWorkouts: GymWorkout[];
  reminders: Reminder[];
  hasSampleData: boolean;
}
```

### 4.3 Planned AppStateData (v2 — not yet implemented)
```typescript
interface AppStateData {
  // --- Meta ---
  schemaVersion: 2;
  hasSampleData: boolean;

  // --- Profile & Settings ---
  profile: UserProfile;
  settings: AppSettings;

  // --- Academic ---
  subjects: Subject[];
  timetable: TimetableSlot[];
  attendanceLogs: AttendanceLog[];
  syllabusSubjects: SyllabusSubject[];   // Module 2
  studySessions: StudySession[];
  studyPlannerTasks: PlannerTask[];       // Module 4
  mockTests: MockTest[];                  // Module 5
  errorLogs: ErrorLogEntry[];             // Module 6
  questionLogs: QuestionLog[];            // Module 7

  // --- Fitness & Nutrition ---
  gymWorkouts: GymWorkout[];
  foodDiaryEntries: FoodDiaryEntry[];     // Module 11
  weightLogs: WeightLog[];                // Module 11.3
  customFoods: CustomFood[];              // Module 11
  recipes: Recipe[];                      // Module 11

  // --- General ---
  reminders: Reminder[];
  focusRadioUrls: RadioUrl[];             // Module 8
}
```

### 4.4 New Key Interfaces (v2 additions)
```typescript
interface UserProfile {
  displayName: string;
  examName?: string;
  examDate?: string; // YYYY-MM-DD
  studyDayRolloverHour: number; // 0–23, default 0
  fitnessGoal?: 'bulk' | 'cut' | 'maintain';
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  biologicalSex?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  manualCalorieTarget?: number;
  manualProteinG?: number;
  manualCarbsG?: number;
  manualFatG?: number;
}

interface AppSettings {
  theme: ThemeMode;
  accentColor: AccentColorKey;
  backgroundStyle: 'minimal' | 'abstract' | 'space' | 'ocean';
  backgroundImageUrl?: string;
  hideMealCategories: ('pre_workout' | 'post_workout')[];
  reviewIntervalDays: number; // spaced repetition default
  dailyQuestionTarget: number;
  weeklyStudyTargetMinutes: number;
}

interface SyllabusSubject {
  id: string;
  name: string;
  color: string;
  chapters: SyllabusChapter[];
}

interface SyllabusChapter {
  id: string;
  name: string;
  subtopics: Subtopic[];
}

interface Subtopic {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'done' | 'revision_needed';
  revisionCount: number;
  pyqCovered: boolean;
  lastRevised?: string; // ISO date
}

interface PlannerTask {
  id: string;
  title: string;
  subjectId?: string;
  subtopicId?: string;
  estimatedMinutes?: number;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  reviewIntervalDays?: number;
  isSample?: boolean;
}

interface MockTest {
  id: string;
  category: string;
  date: string;
  maxMarks: number;
  score: number;
  subjectBreakdown?: { subjectId: string; maxMarks: number; score: number }[];
  questionsAttempted?: number;
  questionsCorrect?: number;
  notes?: string;
  isSample?: boolean;
}

interface ErrorLogEntry {
  id: string;
  subjectId: string;
  chapterId?: string;
  subtopicId?: string;
  category: 'conceptual' | 'calculation' | 'silly' | 'formula';
  description: string;
  dateLogged: string;
  reviewStatus: 'pending' | 'reviewed';
  reviewHistory: { date: string; notes: string }[];
  isSample?: boolean;
}

interface QuestionLog {
  date: string; // YYYY-MM-DD, primary key (one record per date)
  count: number;
  lastEditedAt: string; // ISO timestamp
}

interface FoodDiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre_workout' | 'post_workout';
  foodId: string; // references food catalogue or custom food
  quantity: number;
  unit: string;
  nutrientsAtLogTime: NutrientValues; // snapshot of nutrients at time of logging
  loggedAt: string; // ISO timestamp
  lastEditedAt: string;
}

interface NutrientValues {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  saturatedFatG?: number;
  fiberG?: number;
  sugarG?: number;
  vitaminA_mcg?: number;
  vitaminC_mg?: number;
  vitaminD_mcg?: number;
  vitaminB12_mcg?: number;
  folate_mcg?: number;
  ironMg?: number;
  calciumMg?: number;
  potassiumMg?: number;
  sodiumMg?: number;
  zincMg?: number;
  dataComplete: boolean; // false if any core macro is missing
}

interface WeightLog {
  date: string; // YYYY-MM-DD, primary key
  weightKg: number;
  loggedAt: string;
}

interface CustomFood {
  id: string;
  name: string;
  servingSize: number;
  servingUnit: string;
  per100g: NutrientValues;
  isRecipe: boolean;
  recipeIngredients?: { foodId: string; quantity: number; unit: string }[];
}

interface RadioUrl {
  id: string;
  label: string;
  url: string;
  addedAt: string;
}
```

### 4.5 Migration Strategy
- Each schema version has a `migrate_vN_to_vM(old: unknown): AppStateDataVm` pure function.
- On app load: read raw JSON, check `schemaVersion` field, apply migrations in sequence.
- Migration functions are unit-tested independently.
- Old storage key is preserved until the user explicitly clears old data.

---

## 5. Data Integrity & Privacy

- **100% Local-First**: no external network requests for any core feature.
- **Internet-dependent features**: Google Fonts (graceful fallback), Focus Radio YouTube embeds, any future OCR cloud fallback.
- **Input validation**: all numeric inputs clamped and validated before storage. Invalid states produce visible error messages, never silent NaN or Infinity.
- **Destructive operations**: always require explicit user confirmation. Reset requires typing "RESET".
- **JSON export/import**: export includes `schemaVersion`. Import validates schema version and prompts migration if needed. Import never silently overwrites without confirmation.
- **ICS export**: generates valid RFC 5545 VEVENT blocks from reminders and planner tasks. No external library required for the basic subset used here.
- Sample data (`isSample: true`) is always clearly labelled in the UI and can be cleared without touching user records.

---

## 6. Feasibility Notes

| Feature | Assessment |
|---------|-----------|
| **PiP timer** | Feasible via `document.requestPictureInPicture()` on a `<video>` with canvas-drawn timer. Chrome/Edge support good; Firefox requires flag; Safari partial. Must be hidden/disabled gracefully when unsupported. |
| **Browser background timer** | Unreliable on mobile. `setInterval` throttled when tab is hidden. Honest warning required. Timer state persisted to `localStorage` every second for recovery. |
| **Alarm / notification on browser close** | Not deliverable without a Service Worker + Push subscription (backend required). Deferred. |
| **YouTube embeds** | Feasible via YouTube IFrame API. Autoplay blocked by most browsers without user gesture. Non-embeddable videos detected via `onError`. No download or circumvention attempted. |
| **Timetable OCR** | Tesseract.js (~4 MB wasm) can do offline OCR but accuracy on schedule images varies significantly. Classified as a stretch goal; requires feasibility spike before implementation. |
| **Nutrition data (offline)** | Open Food Facts provides a free, offline-usable dataset (ODbL licence). A curated 500–1000 item subset for common foods is feasible without any API key. Nutrient completeness varies by food; must be surfaced to user. |
| **ICS export** | Feasible with a small custom builder (< 100 lines). No library needed for the basic VEVENT subset. |
| **Paid APIs** | Zero paid APIs required for any planned feature. |

---

## 7. Working Features to Preserve

The following features are fully implemented and tested. They must not be regressed by any future milestone:

1. **ThemeProvider** — Light / Dark / System with zero-flicker `<script>` in `index.html`.
2. **Dashboard** — All five widgets: TodayScheduleWidget, AttendanceGaugeWidget, FocusWidget, GymSplitWidget, RemindersWidget.
3. **Attendance math engine** (`src/utils/attendance.ts`) — Validated by 7 unit tests. Correct safe-skip and needed-classes formulas.
4. **StorageService** (`IStorageService` interface over `LocalStorageService`) — `loadData`, `saveData`, `loadTheme`, `saveTheme`, `populateSampleData`, `clearSampleData`, `exportBackup`, `importBackup`.
5. **Sample / user data separation** — `isSample: true` pattern; clear-sample-data removes only sample records.
6. **AppContext** — All action handlers: `markAttendance`, `addStudySession`, `toggleGymSet`, `completeWorkout`, `addReminder`, `toggleReminder`, `deleteReminder`, `populateSampleData`, `clearSampleData`.
7. **Navigation** — Dashboard, Timetable, Attendance, Focus, Gym, Reminders tabs.
8. **TimetableView** — Weekly grid, slot management.
9. **AttendanceView** — Per-subject attendance management and simulator.
10. **FocusView** — Timer with Pomodoro/Flow/Custom modes, session logging.
11. **GymView** — Split management, exercise logging.
12. **RemindersView** — Priority filtering, CRUD.
13. **Common components** — `Card`, `Button`, `Badge`, `ProgressBar`, `EmptyState`, `Header`, `Navigation`, `ThemeToggle`.
14. **Test suite** — 11 tests passing (7 unit + 4 component). All must continue to pass.
15. **Production build** — `tsc && vite build` succeeds with zero TS errors.

---

## 8. Deferred & Out of Scope

- Friends & accountability (Module 12) — deferred entirely.
- Kio AI Study Mentor (Module 13) — deferred entirely.
- Push notifications / alarms when browser is closed.
- Cloud sync or account system.
- Paid API integrations.
- Timetable OCR (stretch goal, requires separate feasibility spike).
- Service Worker / offline PWA (deferred to a later milestone).
