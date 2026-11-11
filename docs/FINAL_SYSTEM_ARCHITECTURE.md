# STUDENT TRACKER — FINAL SYSTEM ARCHITECTURE
**Document ID:** SYS-ARCH-FINAL-2026
**Target Environment:** Firebase Spark + Supabase Free + Razorpay Test/Live + YouTube Media
**Status:** Approved & Enforced

---

## 1. Executive Architectural Summary

Student Tracker's architecture is built on a strict, separation-of-concerns model designed to guarantee zero cloud egress spikes, permanent offline functionality for students, and bank-grade cryptographic security for payment transactions.

```mermaid
flowchart TD
    subgraph Client ["Student Tracker Client (Web / PWA)"]
        UI["React 18 / TypeScript SPA"]
        LS[("Local Storage / IndexedDB")]
        AuthC["AuthContext (Firebase Auth)"]
        SubSvc["SubscriptionService (Razorpay Engine)"]
        SyncSvc["CloudSyncService (Firestore REST / SDK)"]
        YTPlayer["Focus Radio (YouTube IFrame / oEmbed)"]
    end

    subgraph Firebase ["1. Firebase Platform (Primary Application & User Platform)"]
        FBAuth["Firebase Authentication (Google Sign-In / UIDs)"]
        FS_Trackers[("Firestore: user_trackers/{uid}")]
        FS_Class[("Firestore: class_* (Workspaces, Channels, Messages)")]
        FS_Subs[("Firestore: user_subscriptions/{uid}")]
        FS_Events[("Firestore: payment_webhook_events/{id}")]
        FBRules["Firestore Security Rules (Zero Client Write on Subscriptions)"]
    end

    subgraph Supabase ["2. Supabase Serverless (Payment Backend ONLY)"]
        direction TB
        EF_Order["create-razorpay-order"]
        EF_Sub["create-razorpay-subscription"]
        EF_Verify["verify-razorpay-payment"]
        EF_Cancel["cancel-razorpay-subscription"]
        EF_Webhook["handle-razorpay-webhook"]
        EdgeAuth["_shared/firebaseAuth (RS256 ID Token Verification)"]
        EdgeFS["_shared/firestoreRest (Google OAuth2 Service Account)"]
    end

    subgraph Razorpay ["3. Razorpay Payment Gateway"]
        RZP_Orders["Orders API (/v1/orders)"]
        RZP_Subs["Subscriptions API (/v1/subscriptions)"]
        RZP_Checkout["Checkout Modal (checkout.js)"]
        RZP_Webhooks["Webhook Delivery (HMAC-SHA256)"]
    end

    subgraph YouTube ["4. YouTube Media Provider"]
        YToEmbed["oEmbed API (Metadata / Titles / Thumbnails)"]
        YTIFrame["IFrame Player API (Audio / Video Streaming)"]
    end

    %% Client Interactions
    UI --> LS
    UI --> SubSvc
    UI --> SyncSvc
    UI --> YTPlayer
    AuthC --> FBAuth

    %% Application Data Sync (Direct to Firebase)
    SyncSvc -->|Read / Write| FS_Trackers
    SyncSvc -->|Read / Write| FS_Class

    %% Focus Radio Media
    YTPlayer -->|Stream Audio/Video| YTIFrame
    YTPlayer -->|Fetch Metadata| YToEmbed

    %% Payment Checkout Flow
    SubSvc -->|1. Request Order / Subscription| EF_Order & EF_Sub
    EF_Order & EF_Sub -->|Verify JWT| EdgeAuth
    EF_Order & EF_Sub -->|Create Order / Sub| RZP_Orders & RZP_Subs
    SubSvc -->|2. Launch Modal| RZP_Checkout
    RZP_Checkout -->|3. Payment Tokens| SubSvc
    SubSvc -->|4. Verify Payment Tokens| EF_Verify
    EF_Verify -->|HMAC-SHA256 Check & Update| EdgeFS
    EdgeFS -->|Write Entitlements| FS_Subs

    %% Webhook Processing
    RZP_Webhooks -->|Lifecycle Events (HMAC)| EF_Webhook
    EF_Webhook -->|Atomic Claim & State Machine| FS_Events
    EF_Webhook -->|Monotonic Update| FS_Subs

    %% Entitlement Reading
    SubSvc -->|Authoritative Entitlements Read| FS_Subs
```

---

## 2. Four-Pillar Responsibilities

| Pillar | Service | Role | Data / Operations Handled | Egress & Quota Protections |
|---|---|---|---|---|
| **1. Primary Platform** | **Google Firebase** | Primary user platform & database | Firebase Authentication, Cloud Firestore collections (`user_trackers`, `class_*`, `user_subscriptions`, `payment_webhook_events`). | Firebase Spark plan. Payload hashing prevents redundant writes. IndexedDB offloads image binary blobs. |
| **2. Payment Backend** | **Supabase Edge Functions** | Serverless Payment Backend ONLY | 5 isolated Deno Edge Functions: order creation, subscription creation, payment verification, subscription cancellation, webhook processing. | Zero PostgREST table queries in production. Database services restricted/bypassed. Deno Edge runtime only. |
| **3. Payment Provider** | **Razorpay** | Sole payment processor | One-time passes, recurring auto-mandates (UPI AutoPay, e-Mandates, Cards), webhook dispatch, invoice generation. | Standard Razorpay REST APIs with server-side Basic Auth and webhook HMAC signatures. |
| **4. Media Provider** | **YouTube** | Focus Radio streaming | Embedded audio/video streams, oEmbed track metadata, thumbnail URLs. | Zero video or audio bytes stored in Firebase or Supabase. Public CDN delivery directly from Google/YouTube. |

---

## 3. Non-Negotiable Invariants

1. **Firebase is the Primary Database:** Cloud Firestore is the sole database for all user data, academic records, timetable, attendance, syllabus, fitness logs, and collaborative ClassSpace data.
2. **Supabase is Payments-Only:** Supabase database (PostgREST) is NOT used for application data. Client application never calls Supabase `.from()` in production.
3. **Razorpay is the Exclusive Payment Provider:** All subscription purchases, one-time passes, recurring renewals, and cancellations route through Razorpay. Stripe is completely retired.
4. **Zero Client Trust:** The frontend NEVER specifies amounts, prices, or currency, and never writes directly to subscription records. Firestore rules strictly enforce `allow write: if false` on `user_subscriptions/{uid}`.
5. **Offline-First Student Promise:** All essential academic tools (timetable, attendance bunk simulator, pomodoro timer, gym tracker, local backup) function 100% offline and remain free forever. Paid tiers power multi-device cloud synchronization and batch collaboration.
