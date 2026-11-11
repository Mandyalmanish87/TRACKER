# TRAKIFY — Architecture Reconciliation & Supabase Role Specification

**Document Version:** 2.0.0 (Supersedes v1.0.0)  
**Status:** Canonical Architectural Authority  
**Primary Platform:** Firebase Spark (Authentication, Cloud Firestore, Firebase Storage)  
**Edge Execution Runtime:** Supabase Free (`nwaapwpvlnjdhglcghfd`) — Stateless Edge Functions Only  
**Payment Gateway:** Razorpay (Test Mode)  
**Media Provider:** YouTube Data API v3  

---

## 1. Executive Summary & Architectural Decisions

Following the Supabase quota incident and extensive architectural review, the team has formally finalized the database and backend strategy for TRAKIFY:

> [!IMPORTANT]
> **FIREBASE IS THE PRIMARY DATABASE AND USER PLATFORM.**  
> **SUPABASE POSTGRESQL MUST NOT BECOME A SECOND APPLICATION DATABASE.**  
> **NO APPLICATION TABLES WILL BE DEPLOYED TO SUPABASE POSTGRESQL.**

### Approved Core Invariants
1. **User Identity:** Firebase Authentication handles all student accounts (Email/Password, Google OAuth).
2. **Application Data:** Cloud Firestore and local-first storage (IndexedDB / `localStorage`) store all application data (Personal Space, Timetable, Attendance, Fitness/Gym, Nutrition, EduHub courses, ClassSpace workspaces, and Admin records).
3. **Subscription Entitlements:** Cloud Firestore collection `user_subscriptions/{uid}` is the sole production source of truth for subscription status and plan tiers.
4. **Idempotent Webhook Ledger:** Cloud Firestore collection `payment_webhook_events/{eventId}` is the sole authority for webhook lease-locking and replay protection.
5. **Supabase Role:** Supabase Edge Functions act strictly as a stateless execution layer for Razorpay payments and YouTube playlist imports. PostgREST database egress is **0 bytes**.
6. **Payment Provider:** Razorpay is the sole payment gateway. All Stripe code and dependencies have been permanently removed.

---

## 2. Migration-by-Migration Classification (All 7 Migrations)

The repository contains 7 legacy SQL migrations in `supabase/migrations/`. Below is the definitive audit and deployment classification for the new Supabase project (`nwaapwpvlnjdhglcghfd`):

| Migration File | Objects Defined | Application Module | Classification | Rationale |
|---|---|---|---|---|
| `20261020_user_trackers_schema.sql` | `user_trackers` table, indexes, RLS | Personal Space & Cloud Sync | **MUST NOT DEPLOY** | User snapshot synchronization belongs in Cloud Firestore / IndexedDB. Deploying to Postgres violates the Firebase-first invariant. |
| `20261022_classspace_schema.sql` | `class_workspaces`, `class_members`, `class_timetable_rules`, `class_timetable_overrides`, `class_attendance_records`, `class_notifications`, `class_messages`, `class_saved_messages`, `class_channels`, `class_join_requests`, `class_profiles` | ClassSpace Cohorts | **MUST NOT DEPLOY** | Academic cohort data belongs in Cloud Firestore via `firebaseDataClient.ts`. Deploying to Supabase risks recreating the multi-gigabyte egress incident. |
| `20261025_classspace_security_hardening.sql` | `lookup_workspace_by_join_code`, `join_class_workspace`, rate limits | ClassSpace Cohorts | **MUST NOT DEPLOY** | Join-code lookups and security checks are handled through Firebase Functions and Firestore security rules. |
| `20261101_admin_portal_schema.sql` | `admin_users`, `admin_audit_logs`, `is_platform_admin()`, admin RPCs | Platform Administration | **MUST NOT DEPLOY** | Administrative records and verification belong in Cloud Firestore. |
| `20261102_classspace_workspace_creation_fix.sql` | `create_class_workspace` RPC | ClassSpace Cohorts | **MUST NOT DEPLOY** | Replaced by Firebase Callable Function / Firestore write batching. |
| `20261103_classspace_2_0.sql` | Realtime triggers, pinned notices, message polls | ClassSpace Cohorts | **MUST NOT DEPLOY** | Realtime messaging and polling use Firestore real-time listeners (`onSnapshot`). |
| `20261108_subscriptions_schema.sql` | `user_subscriptions`, `payment_webhook_events`, `get_user_entitlements()`, `process_subscription_webhook_event()` | Payment Ledger & Entitlements | **MUST NOT DEPLOY** | Supabase Edge Functions write directly to Firestore `user_subscriptions/{uid}` and `payment_webhook_events/{eventId}` via service-account REST API. Deploying duplicate Postgres tables creates a dangerous second source of truth. |

**Summary: DO NOT RUN `supabase db push`. Zero migrations should be applied to the new Supabase PostgreSQL database.**

