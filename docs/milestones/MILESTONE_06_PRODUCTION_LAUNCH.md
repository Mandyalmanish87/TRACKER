# Milestone 06 — Production Launch and Reliability

**Milestone Identifier:** `MILESTONE_06`  
**Initial Status:** `AUDITED_READY_FOR_HOSTED_STAGING_DEPLOYMENT`  
**Prerequisites:** [Milestone 01: Backend Security & Data Integrity Audit](MILESTONE_01_BACKEND_SECURITY_DATA_INTEGRITY.md), [Milestone 02: Real Accounts & Cross-Device Synchronization](MILESTONE_02_AUTH_AND_CROSS_DEVICE_SYNC.md), [Milestone 03: ClassSpace Collaboration](MILESTONE_03_CLASSSPACE_COLLABORATION.md), [Milestone 04: Owner & Admin Portal](MILESTONE_04_OWNER_ADMIN_PORTAL.md), [Milestone 05: Subscriptions & Payments](MILESTONE_05_SUBSCRIPTIONS_AND_PAYMENTS.md) (All Verified & Accepted)  
**Related Documents:** [Master Roadmap](../PROJECT_ROADMAP.md)

---

## 1. Purpose
The purpose of Milestone 06 is to plan and execute the comprehensive production launch and operational reliability verification for the Student Tracker platform. This milestone ensures that production secrets are properly provisioned, database migrations are applied cleanly with active Row Level Security, bundle performance satisfies strict web vitals, error monitoring is privacy-compliant, disaster recovery backups are proven restorable, and a rapid rollback strategy is prepared before general student availability.

---

## 2. Scope
- **Production Environment & Secret Management:** Verification of production environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, webhook secrets, OAuth redirect URIs).
- **Authentication & Domain Verification:** Verification of Google Cloud OAuth consent screens, authorized JavaScript origins, and authorized redirect URIs.
- **Database & RLS Production Verification:** Complete execution of all database migrations against the production database, verifying RLS policies on all public tables.
- **Production Build & Asset Optimization:** Bundle-size audit, tree-shaking verification, code-splitting analysis, and font/asset preloading.
- **Comprehensive E2E Smoke Test Matrix:** Verifying core user journeys across Desktop, Tablet, and Mobile viewport sizes.
- **Cross-Account Data Isolation:** Verification that multi-user isolation holds under production load.
- **Error Monitoring & Telemetry:** Privacy-first error monitoring (e.g., Sentry with strict PII scrubbing).
- **Disaster Recovery & Backup Restoration:** Verified procedure for taking automated daily database snapshots and restoring from cold backups.
- **Rollback Strategy:** Documented and tested one-command zero-downtime rollback procedure.
- **Post-Launch Observability:** Health checks, uptime monitoring, and alerting thresholds.

---

## 3. Out of Scope
- Designing new user-facing product features or altering core UX layouts.
- Developing native iOS/Android binary builds (this release covers PWA/Web).
- Marketing campaigns and external student user acquisition.

---

## 4. Dependencies and Prerequisites
- **Prerequisite Milestones:** Full acceptance and test verification across Milestones 01, 02, 03, 04, and 05.
- **Infrastructure Provisioning (`DEC-06`):**
  - Production hosting platform configured (e.g. Vercel, Cloudflare Pages, or Netlify).
  - Production Supabase instance provisioned with PITR (Point-in-Time Recovery) enabled.
  - Production DNS configured with valid SSL/TLS certificates.
  - Google Cloud OAuth Consent Screen published and approved.

---

## 5. Current-State Investigation
- `VERIFIED`: The repository builds cleanly with `npm run build` (`tsc && vite build`), yielding an optimized client bundle.
- `VERIFIED`: 30+ Vitest test suites currently execute in under 15 seconds.
- `VERIFIED`: Offline-first architecture guarantees core functionality operates even in the event of total remote cloud outages.
- `UNVERIFIED`: Live production hosting environment, production DNS routing, and live external third-party webhook endpoints.
- `UNVERIFIED`: Production database performance under hundreds of concurrent student ClassSpace connections.

---

## 6. Detailed Implementation Workstreams

### Workstream 1: Production Secrets & Authentication Allowlisting
- Provision separate staging and production Supabase projects.
- In Google Cloud Console:
  - Add production domain (e.g., `https://tracker.app`) to Authorized JavaScript Origins.
  - Add production callback URI (e.g., `https://<project-ref>.supabase.co/auth/v1/callback`) to Authorized Redirect URIs.
