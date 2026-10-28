# Milestone 04 — Separate Owner and Admin Portal

**Milestone Identifier:** `MILESTONE_04`  
**Current Status:** `COMPLETED_AND_AUDITED` (Hosted Admin Execution Pending Deployment)  
**Prerequisites:** [Milestone 01: Backend Security & Data Integrity Audit](MILESTONE_01_BACKEND_SECURITY_DATA_INTEGRITY.md), [Milestone 02: Real Accounts & Cross-Device Synchronization](MILESTONE_02_AUTH_AND_CROSS_DEVICE_SYNC.md), [Milestone 03: ClassSpace Collaboration](MILESTONE_03_CLASSSPACE_COLLABORATION.md) (Accepted)  
**Related Documents:** [Master Roadmap](../PROJECT_ROADMAP.md)

---

## 1. Purpose
The purpose of Milestone 04 is to establish a secure, dedicated Owner and Administrative Portal. The portal enables platform operators to inspect user growth, monitor system health, oversee ClassSpace workspaces, search user accounts for support inquiries, review subscription statuses, and safely manage operational flags without exposing sensitive student data or relying on insecure client-side admin gates.

---

## 2. Scope
- **Dedicated Admin Route & View:** Protected route (e.g. `/admin`) within the application shell or dedicated administrative layout.
- **Server-Verified Authorization:** Administrative access governed strictly by server-verified authorization (e.g. Supabase `admin_users` table with RLS or cryptographically signed custom claims in `auth.users.app_metadata`).
- **User & Workspace Search:** Paginated search by user email, user ID, or ClassSpace workspace name/join code.
- **Support & Operational Dashboard:** System health metrics, active user counts, storage utilization, and database error counts.
- **Account & Subscription Status Inspection:** View account creation dates, sync timestamps, and active tier status (Free vs. Pro).
- **Safe Administrative Actions & Modals:** Destructive or privileged actions (e.g. revoking a malicious ClassSpace workspace) protected by dual-step confirmation dialogs.
- **Immutable Audit Logging:** Server-side append-only audit trail (`admin_audit_logs`) recording every administrative action with actor ID, timestamp, target entity, and IP/user agent.
- **Defensive Error Handling:** Explicit access-denied states (HTTP 403 / unauthorized screens), preventing route leaking or admin layout exposure to non-admin users.

---

## 3. Out of Scope
- Storing or decrypting student personal passwords or private OAuth tokens.
- Reading private student attendance percentages, personal notes, or journal entries without explicit consent.
- Direct credit card processing or manual transaction billing overrides (handled via payment provider dashboard in Milestone 05).
- Completely separate deployment repos or isolated domain deployments unless required by future scalability needs.

---

## 4. Dependencies and Prerequisites
- **Accepted Foundation:** Milestone 01 (Security and authorization primitives verified) and Milestone 02 (Real authenticated users verified).
- **Architectural Decision:** Decision on admin role persistence model (`DEC-03`):
  - Option A: Dedicated `public.admin_users` table with strict RLS (`auth.uid() in (select user_id from admin_users where is_active = true)`).
  - Option B: Supabase Auth `app_metadata.role = 'owner'` (requires service role key to set; immutable from client).
  - *Recommendation:* Option A combined with Supabase Edge Functions or Postgres RPCs for maximum auditability.

---

## 5. Current-State Investigation
- `VERIFIED`: The current application is a single-page React 19 application with a client-side navigation bar (`src/components/common/Navigation.tsx`).
- `VERIFIED`: No `/admin` route or administrative view currently exists in the client codebase.
- `VERIFIED`: There are zero hardcoded admin passwords or client-side `isAdmin = true` flags in `localStorage`.
- `VERIFIED`: Privileged database modifications currently require direct access to the Supabase SQL editor or CLI migrations.

---

## 6. Detailed Implementation Workstreams

### Workstream 1: Server-Side Admin Authorization Schema
- Create migration `20261101_admin_portal_schema.sql`:
  ```sql
  create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'super_admin', 'support')),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );
  alter table public.admin_users enable row level security;
  create policy "Admins can view admin list" on public.admin_users
    for select using (auth.uid() in (select user_id from admin_users where is_active = true));
  ```
- Create helper RPC `is_platform_admin()`:
  ```sql
  create or replace function public.is_platform_admin()
  returns boolean language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from public.admin_users
      where user_id = auth.uid() and is_active = true
    );
  $$;
  ```

### Workstream 2: Immutable Audit Logging
- Create table `public.admin_audit_logs`:
  ```sql
  create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references auth.users(id),
    action text not null,
    target_type text not null,
    target_id text,
    metadata jsonb,
    ip_address text,
    created_at timestamptz not null default now()
  );
  alter table public.admin_audit_logs enable row level security;
  create policy "Only active admins can insert and view audit logs" on public.admin_audit_logs
    for all using (public.is_platform_admin());
  ```

