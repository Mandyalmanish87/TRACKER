# Student Tracker — Supabase Egress Incident Final Report & Sign-Off

**Document Version:** 1.0.0 — Final Sign-Off  
**Project:** Student Tracker (`C:\Users\mandy\Downloads\TRACKER`)  
**Supabase Restricted Project:** `gxoegzfhlqjnbcnxmgah`  
**Billing Cycle:** 25 October – 25 November 2026  
**Incident Reference:** 31.676 GB Single-Day PostgREST Spike (2 November 2026)  
**Verification Status:** **100% Passing (48/48 Test Files, 687/687 Tests Passed, TypeScript 0 Errors, Production Build Successful)**  

---

## 1. Executive Incident Summary

On 2 November 2026, the Supabase Free tier project `gxoegzfhlqjnbcnxmgah` exceeded its monthly quota limits:
- **Egress Consumed:** **58.692 GB** against the **5.0 GB** free allowance.
- **Peak Egress:** **31.676 GB** consumed in 24 hours on 2 November 2026 (100% PostgREST REST API calls).
- **Log Ingestion:** **2.138 GB** against the **1.0 GB** allowance.
- **Service Status:** All Supabase services automatically restricted by the provider with **HTTP 402 Payment Required**.

The incident was caused by four compounding client-side architectural flaws that created closed-circuit request loops and unpaginated database queries in the React application.

---

## 2. Confirmed Original Root Causes

1. **`AppContext.tsx` Auto-Sync Loop:**
   - The auto-sync `useEffect` included `syncStatus` in its dependency array.
   - Transitioning from `'syncing'` to `'synced'` re-triggered the hook.
   - Absence of payload diff caching caused continuous re-uploading of the student's entire JSON state (~250 KB per request, 27,658 calls).
2. **`classSpaceService.ts` Read-Triggered Event Dispatch Loop:**
   - `getChannels()` called `saveLocalData()`, which dispatched `tracker_classspace_updated`.
   - `ClassSpaceContext.tsx` listened to `tracker_classspace_updated` and called `refreshWorkspaceData()`, which called `getChannels()`.
   - This closed loop generated over **131,000 queries per table** for `class_members`, `class_timetable_rules`, `class_timetable_overrides`, `class_attendance_records`, `class_messages`, `class_saved_messages`, and `class_notifications`.
3. **Unbounded Queries in `class_messages`:**
   - Chat feed query lacked a limit clause, downloading the complete message history on every refresh cycle (131,647 calls, ~9.87 GB egress).
   - Reactions query was unconstrained rather than scoped to visible message IDs.
4. **Uncached User Profile Queries:**
   - `getUserProfile()` lacked memory caching, querying `class_profiles` for every message author and reaction user (123,325 calls).
5. **Realtime Listener & Polling Amplification:**
   - Global unfiltered table listener on `class_profiles`.
   - Fallback heartbeat polling interval running continuously even when the tab was hidden.

---

## 3. Actual Code Changes Made

| File Path | Nature of Repair | Impact on Egress & Stability |
|---|---|---|
| `src/context/AppContext.tsx` | Removed `syncStatus` from dependency array; added `stateVersionRef` vs `lastSyncedVersionRef` dirty check; added `isSyncingRef` concurrency lock; reset synced refs on `signOut()`. | Completely broke auto-sync infinite loop. Bypasses upload when state is unchanged. |
| `src/services/cloudSyncService.ts` | Added in-memory `lastUploadedPayloadByUser` diff cache; added HTTP 402 detection and `clearCachedPayloadHash()`. | Skips redundant uploads of identical payloads; halts auto-sync on HTTP 402 quota error. |
| `src/services/classSpaceService.ts` | Added `saveLocalDataQuiet()` (zero event dispatch on reads); updated `getChannels()` to quiet writes; bounded `getMessages()` to 50 recent rows; added composite cursor `(created_at, id)` in `getOlderMessages()`; scoped reactions to active message IDs; added 5-minute `profileMemoryCache`; removed global profiles realtime listener; throttled heartbeat polling to 60s with visibility check; implemented `uploadAvatar()`. | Completely eliminated closed-circuit refresh loop; capped message queries to 50 rows; eliminated duplicate profile reads. |
| `src/context/ClassSpaceContext.tsx` | Added `inFlightRefreshesRef` promise deduplication; added `refreshSequenceRef` stale workspace protection; added 1500ms debounce on external/realtime refresh triggers; exposed cursor pagination state (`hasMoreMessages`, `isLoadingOlderMessages`, `loadOlderMessages`). | Deduplicated concurrent workspace queries into single active request. |
| `src/components/classspace/ClassCommunityTab.tsx` | Added "Load older messages" button / indicator at top of message feed. | User-driven pagination controls. |
| `src/services/degradedModeService.ts` | Created shared singleton for HTTP 402 detection, 15-minute cooldown (`markCloudDegraded`), auto-recovery (`isCloudDegraded`), rate-limited console warnings (max 1/60s), and `withDegradedGuard`. | Protects all services from retry storms during quota restriction. |
| `src/services/adminService.ts` | Guarded `verifyPlatformAdmin()`, `fetchOverviewMetrics()`, `searchUsers()`, `searchWorkspaces()`, and `fetchAuditLogs()` with `isCloudDegraded()` and 402 detection. | Halts admin queries when cloud is degraded. |
| `src/services/subscriptionService.ts` | Guarded `createCheckoutSession()`, `createCustomerPortalSession()`, and `callSupabaseFunction()` with `isCloudDegraded()` and 402 detection. | Halts Edge Function retries when cloud is restricted. |
| `src/services/authService.ts` | Updated `getFirebaseDataClientForServices` to check `getFirebaseDataClient() \|\| getSupabaseClient()`. | Supports test mocks and clean fallback. |
| `src/utils/networkDiagnostics.ts` | Created privacy-safe diagnostics layer tracking request bursts (>15 calls/5s), duplicate Realtime channels, in-flight calls, with zero sensitive data/PII. | Monitors network health without leaking tokens or student data. |

