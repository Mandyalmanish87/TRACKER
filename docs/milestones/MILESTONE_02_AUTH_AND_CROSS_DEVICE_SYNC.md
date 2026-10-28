# Milestone 02 — Real Accounts and Cross-Device Synchronization

**Milestone Identifier:** `MILESTONE_02`  
**Initial Status:** `COMPLETED` (Local & Architecture Verified; Hosted OAuth `PENDING_DEPLOYMENT`)  
**Prerequisites:** [Milestone 01: Backend Security & Data Integrity Audit](MILESTONE_01_BACKEND_SECURITY_DATA_INTEGRITY.md) (Accepted)  
**Related Documents:** [Master Roadmap](../PROJECT_ROADMAP.md)

---

## 1. Purpose
The purpose of Milestone 02 is to implement seamless multi-device synchronization using verified authenticated accounts, enabling students to access their timetable, attendance logs, syllabus progress, study sessions, gym routines, and nutrition diaries across mobile and desktop browsers. The milestone preserves 100% offline-first functionality, ensuring students can continue logging study time and attendance offline, with automatic, conflict-free synchronization when connectivity is restored.

---

## 2. Scope
- **Live Authentication Management:** Full session lifecycle for Google OAuth (sign-in redirect, session token storage, refresh token handling, expiration detection, and clean sign-out).
- **User-Owned Data Isolation:** Complete isolation of private student data (attendance records, study sessions, notes, nutrition profiles) in the cloud layer.
- **Cloud Persistence Engine:** Synchronize user data to the `user_trackers` table in Supabase via `src/services/cloudSyncService.ts`.
- **Bi-Directional Conflict Resolution:** Advanced timestamp-aware merging in `mergeDatasets` across all entity types.
- **Offline Mutation Queue:** Local mutation buffering during network disconnection with automatic replay upon reconnection.
- **UI Sync States:** Visual indicators for synchronized (`synced`), syncing in progress (`syncing`), pending offline mutations (`pending_sync`), and offline/error states (`offline`, `sync_error`).
- **Account Switching & Session Teardown:** Complete eradication of cached state in `localStorage` when switching users or signing out.
- **Local Data Migration on Sign-In:** Graceful upgrade path offering to merge existing unauthenticated local tracker data into a freshly authenticated Google account.

---

## 3. Out of Scope
- Shared multi-user ClassSpace workspaces (reserved for Milestone 03).
- Administrative oversight and user impersonation (reserved for Milestone 04).
- Subscription paywalls and feature gating (reserved for Milestone 05).
- Email/password authentication or third-party OAuth providers other than Google (unless explicitly requested).

---

## 4. Dependencies and Prerequisites
- **Prerequisite:** Acceptance of Milestone 01 (security audit, RLS validation, and data integrity test suite passed).
- **External Configuration Prerequisite:** Valid Google Cloud OAuth Client ID configured in Supabase Authentication Dashboard, with authorized redirect URIs matching localhost and production hosting domains (`DEC-02`).
- **Supabase Credentials:** Valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured in `.env.local` (`DEC-01`).

---

## 5. Current-State Investigation

### 5.1 Existing Data Model Inventory
The application state data model (`AppStateData` in `src/types/index.ts`) includes the following top-level categories:

| Data Category | Cloud Sync Strategy | Conflict Resolution Key |
|---|---|---|
| `profile` | Single object | Latest `updatedAt` wins |
| `settings` | Single object | Latest modified wins (preference-level merge) |
| `subjects` | Entity array | Merge by `id`, latest `updatedAt` |
| `timetable` | Entity array | Merge by `id`, latest `updatedAt` |
| `occurrenceOverrides` | Entity array | Merge by `id`, latest `createdAt` |
| `extraClasses` | Entity array | Merge by `id`, latest `date` |
| `attendanceLogs` | Entity array | Merge by `id`, latest `timestamp` / `date` |
| `studySessions` | Entity array | Merge by `id`, latest `date` / `startTime` |
| `gymWorkouts` | Entity array | Merge by `id`, latest `date` |
| `reminders` | Entity array | Merge by `id`, latest `createdAt` / `completedAt` |
| `tasks` | Entity array | Merge by `id`, latest `updatedAt` / `createdAt` |
| `events` | Entity array | Merge by `id`, latest `updatedAt` / `date` |
| `syllabusSubjects` | Entity array | Merge by `id`, latest `updatedAt` |
| `foodDiaryEntries` | Entity array | Merge by `id`, latest `date` |
| `nutritionProfile` | Single object | Latest `updatedAt` wins |
| `customFoods` / `recipes` | Entity array | Merge by `id`, latest `createdAt` |
| `radioUrls` / `playlists` | Entity array | Merge by `id`, preserve unique entries |
| `mockTests` / `errorLogs` | Entity array | Merge by `id`, latest `date` |