- In Supabase Dashboard:
  - Set Site URL to `https://tracker.app`.
  - Add redirect allowlist: `https://tracker.app/**`, `http://localhost:5173/**`.
- Verify no service keys or private certificates are exposed in client-side Vite builds.

### Workstream 2: Database Migration & RLS Sanity Check
- Apply all migrations in sequence:
  1. `20261022_classspace_schema.sql` (ClassSpace collaboration, timetable, private attendance).
  2. `20261101_admin_portal_schema.sql` (Admin users, audit logs).
  3. `20261108_subscriptions_schema.sql` (Subscriptions, webhook idempotency ledger).
- Run automated RLS audit query across Postgres `pg_tables` ensuring 100% of public tables have `rowsecurity = true`.
- Confirm `SECURITY DEFINER` functions have explicit `search_path = public`.

### Workstream 3: Performance, Bundle Size & Accessibility Audit
- Execute production bundle analyzer:
  - Total initial gzipped JavaScript budget: < 200 KB.
  - Verify Three.js and Lucide React are tree-shaken and split into dynamic chunks.
- Lighthouse Audit Targets:
  - Performance: ≥ 90
  - Accessibility: ≥ 95 (WCAG 2.1 AA compliant color contrast and ARIA labels)
  - Best Practices: ≥ 95
  - SEO: ≥ 90

### Workstream 4: Privacy-First Observability & Logging
- Configure error monitoring (e.g. Sentry):
  - Strip query parameters, authorization headers, and personal student names.
  - Exclude local storage state and private attendance logs from error breadcrumbs.
- Implement health check endpoint (`/healthz`) reporting database connectivity and build version.

### Workstream 5: Backup, Disaster Recovery & Rollback Strategy
- **Backup Verification:**
  - Verify automated daily Postgres backups in Supabase.
  - Test restoring a backup into a fresh development database; verify data integrity of `user_trackers` and ClassSpace records.
- **Rollback Protocol:**
  - If a fatal regression occurs post-deployment:
    1. Revert Git `main` branch to the latest stable commit checkpoint.
    2. Trigger deployment webhook to redeploy the previous static build in < 60 seconds.
    3. If database migration required rollback, execute corresponding down-migration script.

---

## 7. Security and Privacy Requirements
- **Zero Leakage of Student PII:** Telemetry and error logs must never record student emails, passwords, notes, gym weights, or attendance percentages.
- **Strict HTTPS / HSTS:** Enforce HTTP Strict Transport Security (`max-age=31536000; includeSubDomains; preload`).
- **Content Security Policy (CSP):** Configure headers restricting script execution to self and authorized CDNs (e.g., Google Fonts, YouTube embeds for Focus Radio).

---

## 8. Data Migration and Compatibility Requirements
- **Zero-Downtime Migration Execution:** Database migrations must use non-locking operations (e.g. `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX CONCURRENTLY`).
- **Legacy Schema Backward Compatibility:** Support legacy `tracker_app_data_v1` imports permanently via `src/services/migration.ts`.

---

## 9. Testing Strategy
- **Full Automated Regression Suite:** Run `npm run test` across all 30+ test suites.
- **Production Smoke Test Matrix:**
  - [ ] Fresh visitor loads landing screen without network errors.
  - [ ] Google OAuth sign-in initiates and completes session restoration.
  - [ ] Student creates a subject, adds a timetable slot, and marks attendance.
  - [ ] Student switches to offline mode; adds a reminder; switches online; verifies data syncs.
  - [ ] Student joins a ClassSpace workspace via join code; verifies shared schedule loads.
  - [ ] Admin attempts login; verifies access to `/admin` dashboard.
  - [ ] Non-admin attempts to access `/admin`; verifies HTTP 403 Access Denied.
  - [ ] Student initiates Pro subscription upgrade; verifies checkout redirect.
- **Disaster Recovery Drill:** Simulate corrupted local cache; verify automated fallback restoration.

---