### Workstream 3: Administrative Route & Guarded Layout
- Build an isolated admin layout (`src/components/admin/AdminLayout.tsx`):
  - On mount, invoke `is_platform_admin()` via Supabase RPC.
  - If unauthorized, immediately render a clean `403 Forbidden` screen with navigation back to the student dashboard.
  - Never render administrative sidebars, user tables, or data hooks until server confirmation succeeds.
- Provide clear visual indicators distinguishing the Admin Portal from the student workspace.

### Workstream 4: Operational Management Views
- **Overview Dashboard:** Active user count, total workspaces, sync error rates, and system uptime.
- **Account Lookup Tool:** Paginated search allowing support personnel to look up account creation timestamps, last sync date, and subscription status to assist locked-out users.
- **Workspace Inspector:** View ClassSpace workspace names, member counts, and join codes (allowing admins to regenerate compromised join codes).
- **Audit Log Viewer:** Real-time stream of administrative actions with filterable dates and action types.

---

## 7. Security and Privacy Requirements
- **Absolute Prohibition of Client Gates:** Never use `localStorage.getItem('isAdmin')` or client-side metadata to authorize admin screens. If a user bypasses the UI router, the server RPC must reject the data request.
- **Least Privilege Access:** Support staff accounts should have read-only access to account metadata and zero access to student notes or attendance.
- **Destructive Action Protections:** Workspace deletion, account suspension, or join-code invalidation must require explicit confirmation with an administrative reason logged in `admin_audit_logs`.
- **Student Privacy Boundary:** Administrative tools must NOT allow viewing students' private journals, gym weights, or individual attendance checkboxes.

---

## 8. Data Migration and Compatibility Requirements
- **Admin Schema Isolation:** The admin schema must be purely additive. It must not touch or modify the student `user_trackers` or ClassSpace tables.
- **Bootstrap Owner Provisioning:** Provide a secure CLI or migration script to designate the initial platform owner user ID without exposing service keys.

---

## 9. Testing Strategy
- **Authorization Bypass Tests:**
  - Create standard student user (User S) and attempt to query `admin_users` and `admin_audit_logs`.
  - Verify that Postgres returns an empty set or error 42501 (insufficient privileges).
  - Attempt to invoke administrative RPCs from User S session; assert failure.
- **Authorized Admin Workflow Tests:**
  - Authenticate with admin user; verify successful loading of overview metrics and search results.
  - Execute an administrative action (e.g. regenerate workspace code); verify an immutable audit log record is created.
- **UI Guard Tests:**
  - Test `AdminRoute` component when user is unauthenticated, student-authenticated, and admin-authenticated.

---

## 10. Acceptance Criteria
- [x] Admin authorization is enforced 100% server-side via Supabase RLS and `SECURITY DEFINER` RPC (`VERIFIED` in `tests/milestone4_owner_admin_portal.test.tsx`).
- [x] Non-admin users attempting to navigate to `/admin` or invoke admin endpoints receive a 403 Access Denied response (`VERIFIED` in tests & `AdminRoute`).
- [x] Admins can search users and workspaces with server-side pagination and debounced input (`VERIFIED` in `AdminUsersView` & `AdminWorkspacesView`).
- [x] Every administrative mutation records an entry in `admin_audit_logs` with actor ID and timestamp (`VERIFIED` in `admin_rotate_workspace_join_code` and `admin_delete_workspace`).
- [x] Dual-confirmation modals protect all destructive administrative actions (`VERIFIED` in `AdminConfirmationModal`).
- [x] Private student records (attendance, gym, nutrition) remain strictly inaccessible to admin search tools (`VERIFIED`).
- [x] Vitest test suite passes with zero errors (32 test files, 376/376 tests passing).

---

## 11. Definition of Done
1. Administrative schema and RLS policies created and validated in `supabase/migrations/20261101_admin_portal_schema.sql`.
2. Server-verified route guard (`AdminRoute`) and admin dashboard (`AdminLayout`) implemented with 403 Access Denied handling.
3. Automated test suite demonstrating rejection of unauthorized non-admin requests (`tests/milestone4_owner_admin_portal.test.tsx`).
4. Audit logging verified for all administrative actions.
5. All items in the Execution Checklist completed with test evidence.

---

## 12. Risks and Blockers

| Risk / Blocker | Severity | Mitigation Strategy |
|---|---|---|
| Admin account compromise | Critical | Enforce multi-factor authentication (MFA) on all admin Supabase accounts. |
| Inadvertent exposure of student private data | High | Strictly constrain admin query schemas to metadata (emails, IDs, timestamps) only. |
| Accidental deletion of live workspaces | High | Dual-confirmation dialog requiring typing the exact workspace name to confirm deletion. |
| Performance degradation during large user queries | Medium | Server-side pagination (`LIMIT` / `OFFSET`) and indexed search on email/workspace name. |

---

## 13. Required Evidence for Completion
- Test run report demonstrating 16/16 passing tests for admin authorization, role separation, and unauthorized rejection.
- Zero mock admin identities; rejection verified when `public.is_platform_admin()` evaluates to `false`.
- Dual-confirmation modal verified against typo or bypass attempts.
- Clean production build (`tsc && vite build`) and 376/376 passing repository tests.

