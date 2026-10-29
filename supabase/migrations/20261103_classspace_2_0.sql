-- ==============================================================================
-- TRACKER: CLASSSPACE 2.0 SCHEMA & SECURITY MIGRATION
-- Migration: 20261103_classspace_2_0.sql
-- Description:
--   1. Realtime community publications for live message and profile updates.
--   2. Multi-channel support (The Commons, Study Vault, Class Pulse) + channel backfill.
--   3. Secure code-based join requests with CR review & approval workflow.
--   4. Role transfer (atomic CR handover) and delegated Co-Admin notice permissions.
--   5. Official notice auto-pinning and durable broadcast notifications.
--   6. Profile sync trigger between class_profiles and class_members.
-- ==============================================================================

-- 1. Channels Table
create table if not exists public.class_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_default boolean not null default false,
  is_system boolean not null default false,
  position int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists idx_class_channels_ws on public.class_channels(workspace_id, position asc);

-- Add channel_id to class_messages
alter table public.class_messages add column if not exists channel_id uuid references public.class_channels(id) on delete cascade;
create index if not exists idx_class_messages_channel on public.class_messages(channel_id, created_at desc);

-- Add can_publish_notices flag to class_members for delegated Co-Admin notice powers
alter table public.class_members add column if not exists can_publish_notices boolean not null default false;

-- 2. Join Requests Table
create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_class_join_requests_ws on public.class_join_requests(workspace_id, status);
create index if not exists idx_class_join_requests_user on public.class_join_requests(user_id, status);

-- 3. Row Level Security for Channels
alter table public.class_channels enable row level security;

drop policy if exists "Members can read workspace channels" on public.class_channels;
create policy "Members can read workspace channels"
  on public.class_channels
  for select
  using (public.is_class_member(workspace_id, auth.uid()));

drop policy if exists "CR can create workspace channels" on public.class_channels;
create policy "CR can create workspace channels"
  on public.class_channels
  for insert
  with check (public.is_class_cr(workspace_id, auth.uid()));

drop policy if exists "CR can update workspace channels" on public.class_channels;
create policy "CR can update workspace channels"
  on public.class_channels
  for update
  using (public.is_class_cr(workspace_id, auth.uid()));

drop policy if exists "CR can delete non-default workspace channels" on public.class_channels;
create policy "CR can delete non-default workspace channels"
  on public.class_channels
  for delete
  using (public.is_class_cr(workspace_id, auth.uid()) and is_default = false);

-- 4. Row Level Security for Join Requests
alter table public.class_join_requests enable row level security;

drop policy if exists "Users and CRs can view relevant join requests" on public.class_join_requests;
create policy "Users and CRs can view relevant join requests"
  on public.class_join_requests
  for select
  using (
    auth.uid() = user_id or
    public.is_class_cr(workspace_id, auth.uid())
  );

drop policy if exists "Authenticated users can submit join request for themselves" on public.class_join_requests;
create policy "Authenticated users can submit join request for themselves"
  on public.class_join_requests
  for insert
  with check (
    auth.uid() = user_id and
    status = 'pending'
  );

drop policy if exists "CRs can update join requests" on public.class_join_requests;
create policy "CRs can update join requests"
  on public.class_join_requests
  for update
  using (public.is_class_cr(workspace_id, auth.uid()));

drop policy if exists "Users can cancel or CRs can delete join requests" on public.class_join_requests;
create policy "Users can cancel or CRs can delete join requests"
  on public.class_join_requests
  for delete
  using (
    auth.uid() = user_id or
    public.is_class_cr(workspace_id, auth.uid())
  );

-- 5. Helper Function: is_class_notice_publisher
create or replace function public.is_class_notice_publisher(ws_id uuid, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where workspace_id = ws_id
      and user_id = u_id
      and (
        role in ('owner', 'cr') or
        (role = 'co_admin' and can_publish_notices = true)
      )
  );
$$;

revoke all on function public.is_class_notice_publisher(uuid, uuid) from public, anon;
grant execute on function public.is_class_notice_publisher(uuid, uuid) to authenticated, service_role;

-- 6. Hardened Row Level Security for Messages (Enforce Notice Publishing & Pinning Rights)
drop policy if exists "Members can send community messages" on public.class_messages;
create policy "Members can send community messages"
  on public.class_messages
  for insert
  with check (
    auth.uid() = sender_id and
    public.is_class_member(workspace_id, auth.uid()) and
    (
      (coalesce(is_pinned, false) = false and coalesce(message_type, 'text') <> 'announcement') or
      public.is_class_notice_publisher(workspace_id, auth.uid())
    )
  );

