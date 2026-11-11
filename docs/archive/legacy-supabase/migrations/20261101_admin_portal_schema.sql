-- ==============================================================================
-- TRACKER: Owner & Platform Administrative Portal Schema
-- Migration: 20261101_admin_portal_schema.sql
-- Description:
--   Establishes server-authoritative administrative foundation for Tracker:
--   1. admin_users: Server-verified administrative directory with role boundaries.
--   2. admin_audit_logs: Immutable, append-only operational audit trail.
--   3. is_platform_admin(), is_platform_operator(), is_platform_owner(): SECURITY DEFINER authorization checks.
--   4. Administrative RPCs with strict privilege boundaries (support is read-only).
-- ==============================================================================

-- 1. Table: public.admin_users
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'super_admin', 'support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Performance index
create index if not exists idx_admin_users_user_id on public.admin_users(user_id);

-- 2. Authorization Helper Functions
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function public.is_platform_operator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role in ('owner', 'super_admin') and is_active = true
  );
$$;

revoke all on function public.is_platform_operator() from public, anon;
grant execute on function public.is_platform_operator() to authenticated, service_role;

create or replace function public.is_platform_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'owner' and is_active = true
  );
$$;

revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated, service_role;

-- RLS Policies on admin_users
drop policy if exists "Admins can view admin list" on public.admin_users;
create policy "Admins can view admin list" on public.admin_users
  for select using (public.is_platform_admin());

drop policy if exists "Only platform owners can manage admins" on public.admin_users;
create policy "Only platform owners can manage admins" on public.admin_users
  for all using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- 3. Table: public.admin_audit_logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

-- Performance indexes for audit queries
create index if not exists idx_admin_audit_logs_actor on public.admin_audit_logs(actor_id);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);

-- RLS Policies on admin_audit_logs (Strictly Append-Only via server procedures)
drop policy if exists "Only active admins can view audit logs" on public.admin_audit_logs;
create policy "Only active admins can view audit logs" on public.admin_audit_logs
  for select using (public.is_platform_admin());

-- Remove direct client insert policy; logging strictly through SECURITY DEFINER RPCs
drop policy if exists "Only active admins can insert audit logs" on public.admin_audit_logs;

-- Defense-in-depth table grants: revoke direct mutations on audit logs
revoke all on table public.admin_users from anon;
revoke all on table public.admin_audit_logs from anon;
revoke insert, update, delete, truncate on table public.admin_audit_logs from authenticated;

-- 4. Stored Procedure: get_admin_overview_metrics
create or replace function public.get_admin_overview_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_users bigint;
  v_total_workspaces bigint;
  v_total_attendance_records bigint;
  v_active_users_7d bigint;
begin
  if not public.is_platform_admin() then
    raise exception 'Access denied: platform administrator privileges required (42501)';
  end if;

  select count(*) into v_total_users from auth.users;
  select count(*) into v_total_workspaces from public.class_workspaces;
  select count(*) into v_total_attendance_records from public.class_attendance_records;
  
  select count(distinct user_id) into v_active_users_7d 
  from public.user_trackers 
  where updated_at >= now() - interval '7 days';

  return jsonb_build_object(
    'total_users', coalesce(v_total_users, 0),
    'total_workspaces', coalesce(v_total_workspaces, 0),
    'total_attendance_records', coalesce(v_total_attendance_records, 0),
    'active_users_7d', coalesce(v_active_users_7d, 0),
    'system_status', 'operational',
    'timestamp', now()
  );
end;
$$;

revoke all on function public.get_admin_overview_metrics() from public, anon;
grant execute on function public.get_admin_overview_metrics() to authenticated, service_role;