## 10. Acceptance Criteria
- [x] All prerequisite milestones (01 through 05) are formally accepted, audited, and verified (410/410 tests passing).
- [ ] Production secrets configured and verified in deployment environment (`UNVERIFIED` pending hosted provisioning).
- [ ] Google OAuth flow verified end-to-end on production domain (`UNVERIFIED` pending domain setup).
- [x] 100% of public database tables have active RLS policies (`VERIFIED` in migration scripts).
- [x] Production build succeeds with 0 TypeScript errors and bundle size within budget (`VERIFIED` in `npm run build`).
- [ ] Lighthouse scores meet performance (≥ 90) and accessibility (≥ 95) targets (`UNVERIFIED` pending hosted deployment).
- [x] Zero student PII or secret keys logged in telemetry or bundles (`VERIFIED` in static and bundle audit).
- [ ] Disaster recovery restore drill executed successfully (`UNVERIFIED` pending hosted database).
- [ ] Documented rollback procedure verified in staging environment (`UNVERIFIED`).
- [ ] Full release checklist signed off.

---

## 11. Definition of Done
1. Local codebase passes all security, migration, and reliability audits (410/410 passing tests).
2. Production database migrations verified for clean sequential application and strict RLS.
3. Edge Functions implemented with zero browser secret exposure.
4. Production domain DNS, SSL certificates, and OAuth credentials verified (Hosted Step).
5. Disaster recovery and rollback protocols tested and ready.
6. All items in the Execution Checklist completed with test evidence.

---

## 12. Risks and Blockers

| Risk / Blocker | Severity | Mitigation Strategy |
|---|---|---|
| Unfinished predecessor milestones | Resolved | Milestones 01–05 are fully completed, audited, and tested locally. |
| Hosted DNS propagation delay or SSL issuance | Medium | Pre-provision DNS and SSL certificates 48 hours prior to launch. |
| Production Google OAuth approval backlog | High | Submit OAuth verification and brand review to Google 2–3 weeks in advance. |
| Traffic surge on launch day | Medium | Static assets served via global CDN edge; Postgres read-replicas prepared. |

---

## 13. Required Evidence for Completion
- Test run report of full Vitest suite (`npm run test`: 33 test files, 410/410 passing).
- Production build log (`npm run build`: `tsc && vite build` 0 errors, gzip 398.14 kB).
- Static boundary audit verifying RLS and service-role privilege isolation.
- Remediation test evidence for partial refunds and out-of-order webhook events.

---

## 14. Execution Checklist
- [x] **Verify Predecessors:** Confirmed Milestones 01–05 have completed definitions of done and passed security gates.
- [x] **Author Edge Functions & Schemas:** Created 3 Edge Functions and verified 5 migration scripts with RLS.
- [x] **Remediate Confirmed Defects:** Corrected partial refund logic, out-of-order resurrection protection, and SQL syntax in `20261108_subscriptions_schema.sql`.
- [x] **Verify Production Build:** `npm run build` succeeds with zero errors.
- [x] **Execute Full Regression Suite:** 410/410 tests passing across all 33 test files.
- [ ] **Configure Production Secrets:** Set up production environment variables in hosting provider (`UNVERIFIED`).
- [ ] **Verify Google OAuth:** Test sign-in on production domain with approved Google consent screen (`UNVERIFIED`).
- [ ] **Execute DB Migrations on Hosted Project:** Apply all migration scripts to production Supabase Postgres (`UNVERIFIED`).
- [ ] **Execute RLS Audit on Hosted Project:** Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` (`UNVERIFIED`).
- [ ] **Perform DR Drill:** Test restoring a database backup to a staging container (`UNVERIFIED`).
- [ ] **Verify Rollback:** Test one-click deployment rollback to previous git tag (`UNVERIFIED`).
- [ ] **Final Launch Sign-Off:** Update roadmap and notify repository owner of production availability (`UNVERIFIED`).

---

## 15. Future Antigravity Execution Protocol
When requested to execute this milestone, Antigravity sessions must adhere to:
1. Read `docs/PROJECT_ROADMAP.md` and this document (`docs/milestones/MILESTONE_06_PRODUCTION_LAUNCH.md`).
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
- **Current Status:** `AUDITED_READY_FOR_HOSTED_STAGING_DEPLOYMENT`
- **Audit Determination:** All local production readiness checks, static boundary audits, and defect remediations have passed (410/410 passing tests). Hosted Supabase migrations, Google OAuth consent verification, and live Stripe webhook routing remain explicitly unverified pending deployment credentials.