drop policy if exists "Users can edit own messages; Admins can moderate" on public.class_messages;
drop policy if exists "Users can edit own messages; Notice publishers can pin" on public.class_messages;
create policy "Users can edit own messages; Notice publishers can pin"
  on public.class_messages
  for update
  using (
    auth.uid() = sender_id or
    public.is_class_admin(workspace_id, auth.uid()) or
    public.is_class_notice_publisher(workspace_id, auth.uid())
  )
  with check (
    (
      (coalesce(is_pinned, false) = false and coalesce(message_type, 'text') <> 'announcement') or
      public.is_class_notice_publisher(workspace_id, auth.uid())
    )
  );

drop policy if exists "Users can delete own messages; Admins can moderate" on public.class_messages;
create policy "Users can delete own messages; Admins can moderate"
  on public.class_messages
  for delete
  using (auth.uid() = sender_id or public.is_class_admin(workspace_id, auth.uid()));

-- 7. Helper Procedure: ensure_default_channels
create or replace function public.ensure_default_channels(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
begin
  select created_by into v_creator from public.class_workspaces where id = p_workspace_id;

  -- 1. The Commons
  insert into public.class_channels (workspace_id, name, slug, description, is_default, position, created_by)
  values (
    p_workspace_id,
    'The Commons',
    'the-commons',
    'General class discussion, questions, and coordination',
    true,
    1,
    v_creator
  )
  on conflict (workspace_id, slug) do nothing;

  -- 2. Study Vault
  insert into public.class_channels (workspace_id, name, slug, description, is_default, position, created_by)
  values (
    p_workspace_id,
    'Study Vault',
    'study-vault',
    'Notes, PDFs, study material, resources, and academic discussions',
    true,
    2,
    v_creator
  )
  on conflict (workspace_id, slug) do nothing;

  -- 3. Class Pulse
  insert into public.class_channels (workspace_id, name, slug, description, is_default, position, created_by)
  values (
    p_workspace_id,
    'Class Pulse',
    'class-pulse',
    'Official class updates, timetable changes, and alerts',
    true,
    3,
    v_creator
  )
  on conflict (workspace_id, slug) do nothing;
end;
$$;

revoke all on function public.ensure_default_channels(uuid) from public, anon;
grant execute on function public.ensure_default_channels(uuid) to authenticated, service_role;

-- 7. Join Request RPC: request_to_join_workspace
create or replace function public.request_to_join_workspace(
  p_join_code text,
  p_display_name text,
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
  v_normalized_code text;
  v_ws record;
  v_existing_member record;
  v_existing_req record;
  v_new_req record;
  v_cr_user_id uuid;
  v_req_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null or auth.role() <> 'authenticated' then
    return jsonb_build_object('error', 'Authentication required (401)');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  v_normalized_code := upper(regexp_replace(trim(p_join_code), '[\s-]', '', 'g'));

  if length(v_normalized_code) <> 5 or v_normalized_code !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$' then
    return jsonb_build_object('error', 'Invalid join code format. Must be 5 alphanumeric characters.');
  end if;

  select * into v_ws
  from public.class_workspaces
  where upper(join_code) = v_normalized_code;

  if v_ws.id is null then
    return jsonb_build_object('error', 'No ClassSpace found with this Join Code. Please verify with your CR.');
  end if;

  -- Check if already member
  select * into v_existing_member
  from public.class_members
  where workspace_id = v_ws.id and user_id = v_user_id;

  if v_existing_member.id is not null then
    return jsonb_build_object('error', 'You are already an enrolled member of this ClassSpace.');
  end if;

  v_req_name := coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(v_user_email, 'Student'), '@', 1));

  -- Check existing join request
  select * into v_existing_req
  from public.class_join_requests
  where workspace_id = v_ws.id and user_id = v_user_id;

  if v_existing_req.id is not null then
    if v_existing_req.status = 'pending' then
      return jsonb_build_object(
        'status', 'pending',
        'message', 'Your join request is already pending approval by the Class Representative.',
        'workspace', row_to_json(v_ws),
        'request', row_to_json(v_existing_req)
      );
    elsif v_existing_req.status = 'rejected' then
      -- Re-open request
      update public.class_join_requests
      set status = 'pending',
          display_name = v_req_name,
          avatar_url = p_avatar_url,
          updated_at = now()
      where id = v_existing_req.id
      returning * into v_new_req;
    else
      -- already approved record, proceed
      v_new_req := v_existing_req;
    end if;
  else
    insert into public.class_join_requests (
      workspace_id,
      user_id,
      display_name,
      avatar_url,
      status
    ) values (
      v_ws.id,
      v_user_id,
      v_req_name,
      p_avatar_url,
      'pending'
    )
    returning * into v_new_req;
  end if;

  -- Find workspace CR to dispatch notification
  select user_id into v_cr_user_id
  from public.class_members
  where workspace_id = v_ws.id and role in ('owner', 'cr')
  order by joined_at asc
  limit 1;

  if v_cr_user_id is not null and v_cr_user_id <> v_user_id then
    insert into public.class_notifications (
      workspace_id,
      user_id,
      title,
      body,
      type
    ) values (
      v_ws.id,
      v_cr_user_id,
      'New Join Request',
      v_req_name || ' requested to join ' || v_ws.name || '.',
      'membership'
    );
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'message', 'Join request submitted! Awaiting approval from the Class Representative.',
    'workspace', row_to_json(v_ws),
    'request', row_to_json(v_new_req)
  );