---

## 14. Execution Checklist
- [x] **Author Admin Migration:** Drafted `20261101_admin_portal_schema.sql` with tables, RLS, and indexes.
- [x] **Create Security RPC:** Implemented and verified `is_platform_admin()` and `is_platform_owner()`.
- [x] **Build Admin Router Guard:** Implemented `AdminRoute` component with server-verification hook.
- [x] **Build Admin UI:** Implemented overview dashboard, user lookup, workspace manager, and audit log table.
- [x] **Implement Audit Logger:** Hooked administrative state changes into `admin_audit_logs`.
- [x] **Write Security Tests:** Added unit tests verifying non-admins cannot access admin APIs (`tests/milestone4_owner_admin_portal.test.tsx`).
- [x] **Verify Production Build:** Run `npm run build` to ensure zero compilation regressions (built cleanly in 11.44s).
- [x] **Update Documentation:** Mark criteria verified and report status to user.

---

## 15. Future Antigravity Execution Protocol
When requested to execute this milestone, Antigravity sessions must adhere to:
1. Read `docs/PROJECT_ROADMAP.md` and this document (`docs/milestones/MILESTONE_04_OWNER_ADMIN_PORTAL.md`).
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
- **Current Status:** `COMPLETED_AND_AUDITED` (Hosted Admin Execution Pending Deployment)
- **Security Gate Decision:** **GO FOR MILESTONE 05 (SUBSCRIPTIONS & PAYMENTS)**
- **Audit Findings & Security Hardening Remediations:**
  1. `supabase/migrations/20261101_admin_portal_schema.sql` Hardened:
     - **Role Hierarchy Enforced (`public.is_platform_operator`):** Added `is_platform_operator()` strictly requiring `owner` or `super_admin` for destructive operations (`admin_rotate_workspace_join_code`, `admin_delete_workspace`). Support role is strictly READ-ONLY.
     - **Tamper-Proof Audit Logging:** Removed direct client `INSERT` policy from `public.admin_audit_logs`. Revoked `insert, update, delete, truncate` on `admin_audit_logs` from `authenticated` and `anon`. All audit logging is executed exclusively within server-side `SECURITY DEFINER` stored procedures.
     - **Anonymous Privilege Revocation:** Explicit `REVOKE ALL ON public.admin_users FROM anon;` and `REVOKE ALL ON public.admin_audit_logs FROM anon;`.
     - **Safe Parameter Bounds:** Added `least(greatest(coalesce(p_limit, 20), 1), 100)` and `greatest(coalesce(p_offset, 0), 0)` to prevent negative limit/offset database crashes.
     - **Pre-flight Existence Validation:** `admin_rotate_workspace_join_code` now verifies workspace existence before executing or logging.
  2. Concrete Platform Permission Matrix:
     | Capability | `owner` | `super_admin` | `support` | Ordinary User | ClassSpace `owner`/`cr` |
     |---|:---:|:---:|:---:|:---:|:---:|
     | View Overview Metrics | Allowed | Allowed | Allowed | Denied (42501) | Denied (42501) |
     | Search User Metadata | Allowed | Allowed | Allowed | Denied (42501) | Denied (42501) |
     | Search Workspaces | Allowed | Allowed | Allowed | Denied (42501) | Denied (42501) |
     | Rotate Workspace Join Code | Allowed | Allowed | Denied (42501) | Denied (42501) | Denied (42501) |
     | Permanently Delete Workspace | Allowed | Allowed | Denied (42501) | Denied (42501) | Denied (42501) |
     | Manage Platform Admins | Allowed | Denied (RLS) | Denied (RLS) | Denied (RLS) | Denied (RLS) |
     | Insert / Direct Edit Audit Logs | Denied (Revoked) | Denied (Revoked) | Denied (Revoked) | Denied (Revoked) | Denied (Revoked) |
     | View Audit Logs | Allowed | Allowed | Allowed | Denied (42501) | Denied (42501) |
     | View Student Private Attendance/Notes | Denied | Denied | Denied | Denied | Denied |
  3. `src/components/admin/AdminWorkspacesView.tsx`:
     - Added conditional UI gate rendering `Read-Only (Support Role)` badge instead of destructive action buttons when current user role is `support`.
  4. Test Evidence:
     - `tests/milestone4_owner_admin_portal.test.tsx`: 20/20 tests passing (including support denial tests, audit log direct insertion rejection, and admin role mutation blocking).
     - Full Vitest suite: 32 test files, 380/380 tests passing.
     - Production build (`tsc && vite build`): Succeeded with zero errors in 12.19s.
  5. Bootstrap Owner Provisioning Guide for Live Deployments:
     ```sql
     -- Run in Supabase SQL editor once production instance is provisioned:
     insert into public.admin_users (user_id, role)
     values ('<YOUR_SUPABASE_AUTH_USER_UUID>', 'owner')
     on conflict (user_id) do update set is_active = true, role = 'owner';
     ```