-- 5. Stored Procedure: search_users_for_support
create or replace function public.search_users_for_support(
  p_query text default '',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_synced_at timestamptz,
  subscription_tier text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Access denied: platform administrator privileges required (42501)';
  end if;

  return query
  select
    u.id as user_id,
    u.email::text as email,
    u.created_at,
    u.last_sign_in_at,
    t.updated_at as last_synced_at,
    coalesce(u.raw_app_meta_data->>'subscription_tier', 'free')::text as subscription_tier
  from auth.users u
  left join public.user_trackers t on t.user_id = u.id
  where (
    coalesce(p_query, '') = '' or
    u.email ilike '%' || p_query || '%' or
    u.id::text ilike '%' || p_query || '%'
  )
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.search_users_for_support(text, int, int) from public, anon;
grant execute on function public.search_users_for_support(text, int, int) to authenticated, service_role;

-- 6. Stored Procedure: search_workspaces_for_admin
create or replace function public.search_workspaces_for_admin(
  p_query text default '',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  institution text,
  join_code text,
  created_by uuid,
  created_at timestamptz,
  member_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Access denied: platform administrator privileges required (42501)';
  end if;

  return query
  select
    w.id,
    w.name,
    w.institution,
    w.join_code,
    w.created_by,
    w.created_at,
    coalesce(count(m.id), 0)::bigint as member_count
  from public.class_workspaces w
  left join public.class_members m on m.workspace_id = w.id
  where (
    coalesce(p_query, '') = '' or
    w.name ilike '%' || p_query || '%' or
    w.institution ilike '%' || p_query || '%' or
    w.join_code ilike '%' || p_query || '%' or
    w.id::text ilike '%' || p_query || '%'
  )
  group by w.id, w.name, w.institution, w.join_code, w.created_by, w.created_at
  order by w.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.search_workspaces_for_admin(text, int, int) from public, anon;
grant execute on function public.search_workspaces_for_admin(text, int, int) to authenticated, service_role;

-- 7. Stored Procedure: admin_rotate_workspace_join_code
create or replace function public.admin_rotate_workspace_join_code(
  p_workspace_id uuid,
  p_reason text default 'Administrative rotation'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_new_code text := '';
  v_i int;
  v_exists boolean;
  v_ws_exists boolean;
begin
  -- Strictly enforce operator privileges (owner or super_admin only; support is read-only)
  if not public.is_platform_operator() then
    raise exception 'Access denied: operator privileges required (owner or super_admin) (42501)';
  end if;

  select exists (
    select 1 from public.class_workspaces where id = p_workspace_id
  ) into v_ws_exists;

  if not v_ws_exists then
    raise exception 'Workspace not found (404)';
  end if;

  -- Generate collision-free 5-char code
  loop
    v_new_code := '';
    for v_i in 1..5 loop
      v_new_code := v_new_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    select exists (
      select 1 from public.class_workspaces where join_code = v_new_code
    ) into v_exists;

    exit when not v_exists;
  end loop;

  update public.class_workspaces
  set join_code = v_new_code, updated_at = now()
  where id = p_workspace_id;

  -- Record in audit logs
  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    'rotate_join_code',
    'class_workspace',
    p_workspace_id::text,
    jsonb_build_object('reason', p_reason, 'new_code', v_new_code)
  );

  return v_new_code;
end;
$$;

revoke all on function public.admin_rotate_workspace_join_code(uuid, text) from public, anon;
grant execute on function public.admin_rotate_workspace_join_code(uuid, text) to authenticated, service_role;

-- 8. Stored Procedure: admin_delete_workspace
create or replace function public.admin_delete_workspace(
  p_workspace_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws_name text;
begin
  -- Strictly enforce operator privileges (owner or super_admin only; support is read-only)
  if not public.is_platform_operator() then
    raise exception 'Access denied: operator privileges required (owner or super_admin) (42501)';
  end if;

  select name into v_ws_name from public.class_workspaces where id = p_workspace_id;
  if v_ws_name is null then
    raise exception 'Workspace not found (404)';
  end if;

  -- Record audit trail BEFORE deletion
  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    'delete_workspace',
    'class_workspace',
    p_workspace_id::text,
    jsonb_build_object('workspace_name', v_ws_name, 'reason', p_reason)
  );

  -- Delete workspace (cascades to members, rules, etc.)
  delete from public.class_workspaces where id = p_workspace_id;

  return true;
end;
$$;

revoke all on function public.admin_delete_workspace(uuid, text) from public, anon;
grant execute on function public.admin_delete_workspace(uuid, text) to authenticated, service_role;
