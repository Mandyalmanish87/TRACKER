-- ==============================================================================
-- TRACKER: ClassSpace Security & RLS Hardening Forward Migration
-- Migration: 20261025_classspace_security_hardening.sql
-- Description:
--   Safely and idempotently applies Row Level Security (RLS) hardening to
--   existing databases deployed with 20261022_classspace_schema.sql, as well
--   as subsequent fresh database deployments.
--
-- Remediations:
--   1. class_workspaces: Workspace deletion restricted strictly to the workspace
--      creator or explicit owner role (preventing non-owner CRs/co-admins from deleting).
--   2. class_members: UPDATE policy restricts CR role assignment (preventing privilege
--      escalation to owner or modifying the workspace creator).
--   3. class_members: DELETE policy prevents CRs from kicking the workspace creator or owner.
--   4. class_attendance_records: SELECT policy decoupled from active membership
--      (using auth.uid() = user_id) so students preserve access to their historical
--      attendance records after leaving a workspace.
-- ==============================================================================

-- 1. class_workspaces: Delete restricted strictly to creator/owner
drop policy if exists "Only CR can delete workspace" on public.class_workspaces;
drop policy if exists "Only workspace owner can delete workspace" on public.class_workspaces;

create policy "Only workspace owner can delete workspace"
  on public.class_workspaces
  for delete
  using (
    auth.uid() = created_by or
    exists (
      select 1 from public.class_members
      where workspace_id = id and user_id = auth.uid() and role = 'owner'
    )
  );

-- 2. class_members: Privilege escalation prevention on role update
drop policy if exists "Users can update their own membership profile; CR can update roles" on public.class_members;

create policy "Users can update their own membership profile; CR can update roles"
  on public.class_members
  for update
  using (auth.uid() = user_id or public.is_class_cr(workspace_id, auth.uid()))
  with check (
    -- Normal user updating own profile without changing role
    (auth.uid() = user_id and role = (select m.role from public.class_members m where m.id = id))
    or
    -- Workspace creator updating any role
    exists (
      select 1 from public.class_workspaces w
      where w.id = workspace_id and w.created_by = auth.uid()
    )
    or
    -- CR updating roles, but cannot modify workspace owner role or elevate to owner
    (
      public.is_class_cr(workspace_id, auth.uid()) and
      role in ('cr', 'co_admin', 'member') and
      not exists (
        select 1 from public.class_workspaces w
        where w.id = workspace_id and w.created_by = class_members.user_id
      ) and
      class_members.role <> 'owner'
    )
  );

-- 3. class_members: Kicking workspace creator/owner prevented
drop policy if exists "Users can leave workspace; CR can remove members" on public.class_members;
drop policy if exists "Users can leave workspace; CR can remove non-owner members" on public.class_members;

create policy "Users can leave workspace; CR can remove non-owner members"
  on public.class_members
  for delete
  using (
    auth.uid() = user_id or (
      public.is_class_cr(workspace_id, auth.uid()) and
      not exists (
        select 1 from public.class_workspaces w
        where w.id = workspace_id and w.created_by = class_members.user_id
      ) and
      class_members.role <> 'owner'
    )
  );

-- 4. class_attendance_records: Retain read access for individual student
drop policy if exists "Students can view only their own personal attendance records" on public.class_attendance_records;

create policy "Students can view only their own personal attendance records"
  on public.class_attendance_records
  for select
  using (auth.uid() = user_id);