end;
$$;

revoke all on function public.request_to_join_workspace(text, text, text) from public, anon;
grant execute on function public.request_to_join_workspace(text, text, text) to authenticated, service_role;

-- 8. Review Join Request RPC: review_join_request
create or replace function public.review_join_request(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_req record;
  v_ws record;
  v_is_cr boolean;
  v_new_member record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'Authentication required (401)');
  end if;

  select * into v_req
  from public.class_join_requests
  where id = p_request_id;

  if v_req.id is null then
    return jsonb_build_object('error', 'Join request not found.');
  end if;

  select * into v_ws
  from public.class_workspaces
  where id = v_req.workspace_id;

  -- Check if caller is authorized CR
  v_is_cr := public.is_class_cr(v_req.workspace_id, v_user_id);
  if not v_is_cr then
    return jsonb_build_object('error', 'Only the Class Representative can review join requests.');
  end if;

  -- Prevent self-approval
  if v_req.user_id = v_user_id then
    return jsonb_build_object('error', 'Cannot approve your own join request.');
  end if;

  if p_action = 'approve' then
    -- Mark request approved
    update public.class_join_requests
    set status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        updated_at = now()
    where id = p_request_id;

    -- Add to class_members as Student ('member')
    insert into public.class_members (
      workspace_id,
      user_id,
      role,
      display_name,
      avatar_url
    ) values (
      v_req.workspace_id,
      v_req.user_id,
      'member',
      v_req.display_name,
      v_req.avatar_url
    )
    on conflict (workspace_id, user_id) do nothing
    returning * into v_new_member;

    -- Send notification to approved student
    insert into public.class_notifications (
      workspace_id,
      user_id,
      title,
      body,
      type
    ) values (
      v_req.workspace_id,
      v_req.user_id,
      'Join Request Approved',
      'You are now a student in ' || v_ws.name || '. Welcome!',
      'membership'
    );

    return jsonb_build_object('success', true, 'status', 'approved', 'member', row_to_json(v_new_member));
  elsif p_action = 'reject' then
    update public.class_join_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        updated_at = now()
    where id = p_request_id;

    -- Send notification to rejected user
    insert into public.class_notifications (
      workspace_id,
      user_id,
      title,
      body,
      type
    ) values (
      v_req.workspace_id,
      v_req.user_id,
      'Join Request Declined',
      'Your request to join ' || v_ws.name || ' was declined by the Class Representative.',
      'membership'
    );

    return jsonb_build_object('success', true, 'status', 'rejected');
  else
    return jsonb_build_object('error', 'Invalid action: must be approve or reject.');
  end if;
end;
$$;

revoke all on function public.review_join_request(uuid, text) from public, anon;
grant execute on function public.review_join_request(uuid, text) to authenticated, service_role;

-- 9. CR Role Transfer RPC: transfer_cr_role
create or replace function public.transfer_cr_role(
  p_workspace_id uuid,
  p_target_user_id uuid,
  p_previous_cr_new_role text default 'co_admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_ws record;
  v_prev_role text;
  v_target_member record;
  v_prev_member record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'Authentication required (401)');
  end if;

  if not public.is_class_cr(p_workspace_id, v_user_id) then
    return jsonb_build_object('error', 'Only the current Class Representative can transfer this role.');
  end if;

  if v_user_id = p_target_user_id then
    return jsonb_build_object('error', 'Cannot transfer the CR role to yourself.');
  end if;

  v_prev_role := lower(trim(coalesce(p_previous_cr_new_role, 'co_admin')));
  if v_prev_role not in ('co_admin', 'member') then
    v_prev_role := 'co_admin';
  end if;

  select * into v_target_member
  from public.class_members
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  if v_target_member.id is null then
    return jsonb_build_object('error', 'Selected student is not an enrolled member of this ClassSpace.');
  end if;

  -- 1. Promote target member to CR
  update public.class_members
  set role = 'cr',
      can_publish_notices = true
  where workspace_id = p_workspace_id and user_id = p_target_user_id
  returning * into v_target_member;

  -- 2. Demote caller to selected new role
  update public.class_members
  set role = v_prev_role,
      can_publish_notices = (v_prev_role = 'co_admin')
  where workspace_id = p_workspace_id and user_id = v_user_id
  returning * into v_prev_member;

  -- 3. Update workspace created_by to match new CR for RLS safety
  update public.class_workspaces
  set created_by = p_target_user_id,
      updated_at = now()
  where id = p_workspace_id
  returning * into v_ws;

  -- 4. Dispatch notification to all members about the CR transition
  insert into public.class_notifications (
    workspace_id,
    user_id,
    title,
    body,
    type
  )
  select
    p_workspace_id,
    m.user_id,
    'Class Representative Updated',
    v_target_member.display_name || ' is now the official Class Representative.',
    'membership'
  from public.class_members m
  where m.workspace_id = p_workspace_id;

  return jsonb_build_object(
    'success', true,
    'new_cr', row_to_json(v_target_member),
    'prev_cr', row_to_json(v_prev_member)
  );