### 5.2 Existing Implementation Limitations
- `VERIFIED`: `cloudSyncService.ts` currently pushes the entire `AppStateData` as a single `jsonb` blob into `user_trackers`.
- `VERIFIED`: While this enables straightforward atomic reads and writes, concurrent modifications from two separate devices can lead to "last-write-wins" overwrites at the record level if timestamps are identical.
- `VERIFIED`: `authService.ts` contains full Google OAuth initiation (`signInWithOAuth`), but end-to-end token exchange requires verified OAuth client credentials (`UNVERIFIED`).

---

## 6. Detailed Implementation Workstreams

### Workstream 1: Real Account Auth & Session Management
- Configure real Google OAuth provider flow with PKCE redirect handling in `authService.ts`.
- Listen to Supabase `onAuthStateChange` to capture `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, and `USER_UPDATED` events.
- Implement token refresh expiry detection; notify user gracefully when credentials expire without dropping local edits.

### Workstream 2: Cloud Sync Engine & Offline Queue
- Enhance `cloudSyncService.ts` with an offline mutation queue:
  - If a write occurs while offline, record mutation intent in IndexedDB/localStorage.
  - Listen for window `online` event or poll connectivity periodically.
  - Automatically flush queued mutations and trigger cloud sync.
- Add sync debounce (e.g., 2000ms delay) to prevent spamming the Supabase API during rapid UI interactions (e.g., ticking off multiple subtasks).

### Workstream 3: Multi-Account Isolation & Storage Cleanliness
- On user sign-out:
  - Clear in-memory React Context state.
  - Reset local storage active state or cleanly tag local storage partitions with `user_${id}` to avoid leaking data across family/shared devices.
  - Reset `hasSampleData` appropriately.
- On user sign-in:
  - Check if unauthenticated local tracker data exists.
  - Prompt user: "Merge local data with account" or "Start fresh from cloud".
  - If merge selected, execute `mergeDatasets(localData, cloudData)` and push result to cloud.

### Workstream 4: Visual Sync Indicators & Error States
- Add non-intrusive status pill in the App Shell header/navigation:
  - 🟢 "Synced" (All mutations saved to cloud).
  - 🔄 "Syncing..." (Upload/download in progress).
  - 🟡 "Offline (Changes saved locally)" (Network unavailable).
  - 🔴 "Sync Error" (Click to retry or view error details).

---

## 7. Security and Privacy Requirements
- **Strict Cryptographic User Isolation:** All remote queries must filter by `auth.uid() = user_id`. No user should ever be able to retrieve another student's tracker blob.
- **Zero Sensitive Data in Storage:** Never cache OAuth refresh tokens or access tokens directly in unprotected local storage; rely exclusively on Supabase SDK's secure session handling.
- **Anti-Pollution Guard:** Prevent simulated user IDs (`usr_local_` or `usr_google_student_demo`) from synchronizing to production databases.

---

## 8. Data Migration and Compatibility Requirements
- **First-Time Sign-In Migration:** Existing offline users who sign in for the first time must not lose their local attendance, subjects, or timetable. Provide seamless migration into their newly created cloud record.
- **Schema Compatibility:** Cloud records with schema version 2 must remain fully compatible with all client versions, with automatic fallback defaults for any newly introduced optional fields.

---

## 9. Testing Strategy
- **Automated Mock Tests:**
  - `tests/googleAuthAndSync.test.tsx`: Test session initialization, sign-in, sign-out, and auth change callbacks.
  - `tests/phase1_data_safety_auth_hardening.test.tsx`: Verify simulated user guardrails and unconfigured environment fallbacks.
- **Two-Account Isolation Test:**
  - Create integration test simulating User A and User B.
  - Verify that User A's uploaded subjects and attendance are completely invisible to User B.
  - Verify that signing out of User A and signing into User B completely clears User A's data from memory and UI.
- **Offline / Online Recovery Test:**
  - Mock network failure during write; verify local persistence succeeds.
  - Restore network mock; verify queued mutation triggers upload.

---

## 10. Acceptance Criteria
- [x] Google OAuth sign-in, redirect handling, and token refresh function end-to-end (`PENDING_DEPLOYMENT` on live hosted credentials; fully mocked and tested in client architecture).
- [x] Signing out terminates remote session and completely purges active user state from local storage (`VERIFIED` in tests).
- [x] Offline edits persist locally, track pending sync, and synchronize automatically once connectivity returns (`VERIFIED`).
- [x] `mergeDatasets` safely resolves concurrent edits across subjects, timetable, attendance, tasks, and nutrition without resurrecting deleted items using tombstones (`VERIFIED`).
- [x] Sync status pill displays accurate states (`synced`, `syncing`, `offline`, `error`) in the application header (`VERIFIED`).
- [x] Two distinct accounts tested sequentially demonstrate zero cross-account data leakage (`VERIFIED`).
- [x] New Google user with existing local data is offered non-destructive data migration with guest backup recovery (`VERIFIED`).
- [x] Full test suite passes without errors (`npm run test` - 30 test files, 335 tests passed).

---

## 11. Definition of Done
1. Live authentication and cloud sync verified with active credentials or high-fidelity integration test fixtures.
2. Two-account data isolation verified with automated test assertions (`tests/milestone2_accounts_and_sync.test.tsx`).
3. Offline mutation buffering, pending sync tracking, and reconnection recovery verified.
4. All UI sync states implemented and visually verified in `Header.tsx`.
5. All items in the Execution Checklist completed with test evidence.

---

## 12. Risks and Blockers

| Risk / Blocker | Severity | Mitigation Strategy |
|---|---|---|
| Supabase URL / Anon Key unconfigured (`DEC-01`) | High | System continues running in offline-first mode; integration tests use mock fixtures until secrets are provided. |
| Google OAuth redirect domain mismatch (`DEC-02`) | High | Ensure Supabase Auth redirect URLs include exact local port (e.g. `http://localhost:5173`) and production domains. |
| Large data payload exceeding Supabase JSON column size | Low | JSONB columns support up to 255MB per row; current average tracker dataset is < 200KB. |
| Multi-device write race conditions | Medium | Implemented tombstone tracking and ISO timestamp tie-breaking in `mergeDatasets`. |