---

## 3. Module Architecture & Data Store Authority

| Application Module | Primary Data Store | Realtime / Sync Layer | Edge / Serverless Function | Local-First Offline Cache |
|---|---|---|---|---|
| **Personal Space & Timetable** | Cloud Firestore (`user_trackers/{uid}`) | Firestore SDK | None | `localStorage` (`tracker_state_data`) |
| **Attendance & Bunk Simulator** | Cloud Firestore (`user_trackers/{uid}`) | Firestore SDK | None | `localStorage` |
| **Focus Timer & Analytics** | Cloud Firestore (`user_trackers/{uid}`) | Firestore SDK | None | `localStorage` |
| **Gym & Workout Logging** | Cloud Firestore (`user_trackers/{uid}`) | Firestore SDK | None | `localStorage` |
| **Nutrition & Food Diary** | Cloud Firestore (`user_trackers/{uid}`) | Firestore SDK | None | `localStorage` |
| **EduHub Courses & Focus Radio** | Cloud Firestore (`user_trackers/{uid}`) | YouTube IFrame / oEmbed | Supabase `import-youtube-playlist` | `localStorage` (`tracker_eduhub_courses`) |
| **ClassSpace Cohorts** | Cloud Firestore (`class_*` collections) | Firestore `onSnapshot` | None | `localStorage` (`tracker_classspace_data_v1`) |
| **Platform Administration** | Cloud Firestore (`admin_*` collections) | Firestore SDK | Firebase Callable (`trackerRpc`) | `localStorage` audit logs |
| **Payment Orders & Mandates** | Razorpay Gateway | Razorpay Webhooks | Supabase `create-razorpay-order`, `create-razorpay-subscription` | None (server-controlled) |
| **Payment Verification & Webhooks** | Cloud Firestore (`user_subscriptions`, `payment_webhook_events`) | Deno Edge REST Client | Supabase `verify-razorpay-payment`, `cancel-razorpay-subscription`, `handle-razorpay-webhook` | In-memory entitlement cache |

---

## 4. Edge Functions Architecture (Payment & Media Proxy Only)

Supabase Edge Functions are deployed with `--no-verify-jwt` because:
1. End-user requests carry **Firebase Auth ID tokens** (`Authorization: Bearer <firebase_id_token>`), verified cryptographically using Google public RS256 JWKS certs in `_shared/firebaseAuth.ts`.
2. Webhooks carry **Razorpay HMAC-SHA256 signatures** (`x-razorpay-signature`), verified cryptographically using `RAZORPAY_WEBHOOK_SECRET` in `_shared/razorpay.ts`.

### Function Inventory:
1. **`import-youtube-playlist`**
   - **Purpose:** Server-side proxy for YouTube Data API v3 playlist and video queries.
   - **Required Secret:** `YOUTUBE_API_KEY`.
   - **Database Access:** Zero database access (stateless API proxy).
2. **`create-razorpay-order`**
   - **Purpose:** Generates authenticated one-time checkout orders with server-authoritative pricing (₹399 / ₹1,499).
   - **Required Secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. **`create-razorpay-subscription`**
   - **Purpose:** Generates recurring monthly subscription mandates for auto-renewal.
   - **Required Secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID_PRO`, `RAZORPAY_PLAN_ID_COHORT`.
4. **`verify-razorpay-payment`**
   - **Purpose:** Cryptographically verifies checkout signatures, queries Razorpay API for captured payment status, and updates Firestore `user_subscriptions/{userId}`.
   - **Required Secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).
5. **`cancel-razorpay-subscription`**
   - **Purpose:** Cancels recurring subscription mandates in Razorpay at cycle end and updates Firestore `cancelAtPeriodEnd: true`.
   - **Required Secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).
6. **`handle-razorpay-webhook`**
   - **Purpose:** Processes asynchronous payment capture, renewal, failure, and cancellation events. Manages atomic leasing in Firestore `payment_webhook_events/{eventId}`.
   - **Required Secrets:** `RAZORPAY_WEBHOOK_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).

---

## 5. Security & Deployment Checklist

Before deploying Edge Functions to `nwaapwpvlnjdhglcghfd`:
1. [x] Local CLI linked to `nwaapwpvlnjdhglcghfd`.
2. [x] Client `.env.local` configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. [x] Verified `YOUTUBE_API_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` in Supabase project secrets.
4. [ ] Set `FIREBASE_SERVICE_ACCOUNT_KEY` and `FIREBASE_PROJECT_ID` in Supabase project secrets.
5. [ ] Configure Webhook in Razorpay Dashboard and set `RAZORPAY_WEBHOOK_SECRET` in Supabase secrets.
6. [ ] Deploy 6 Edge Functions via `supabase functions deploy <name> --no-verify-jwt`.
7. [x] Confirm `supabase db push` is NEVER run.