---

## 4. Test Verification Results

The complete automated test suite was executed across the entire repository:

```
Test Files  48 passed (48)
     Tests  687 passed (687)
  Duration  48.59s
```

### Key Sub-Suites Verified:
- **`tests/supabaseEgressAndSyncHardening.test.tsx` (20 / 20 passed):**
  - Auto-sync scheduling and loop prevention.
  - State change debouncing (2500ms).
  - In-memory payload diff caching.
  - Concurrency serialization and dirty check.
  - Conflict state upload suppression.
  - Account switching cache clearance.
  - Quiet reads in `getChannels()`.
  - 50-message query bound.
  - Composite cursor pagination with identical timestamps.
  - In-flight refresh deduplication.
  - Profile memory caching.
  - Scoped realtime subscriptions.
  - HTTP 402 error format detection.
  - Degraded mode 15-minute cooldown and recovery.
  - Cross-service degraded mode propagation (CloudSync, Admin, Subscriptions).
  - Network diagnostics burst detection (>15 calls/5s) and rate-limited logging.
  - Duplicate Realtime channel detection.
  - Zero PII leakage in diagnostics.
- **`tests/milestone5_subscriptions_and_payments.test.tsx` (70 / 70 passed):**
  - Entitlements resolution, Stripe Edge Functions, Firestore webhook idempotency state machine.
- **`tests/phase3a_supabase_security_hardening.test.tsx` (24 / 24 passed):**
  - Local-ID invariance, RPC error handling, avatar upload fallback, join code rotation with RLS enforcement.
- **`tests/milestone4_owner_admin_portal.test.tsx` (24 / 24 passed):**
  - Administrative role verification, route protection, operator boundaries.
- **`tests/classSpace.test.tsx` & `tests/milestone3_collaboration_security.test.tsx` (60 / 60 passed):**
  - Cohort workspaces, timetables, attendance, chat, and RLS security boundaries.
- **`tests/milestone2_accounts_and_sync.test.tsx` (15 / 15 passed):**
  - Local-first hydration, tombstone resolution, forward-compatible state merging.
- **TypeScript Check (`npx tsc --noEmit`):**
  - **0 errors (clean compilation across the entire project).**
- **Production Vite Build (`npm run build`):**
  - **Exit code 0 (built successfully in 20.07s).**

---

## 5. Verification Status: Local vs. Cloud

### What WAS Verified:
- **Local Application Integrity:** All 48 test suites (687 tests) pass locally.
- **Loop Prevention:** Confirmed via simulated rapid state updates, in-flight Promise tracking, and CustomEvent dispatch interception.
- **Composite Cursor:** Confirmed via identical timestamp test fixtures (`2026-11-08T10:00:00.000Z`) with zero skipped or duplicate messages.
- **Degraded Mode:** Confirmed that `markCloudDegraded` immediately pauses remote calls across all services while preserving 100% of local features.
- **Type Safety & Build:** Clean TypeScript compilation and production bundle build.

### What Was NOT Verified Against the Cloud:
- **Live Supabase Round-Trips:** Because Supabase project `gxoegzfhlqjnbcnxmgah` is restricted with HTTP 402, live queries against that project return 402 by design.
- **Live Stripe Webhooks:** Live webhook delivery from Stripe to Supabase Edge Functions requires active (unrestricted) cloud endpoints.
- **Live Egress Measurement:** Only Supabase dashboard metrics after deploying to a fresh project can reflect live bandwidth reduction.

---

## 6. Remaining Known Limitations & Handoff Readiness

1. **Old Project Status:** Supabase project `gxoegzfhlqjnbcnxmgah` remains restricted with HTTP 402 until its billing cycle resets on 25 November 2026.
2. **Next Step:** As instructed, the next project phase will provision a **completely NEW Supabase project** using the prepared [`docs/NEW_DATABASE_MIGRATION_BLUEPRINT.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/NEW_DATABASE_MIGRATION_BLUEPRINT.md).
3. **Data Safety:** Zero database records, tables, or local user stores were reset, truncated, or deleted. All uncommitted work in the working directory is preserved.