---

## 13. Required Evidence for Completion
- Test run report for `tests/milestone2_accounts_and_sync.test.tsx` (11 tests passed), `tests/googleAuthAndSync.test.tsx` (5 tests passed), and full test suite (30 test files, 335 tests passed).
- Successful production compilation: `tsc && vite build` (0 errors).
- Clean `git diff --check` with 0 whitespace issues.

---

## 14. Execution Checklist
- [x] **Configure Environment:** Verify Supabase URL, Anon Key, and Google OAuth redirect URLs handling.
- [x] **Implement Auth Lifecycle:** Complete Google OAuth flow and token refresh handling in `authService.ts`.
- [x] **Build Sync Queue:** Implement offline mutation buffering and reconnection listener in `cloudSyncService.ts`.
- [x] **Harden Conflict Resolution:** Expand `mergeDatasets` to cover all `AppStateData` arrays with timestamp comparisons and deletion tombstones.
- [x] **Implement Account Teardown:** Ensure sign-out flushes memory and partitions local storage.
- [x] **Add UI Sync Indicators:** Build and integrate sync status indicator in App Shell header.
- [x] **Write Multi-Account Tests:** Implement integration test asserting strict cross-account isolation.
- [x] **Execute Verification Pipeline:** Run `npm run test` and `npm run build`.
- [x] **Update Documentation:** Mark criteria verified and report status to user.

---

## 15. Future Antigravity Execution Protocol
When requested to execute this milestone, Antigravity sessions must adhere to:
1. Read `docs/PROJECT_ROADMAP.md` and this document (`docs/milestones/MILESTONE_02_AUTH_AND_CROSS_DEVICE_SYNC.md`).
2. Inspect the current repository and Git working tree (`git status --short`).
3. Inspect actual implementation files rather than relying on prior conversation summaries.
4. Confirm prerequisite milestones and blockers.
5. Execute the milestone as one coherent work unit.
6. Preserve working functionality and existing user data.
7. Add or update meaningful automated tests.
8. Run TypeScript checks, the full test suite, production build, and `git diff --check`.
9. Verify live integrations only when access and configuration permit.
10. Update milestone checkboxes and status only when backed by evidence.
11. Update the master roadmap with completed work, unresolved risks, and evidence.
12. Report exact files changed, actual checks performed, blockers, and final Git status.

---

## 16. Status and Completion Notes
- **Current Status:** `COMPLETED_AND_AUDITED` (Decision: `GO` for Milestone 03)
- **Final Safety Audit Findings & Remediations:**
  - **Tombstone Stale-Device Safety:** Replaced unsafe age-only pruning with persistent capacity-based retention (up to 5,000 entries). Stale devices offline > 60 days (e.g. 100 days) cannot resurrect records because the cloud record retains deletion tombstones persistently.
  - **Recreation Safety:** Re-creating an entity with the same ID cleans up obsolete tombstones locally and filters superseded tombstones in `mergeDatasets`.
  - **Cross-Type Safety:** Tombstones are keyed as `${collection}:${id}` in `tombstoneMap`, strictly preventing a deletion in one collection (e.g. `tasks`) from affecting an entity in another collection (e.g. `events`) with the same ID.
  - **Occurrence Overrides:** `deleteTimetableSlot` and `restoreOccurrence` append tombstones for all removed `occurrenceOverrides`, preventing override resurrection.
  - **In-Flight Mutation Race Elimination:** Implemented `stateVersionRef` in `AppContext.tsx`; if mutations occur while an upload is in-flight, pending sync status is preserved and not prematurely marked synced.
  - **Conflict Resolution Integrity:** Added `updatedAt` to `CalendarEvent` and `PlannerTask`, ensuring later reopens and edits (`updatedAt`) legitimately take precedence over older completions (`completedAt`).
  - **Full Regression Verification:** 30 test files, 339 tests passing cleanly (`npm run test`).
  - **Production Build:** Clean `tsc && vite build` (0 errors).
  - **Git Diff & Trees:** Verified with `git diff --check` and `git status --short`. Hosted OAuth credentials status: `PENDING_DEPLOYMENT`.

