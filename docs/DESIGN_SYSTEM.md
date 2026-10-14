# TRACKER — Design System & Style Guide
*Editorial Daily Operating System · Version 2.0*

**Aesthetic Direction**: Ventriloc-inspired editorial minimalism. Warm ivory paper, deep espresso inks, restrained terracotta accents, editorial serif display typography, refined sans-serif UI typography, generous layout rhythm, and subtle tactile microinteractions.

> All existing visual decisions below remain in force. New additions are marked **[NEW]**.

---

## 1. Editorial Typography

- **Display & Section Titles (Serif)**:
  `font-serif`: `"Playfair Display"`, `Newsreader`, `Canela`, `Georgia`, `serif`
  - High-contrast, elegant proportions, literary dignity.
  - Used for page headings, date banners, hero metric numbers, and editorial pull-quotes.
- **Interface & Data (Sans-Serif)**:
  `font-sans`: `"Plus Jakarta Sans"`, `Inter`, `-apple-system`, `sans-serif`
  - Crisp, ultra-legible, geometric humanist details.
  - Used for navigation, cards, tables, data numbers, buttons, form controls, and badges.
- **Monospace & Timestamps**:
  `font-mono`: `"JetBrains Mono"`, `Menlo`, `monospace`
  - Clean, subtle spacing for time ranges (e.g. `09:00 — 10:15`) and calculation formulas.

**[NEW] Tabular Numerals**: apply `font-variant-numeric: tabular-nums` (via the `.tabular-nums` CSS utility) to all timer displays, countdown numbers, nutrition totals, and statistical values so digits do not shift width on update.

---

## 2. Color Palette & Theme Tokens

### Light Theme (Warm Ivory & Espresso)
- **App Canvas (`--bg-app`)**: `#FAF7F2` (Warm Ivory / Natural Linen)
- **Surface / Cards (`--bg-surface`)**: `#FFFFFF` (Crisp Paper)
- **Subtle Surface (`--bg-subtle`)**: `#F3EFE8` (Toned Vellum)
- **Dividers & Hairlines (`--border`)**: `#E6DFD5` (Soft Stone)
- **Deep Text (`--text-primary`)**: `#1C1917` (Deep Espresso / Stone 900)
- **Muted Text (`--text-secondary`)**: `#6E6760` (Warm Taupe / Stone 600)
- **Faint Text (`--text-muted`)**: `#A39B92` (Subtle Umber)

### Dark Theme (Deep Espresso & Warm Cream)
- **App Canvas (`--bg-app`)**: `#12100E` (Midnight Espresso)
- **Surface / Cards (`--bg-surface`)**: `#1A1715` (Dark Roasted Bean)
- **Subtle Surface (`--bg-subtle`)**: `#24201D` (Charred Walnut)
- **Dividers & Hairlines (`--border`)**: `#322B26` (Warm Dark Border)
- **Light Text (`--text-primary`)**: `#F6F3EE` (Warm Antique Cream)
- **Muted Text (`--text-secondary`)**: `#A8A096` (Weathered Parchment)
- **Faint Text (`--text-muted`)**: `#6E665E` (Dim Bronze)

### Editorial Accent Palette
- **Terracotta Accent** *(primary brand)*:
  - Light: `#C45532`, soft wash: `#FBF2ED`
  - Dark: `#DE6C47`, soft wash: `#341E16`
- **Sage Olive** *(positive / attendance safe / nutrition on-target)*:
  - Light: `#436650`, soft wash: `#EDF3EE`
  - Dark: `#689778`, soft wash: `#182A1F`
- **Warm Ochre / Amber** *(attention / low margin / near-target)*:
  - Light: `#B8732E`, soft wash: `#FCF6EC`
  - Dark: `#D9944D`, soft wash: `#2E2012`
- **Deep Venetian Red** *(danger / deficit / over-budget)*:
  - Light: `#B33939`, soft wash: `#FDF0F0`
  - Dark: `#D95B5B`, soft wash: `#331515`

**[NEW] Accent Color Options** *(user-selectable in Settings, preserves editorial integrity)*:

| Key | Light value | Dark value | Personality |
|-----|------------|------------|-------------|
| `terracotta` | `#C45532` | `#DE6C47` | Default brand warmth |
| `sage` | `#436650` | `#689778` | Calm, focused |
| `ochre` | `#B8732E` | `#D9944D` | Alert, energetic |
| `dusty-blue` | `#3D6A8A` | `#5B8FAD` | Cool, scholarly |
| `plum` | `#6B3F6B` | `#9B6D9B` | Rich, creative |
| `slate` | `#4A5568` | `#718096` | Neutral, minimal |

Only these six are offered. A free-form hex picker is not provided — it would allow combinations that violate contrast and editorial tone.

---

## 3. Layout Rhythm & Elevation

- **Card Styling**: hairline warm border (`1px solid var(--border)`), minimal flat elevation (`shadow-[0_1px_3px_rgba(0,0,0,0.04)]`), rounded corners (`rounded-xl` / 14px).
- **Whitespace**: generous vertical pacing (`gap-6`, `py-8`, `px-8`), breathing room between modules.
- **Section Dividers**: fine editorial rules with metadata timestamps.
- **Main Container**: fluid, `max-w-[1680px] 2xl:max-w-[1840px]`, consistent `xl:px-10` side gutters. `min-w-0` on all flex/grid children.
- **Two-column layouts**: use explicit `grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]` rather than 12-column class arithmetic.

