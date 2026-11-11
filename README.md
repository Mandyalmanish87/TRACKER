# TRACKER
*Personal Daily Management Operating System*

An editorial-grade personal daily management application inspired by Ventriloc's aesthetic — built with React 19, TypeScript, Vite, Tailwind CSS, and local persistence.

---

## 📁 Project Structure

```text
TRACKER/
├── docs/
│   ├── PRODUCT_SPEC.md        # Product requirements, personas, and domain models
│   ├── DESIGN_SYSTEM.md       # Ventriloc-inspired editorial tokens and style guide
│   └── IMPLEMENTATION_PLAN.md # Phased milestone engineering roadmap
├── src/
│   ├── components/
│   │   ├── common/            # Header, Navigation, Card, Button, Badge, ProgressBar, ThemeToggle, EmptyState
│   │   ├── dashboard/         # TodayScheduleWidget, AttendanceGaugeWidget, FocusWidget, GymSplitWidget, RemindersWidget
│   │   └── views/             # Full views: Timetable, Attendance (with Simulator), Focus, Gym, Reminders
│   ├── context/               # AppContext providing reactive state, attendance actions, gym & task mutations
│   ├── services/              # StorageService with sample/user data separation & backup export/import
│   ├── theme/                 # ThemeContext supporting Light, Dark, and System modes with zero flicker
│   ├── types/                 # Domain model TypeScript definitions
│   ├── utils/                 # Attendance margin & bunk cushion calculation engine
│   ├── App.tsx                # Application shell and view controller
│   ├── index.css              # Editorial tokens, typography, and scrollbar styling
│   └── main.tsx               # Entry mount point
├── public/                    # Favicon monogram and static assets
├── tests/
│   ├── setup.ts               # Jest DOM matcher setup
│   ├── attendance.test.ts     # Attendance edge-case math calculations unit tests
│   └── app.test.tsx           # Full application shell, theme toggle, and interaction tests
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ or v24+)
- npm (v10+ or v11+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Launch Development Server
```bash
npm run dev
```
The application will launch at: **`http://localhost:5173/`**

## Firebase backend

Firebase is the only active cloud provider. Google sign-in uses Firebase Authentication and personal app data syncs to Cloud Firestore. Photo uploads and paid server features are paused; progress photos stay on the current device.

Copy `.env.example` to `.env.local` and fill in the Firebase web app settings. Enable Google as a sign-in provider in Firebase Authentication, then deploy the Firebase resources from the project root:

```bash
firebase deploy --only firestore:rules,storage,functions
```

Cloud Functions require a paid Firebase plan and are not part of the free setup. See [Firebase backend setup](docs/FIREBASE_BACKEND.md).

The old SQL migrations and Edge Functions are retained under `docs/archive/legacy-supabase` as historical reference only; the application does not load or call them.

### 4. Run Test Suite
```bash
npm test
```
Runs all 11 unit and component tests with Vitest.

### 5. Production Build & Type Check
```bash
npm run build
```

---

## 🎨 Editorial Design System
- **Typography**: Editorial serif display headers (`Playfair Display`), crisp geometric sans-serif UI text (`Plus Jakarta Sans`), and monospaced timestamp notation (`JetBrains Mono`).
- **Color Palette**: Warm ivory canvas (`#FAF7F2`), crisp paper cards (`#FFFFFF`), rich espresso typography (`#1C1917`), and restrained terracotta accents (`#C45532`).
- **Theme Modes**: Full support for **Light Mode**, **Dark Mode** (charred espresso & warm cream), and **System Match**.
- **Data Integrity**: Realistic demonstration data is tagged with `isSample: true` and can be purged with a single click to enter clean **Live User Mode**.
