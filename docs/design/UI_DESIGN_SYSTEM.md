# Personal Intelligence OS — Complete Design System Specification
## Document ID: DESIGN-SYS-2026-V1

---

## 1. Principles of Craftsmanship

Our design language draws inspiration from the restrained, precise interfaces of Linear, Apple, Stripe, and Raycast, adapted to the unique demands of a personal academic and biometric operating system.

### Core Commandments
1. **Never Compensate with Gradients:** Visual hierarchy must be established through type scale, spatial rhythm, and surface contrast. Gradients are reserved solely for subtle ambient lighting and focus timers.
2. **Tabular Precision:** Every number representing time, percentage, weight, calories, or repetitions must utilize monospaced tabular figures (`tabular-nums`) to prevent layout instability during real-time updates.
3. **Restrained Depth:** Avoid muddy drop shadows. Elevation is conveyed through 1px border contrast (`var(--border)`), subtle ambient occlusion shadows, and selective backdrop blur (`backdrop-blur-md`).
4. **Immediate Tactile Feedback:** Every button, tab, and card must communicate its interactive state within 100ms via micro-transitions and accessible focus rings.

---

## 2. Typography Hierarchy

| Style Role | Font Family | Weight | Size / Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | `Playfair Display` | 700 / Bold | 2.5rem (40px) / 1.15 | `-0.025em` | Page main titles, primary dashboard greetings |
| **Display Secondary** | `Space Grotesk` / Sans | 600 / Semi | 1.75rem (28px) / 1.25 | `-0.02em` | Section anchors, feature module headers |
| **Interface Heading** | `Plus Jakarta Sans` | 600 / Semi | 1.125rem (18px) / 1.4 | `-0.015em` | Card titles, modal headers, table groups |
| **Body Primary** | `Plus Jakarta Sans` | 400 / Regular | 0.875rem (14px) / 1.5 | `normal` | General content, descriptions, list items |
| **Body Secondary** | `Plus Jakarta Sans` | 400 / Regular | 0.75rem (12px) / 1.4 | `normal` | Helper text, secondary descriptions |
| **Technical Label** | `JetBrains Mono` | 600 / Bold | 0.6875rem (11px) / 1.0 | `+0.05em` | Category badges, hotkeys, status tags |
| **Metric Figure** | `Plus Jakarta Sans` / Mono | 700 / Bold | 1.5rem–2.25rem | `-0.02em` | KPI stats, countdown numbers, 1RM weights |

---

## 3. Semantic Spacing & Grid System

- **Base Unit:** 4px grid (`0.25rem`).
- **Standard Densities:**
  - `p-1` (4px): Micro icon paddings, keyboard badge insets.
  - `p-2` (8px): Button icon spacing, dropdown item vertical padding.
  - `p-3` (12px): Form input padding, compact card insets.
  - `p-4` / `p-5` (16px–20px): Standard card interior padding.
  - `p-6` / `p-8` (24px–32px): Page section padding, hero banner containers.
- **Card Radii:**
  - Small elements (Badges, Pills): `rounded-lg` (8px) or `rounded-full` (9999px).
  - Standard cards & inputs: `rounded-xl` (12px) or `rounded-2xl` (16px).
  - Modals & Hero drawers: `rounded-3xl` (24px).

---

## 4. Component Interaction Standards

### 4.1 Buttons
- **Primary:** Filled with active `--accent`, high-contrast white text, subtle hover lift (`translateY(-1px)`), active press (`scale(0.98)`).
- **Secondary:** Surface-colored with 1px `var(--border)`, hover background tinted with subtle tone.
- **Ghost:** No initial border/background, tinted hover state for secondary actions.
- **Destructive:** Rose/danger tone with explicit confirmation modal on state mutations.

### 4.2 Form Controls & Inputs
- Standardized height (`38px` desktop, `42px` touch targets).
- Integrated icon slots with clean text indentations.
- Focus state: crisp 2px accent outline ring with 2px offset (`:focus-visible`).

### 4.3 Navigation & Tabs
- Active tab indicated by an animated shared layout pill (`motion.div` layoutId) with zero layout jump.
- Contextual notification badges with neutral, sage, or danger semantic fills.

### 4.4 Command Palette (`Ctrl+K` / `Cmd+K`)
- Floating modal centered at `top: 18%` of viewport.
- Instant keyboard search across all 15 modules and sub-entities.
- Arrow key navigation (`↑`, `↓`) with enter to execute.

