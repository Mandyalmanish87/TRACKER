-- ==============================================================================
-- TRACKER: ClassSpace Workspace Creation & Membership RLS Hardening Repair
-- Migration: 20261102_classspace_workspace_creation_fix.sql
-- Description:
--   1. Breaks circular RLS dependency between class_members and class_workspaces
--      by introducing a SECURITY DEFINER helper public.is_class_workspace_creator().
--   2. Ensures the creator can reliably insert their initial owner/cr membership
--      and immediately read back the record via RETURNING * without RLS rejection.
--   3. Provides atomic server-authoritative RPC public.create_class_workspace()
--      for robust single-transaction workspace and owner membership creation.
--   4. Fixes lookup_workspace_by_join_code RPC to safely drop previous signature
--      (preventing PostgreSQL 42P13 error) and support both 'institution' and 'college'.
-- ==============================================================================

-- 1. Helper Function: is_class_workspace_creator (bypasses RLS recursion)
create or replace function public.is_class_workspace_creator(ws_id uuid, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_workspaces
    where id = ws_id and created_by = u_id
  );
$$;

revoke all on function public.is_class_workspace_creator(uuid, uuid) from public, anon;
grant execute on function public.is_class_workspace_creator(uuid, uuid) to authenticated, service_role;

-- 2. class_members: Fix INSERT RLS policy for workspace creators
drop policy if exists "Workspace creators can insert their initial membership upon creation" on public.class_members;
drop policy if exists "Users can join workspaces as member or CR upon creation" on public.class_members;

create policy "Workspace creators can insert their initial membership upon creation"
  on public.class_members
  for insert
  with check (
    auth.uid() = user_id and
    role in ('owner', 'cr') and
    public.is_class_workspace_creator(workspace_id, auth.uid())
  );

-- 3. class_members: Fix SELECT RLS policy so users can always select their own membership
drop policy if exists "Workspace members can view member directory" on public.class_members;
drop policy if exists "Members can view membership directory of their workspace" on public.class_members;

create policy "Workspace members can view member directory"
  on public.class_members
  for select
  using (
    auth.uid() = user_id or
    public.is_class_member(workspace_id, auth.uid())
  );

-- 4. class_workspaces: Ensure SELECT policy is robust for authenticated creators and members
drop policy if exists "Members and creators can view workspaces" on public.class_workspaces;
drop policy if exists "Members and join-code lookups can view workspaces" on public.class_workspaces;

create policy "Members and creators can view workspaces"
  on public.class_workspaces
  for select
  using (
    auth.uid() is not null and (
      created_by = auth.uid() or
      public.is_class_member(id, auth.uid())
    )
  );

-- 5. Stored Procedure: create_class_workspace (Atomic Transaction with Concurrency-Safe Retry)
drop function if exists public.create_class_workspace(text, text, text, text, text, text, text, text);

create or replace function public.create_class_workspace(
  p_name text,
  p_institution text default null,
  p_department text default null,
  p_section text default null,
  p_batch text default null,
  p_description text default null,
  p_display_name text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_join_code text := '';
  v_i int;
  v_attempts int := 0;
  v_new_ws record;
  v_new_member record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'Authentication required (401)');
  end if;

  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('error', 'ClassSpace name is required.');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  -- Concurrency-safe unique join code generation and insertion
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then
      return jsonb_build_object('error', 'Unable to generate a unique join code. Please try again.');
    end if;

    v_join_code := '';
    for v_i in 1..5 loop
      v_join_code := v_join_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    -- Attempt insert with unique constraint collision handling
    begin
      insert into public.class_workspaces (
        name,
        college,
        institution,
        department,
        section,
        batch,
        description,
        join_code,
        created_by
      ) values (
        trim(p_name),
        nullif(trim(p_institution), ''),
        nullif(trim(p_institution), ''),
        nullif(trim(p_department), ''),
        nullif(trim(p_section), ''),
        nullif(trim(p_batch), ''),
        nullif(trim(p_description), ''),
        v_join_code,
        v_user_id
      )
      returning * into v_new_ws;

      exit; -- Insertion succeeded without collision
    exception when unique_violation then
      -- Unique code collision occurred concurrently; retry with a new code
    end;
  end loop;

  -- 2. Insert Creator as Owner
  insert into public.class_members (
    workspace_id,
    user_id,
    role,
    display_name,
    avatar_url
  ) values (
    v_new_ws.id,
    v_user_id,
    'owner',
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(v_user_email, 'user@example.com'), '@', 1)),
    p_avatar_url
  )
  returning * into v_new_member;

  return jsonb_build_object(
    'workspace', row_to_json(v_new_ws),
    'member', row_to_json(v_new_member)
  );
end;
$$;

revoke all on function public.create_class_workspace(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_class_workspace(text, text, text, text, text, text, text, text) to authenticated, service_role;

-- 6. Stored Procedure Fix: lookup_workspace_by_join_code (Fixes 42P13 return type change & boolean auth check)
drop function if exists public.lookup_workspace_by_join_code(text);

create or replace function public.lookup_workspace_by_join_code(p_join_code text)
returns table (
  id uuid,
  name text,
  college text,
  institution text,
  department text,
  section text,
  batch text,
  description text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_normalized text;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    return;
  end if;

  v_normalized := upper(regexp_replace(trim(p_join_code), '[\s-]', '', 'g'));
  if length(v_normalized) <> 5 or v_normalized !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$' then
    return;
  end if;

  return query
  select
    w.id,
    w.name,
    coalesce(w.institution, w.college) as college,
    coalesce(w.institution, w.college) as institution,
    w.department,
    w.section,
    w.batch,
    w.description
  from public.class_workspaces w
  where upper(w.join_code) = v_normalized
  limit 1;
end;
$$;

revoke all on function public.lookup_workspace_by_join_code(text) from public, anon;
grant execute on function public.lookup_workspace_by_join_code(text) to authenticated, service_role;

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