end;
$$;

revoke all on function public.transfer_cr_role(uuid, uuid, text) from public, anon;
grant execute on function public.transfer_cr_role(uuid, uuid, text) to authenticated, service_role;

-- 10. Co-Admin Permission Update RPC
create or replace function public.update_co_admin_notice_permission(
  p_workspace_id uuid,
  p_target_user_id uuid,
  p_can_publish boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_target_role text;
begin
  v_user_id := auth.uid();
  if not public.is_class_cr(p_workspace_id, v_user_id) then
    return jsonb_build_object('error', 'Only the Class Representative can configure Co-Admin permissions.');
  end if;

  select role into v_target_role
  from public.class_members
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  if v_target_role is null then
    return jsonb_build_object('error', 'Target student is not an enrolled member of this ClassSpace.');
  end if;

  if v_target_role <> 'co_admin' then
    return jsonb_build_object('error', 'Notice publishing permissions can only be granted to Co-Admins.');
  end if;

  update public.class_members
  set can_publish_notices = p_can_publish
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.update_co_admin_notice_permission(uuid, uuid, boolean) from public, anon;
grant execute on function public.update_co_admin_notice_permission(uuid, uuid, boolean) to authenticated, service_role;

-- 11. Profile Sync Trigger: Keep class_members live when class_profiles updates
create or replace function public.sync_class_profile_to_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.class_members
  set display_name = NEW.display_name,
      avatar_url = NEW.avatar_url
  where user_id = NEW.user_id;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_class_profile_to_members on public.class_profiles;
create trigger trg_sync_class_profile_to_members
  after insert or update of display_name, avatar_url on public.class_profiles
  for each row
  execute function public.sync_class_profile_to_members();

-- 12. Update create_class_workspace stored procedure to automatically seed default channels
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

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then
      return jsonb_build_object('error', 'Unable to generate a unique join code. Please try again.');
    end if;

    v_join_code := '';
    for v_i in 1..5 loop
      v_join_code := v_join_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

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

      exit;
    exception when unique_violation then
      -- retry
    end;
  end loop;

  -- 2. Insert Creator as Owner/CR with notice rights
  insert into public.class_members (
    workspace_id,
    user_id,
    role,
    display_name,
    avatar_url,
    can_publish_notices
  ) values (
    v_new_ws.id,
    v_user_id,
    'owner',
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(v_user_email, 'user@example.com'), '@', 1)),
    p_avatar_url,
    true
  )
  returning * into v_new_member;

  -- 3. Automatically ensure default channels exist for this workspace
  perform public.ensure_default_channels(v_new_ws.id);

  return jsonb_build_object(
    'workspace', row_to_json(v_new_ws),
    'member', row_to_json(v_new_member)
  );
end;
$$;

revoke all on function public.create_class_workspace(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_class_workspace(text, text, text, text, text, text, text, text) to authenticated, service_role;

-- 13. Backfill default channels for all existing workspaces
do $$
declare
  ws record;
begin
  for ws in select id from public.class_workspaces loop
    perform public.ensure_default_channels(ws.id);
  end loop;
end;
$$;

-- 14. Backfill existing messages without a channel to 'The Commons'
update public.class_messages m
set channel_id = (
  select c.id from public.class_channels c
  where c.workspace_id = m.workspace_id and c.slug = 'the-commons'
  limit 1
)
where m.channel_id is null;

-- 15. Enable Supabase Realtime Publications
-- Add required tables to the supabase_realtime publication so events are broadcast to clients
do $$
begin
  -- Set replica identity full so RLS evaluations on UPDATE/DELETE events in Realtime have complete row data
  begin
    alter table public.class_messages replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_members replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_profiles replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_notifications replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_join_requests replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_channels replica identity full;
  exception when others then null;
  end;
  begin
    alter table public.class_timetable_overrides replica identity full;
  exception when others then null;
  end;

  -- Add tables to the supabase_realtime publication
  begin
    alter publication supabase_realtime add table public.class_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_join_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_channels;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.class_timetable_overrides;
  exception when duplicate_object then null;
  end;
end;
$$;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