**[NEW] Background Styles** *(applied via CSS class on `<body>`, default is Minimal)*:
- `bg-style-minimal` — no decoration, `--bg-app` solid fill.
- `bg-style-abstract` — subtle large-radius blurred gradient blobs using palette colors at 4% opacity. No jarring visuals.
- `bg-style-space` — very dark background with tiny static star-like dots (CSS only, `radial-gradient`). Only meaningful in dark mode; falls back to Minimal in light mode.
- `bg-style-ocean` — soft horizontal gradient from pale blue-green to warm ivory. Only meaningful in light mode; falls back to Minimal in dark mode.
- `bg-style-custom` — user-provided URL set as `background-image: url(...)`. Falls back to Minimal if image fails to load.

---

## 4. UI Components & States

- **Status Pills**: delicate editorial capsules with subtle border and low-saturation pastel tints.
- **Sample vs Real Data Badge**: discerning stamp `[DEMO DATA]` with 1-click option to toggle or purge.
- **Buttons**:
  - *Primary*: deep espresso background in light mode (cream in dark mode), subtle scale down on active.
  - *Secondary*: subtle ivory/stone button with crisp hairline border.
  - *Terracotta Action*: reserved for core triggers (e.g., "Start Focus", "Mark Attendance").
- **Empty States**: quiet, thoughtful illustration/typography prompting the first action without jarring loudness.

**[NEW] Nutrition-specific components**:
- **Macro donut chart**: three-segment ring (protein = sage, carbs = ochre, fat = terracotta). Rendered with a small SVG path, no external chart library required for this shape. A missing-data notice is shown below if any food lacks macro data.
- **Nutrient progress bar**: thin, editorial bar using sage for ≤ 80% of target, ochre for 80–100%, venetian red for > 110%. Bar label uses `font-mono` for the numeric value.
- **[ESTIMATE] label**: shown inline next to any value derived from the Mifflin–St Jeor formula. Uses `text-muted` color and `text-xs` size to be informational without being alarming.
- **Food card**: compact item showing name, serving, and the four core macros in a single row. Absent values shown as `—` in `text-muted`. Custom foods have a small `[Custom]` badge.

**[NEW] Syllabus-specific components**:
- **Chapter accordion**: header row with chapter name, progress fraction, and a chevron. Expanded state shows subtopic list with status icons.
- **Status icons**: `○` not started (muted), `◑` in progress (ochre), `●` done (sage), `↺` revision needed (terracotta).
- **PYQ chip**: small `PYQ` badge in dusty-blue when past-year question coverage is marked.

**[NEW] Countdown panel** *(Dashboard, Exam Countdown)*:
- Large serif number for days remaining (same editorial treatment as hero metric numbers).
- Three-row sub-stats (Sundays, sleep hours, study-time scenarios) in compact `font-sans text-sm` with `text-secondary` labels.
- Hidden entirely when no exam date is configured.

---

## 5. Accessibility & Motion

- All interactive elements have `:focus-visible` rings in the active accent color (3px offset, 2px ring width).
- `@media (prefers-reduced-motion: reduce)` disables all CSS transitions and animations. Timer updates use `will-change: contents` not `will-change: transform` to avoid layout thrash.
- Color is never the sole indicator of state — status icons, text labels, or patterns accompany all color cues.
- Touch targets: minimum `44 × 44 px` on mobile for all interactive elements.
- Contrast: all text/background combinations meet WCAG AA (4.5:1 for body, 3:1 for large text and UI components). The editorial palette was chosen with this constraint in mind; accent combinations must be verified when new accent colors are added.

---

## 6. Chart & Data Visualization Standards

**[NEW]** All charts in this application follow these rules:

1. **Source transparency**: every chart has a small caption noting its data source (e.g., "From your logged sessions · Last 7 days"). Sample data charts are labelled `[DEMO DATA]`.
2. **Empty state**: a chart with no real data shows a quiet empty state (no fake bars or placeholder curves).
3. **No external chart libraries** for simple shapes: donut charts, simple bar charts, and progress rings are implemented with inline SVG or CSS. A lightweight library (e.g., Recharts, which is already dependency-free and tree-shakable) may be introduced for the weekly study time and weight history charts after approval.
4. **Consistent colors**: chart segments use the editorial accent palette. Arbitrary colors are not introduced for chart segments.
5. **Accessibility**: charts have `aria-label` descriptions summarizing the data for screen readers.

---

## 7. Forms & Validation

**[NEW]**

- Inline validation: errors appear below the field immediately on blur (not only on submit).
- Error text: `text-venetian-red text-xs font-sans`, shown with an `×` icon.
- Success text: `text-sage text-xs font-sans`, shown with a `✓` icon.
- Numeric fields: show the valid range as `placeholder` text (e.g., `e.g. 70` for weight).
- Destructive confirmations: red-bordered modal with explicit warning text. Two-step for full reset (type "RESET").
- Cross-field consistency errors (e.g., macro totals not matching calorie target) are shown as a banner below the form group, not as individual field errors.
