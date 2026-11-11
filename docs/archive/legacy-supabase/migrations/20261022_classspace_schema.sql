-- ==============================================================================
-- TRACKER: ClassSpace — Shared Class Workspace Schema & Row Level Security (RLS)
-- Migration: 20261022_classspace_schema.sql
-- ==============================================================================

-- 1. Class Workspaces Table
create table if not exists public.class_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  college text,
  institution text,
  department text,
  section text,
  batch text,
  description text,
  join_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_workspaces_join_code on public.class_workspaces(join_code);

-- 2. Class Memberships Table
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'cr', 'co_admin', 'member')),
  display_name text not null,
  avatar_url text,
  is_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_class_members_workspace on public.class_members(workspace_id);
create index if not exists idx_class_members_user on public.class_members(user_id);

-- 3. Class Timetable Rules (Recurring slots)
create table if not exists public.class_timetable_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  subject_name text not null,
  subject_code text not null,
  subject_color text not null default '#C45532',
  day_of_week int not null check (day_of_week between 1 and 7),
  start_time text not null,
  end_time text not null,
  room text,
  instructor text,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_rules_workspace on public.class_timetable_rules(workspace_id);

-- 4. Class Timetable Overrides (Rescheduled, cancelled, or extra one-off classes)
create table if not exists public.class_timetable_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  rule_id uuid references public.class_timetable_rules(id) on delete cascade,
  original_date text, -- YYYY-MM-DD
  type text not null check (type in ('reschedule', 'cancel', 'extra')),
  new_date text not null, -- YYYY-MM-DD
  new_start_time text,
  new_end_time text,
  new_room text,
  new_notes text,
  change_note text,
  subject_name text,
  subject_code text,
  subject_color text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_class_overrides_workspace on public.class_timetable_overrides(workspace_id);

-- 5. Personal Attendance Records (Linked to ClassSpace occurrences)
create table if not exists public.class_attendance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_key text not null,
  date text not null, -- YYYY-MM-DD
  status text not null check (status in ('present', 'absent', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, occurrence_key)
);

create index if not exists idx_class_attendance_user_ws on public.class_attendance_records(user_id, workspace_id);

-- 6. Community Messages
create table if not exists public.class_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_role text,
  sender_avatar_url text,
  content text not null,
  message_type text not null default 'text',
  poll jsonb,
  resource jsonb,
  reply_to_id uuid references public.class_messages(id) on delete set null,
  reply_to_content text,
  reply_to_sender_name text,
  is_pinned boolean not null default false,
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_messages_workspace on public.class_messages(workspace_id, created_at desc);

-- 7. Message Emoji Reactions
create table if not exists public.class_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.class_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_class_reactions_message on public.class_message_reactions(message_id);

-- 8. Saved / Bookmarked Messages
create table if not exists public.class_saved_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.class_messages(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (workspace_id, user_id, message_id)
);

create index if not exists idx_class_saved_user on public.class_saved_messages(user_id, workspace_id);

-- 9. Notifications Table
create table if not exists public.class_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.class_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  is_read boolean not null default false,
  link_occurrence_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_class_notifications_user on public.class_notifications(user_id, is_read);

-- 10. User ClassSpace Profiles Table
create table if not exists public.class_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  notification_preferences jsonb not null default '{"timetableAlerts": true, "extraClasses": true, "cancellations": true, "communityReplies": true}'::jsonb,
  updated_at timestamptz not null default now()
);


-- ==============================================================================
-- HELPER FUNCTIONS FOR PERMISSION & ROLE CHECKS
-- ==============================================================================

create or replace function public.is_class_member(ws_id uuid, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where workspace_id = ws_id and user_id = u_id
  );
$$;

revoke all on function public.is_class_member(uuid, uuid) from public, anon;
grant execute on function public.is_class_member(uuid, uuid) to authenticated, service_role;

create or replace function public.is_class_admin(ws_id uuid, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where workspace_id = ws_id and user_id = u_id and role in ('owner', 'cr', 'co_admin')
  );
$$;

revoke all on function public.is_class_admin(uuid, uuid) from public, anon;
grant execute on function public.is_class_admin(uuid, uuid) to authenticated, service_role;

create or replace function public.is_class_cr(ws_id uuid, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members
    where workspace_id = ws_id and user_id = u_id and role in ('owner', 'cr')
  );
$$;

revoke all on function public.is_class_cr(uuid, uuid) from public, anon;
grant execute on function public.is_class_cr(uuid, uuid) to authenticated, service_role;

-- Secure RPC to lookup workspace info by join code without exposing entire directory
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
  if auth.role() <> 'authenticated' then
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
    w.college,
    w.institution,
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

-- Trusted database function to validate join code before creating membership
create or replace function public.join_class_workspace(
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
  v_new_member record;
begin
  v_user_id := auth.uid();
  if v_user_id is null or auth.role() <> 'authenticated' then
    return jsonb_build_object('error', 'Authentication required');
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

  select * into v_existing_member
  from public.class_members
  where workspace_id = v_ws.id and user_id = v_user_id;

  if v_existing_member.id is not null then
    return jsonb_build_object('error', 'You are already a member of this ClassSpace.');
  end if;

  insert into public.class_members (
    workspace_id,
    user_id,
    role,
    display_name,
    avatar_url
  ) values (
    v_ws.id,
    v_user_id,
    'member',
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(v_user_email, 'user@example.com'), '@', 1)),
    p_avatar_url
  )
  returning * into v_new_member;

  return jsonb_build_object(
    'workspace', row_to_json(v_ws),
    'member', row_to_json(v_new_member)
  );
end;
$$;

revoke all on function public.join_class_workspace(text, text, text) from public, anon;
grant execute on function public.join_class_workspace(text, text, text) to authenticated, service_role;


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
alter table public.class_workspaces enable row level security;
alter table public.class_members enable row level security;
alter table public.class_timetable_rules enable row level security;
alter table public.class_timetable_overrides enable row level security;
alter table public.class_attendance_records enable row level security;
alter table public.class_messages enable row level security;
alter table public.class_message_reactions enable row level security;
alter table public.class_saved_messages enable row level security;
alter table public.class_notifications enable row level security;
alter table public.class_profiles enable row level security;

-- 1. class_workspaces
-- Only members and workspace creators can view their workspaces
drop policy if exists "Members and join-code lookups can view workspaces" on public.class_workspaces;
drop policy if exists "Members and creators can view workspaces" on public.class_workspaces;
create policy "Members and creators can view workspaces"
  on public.class_workspaces
  for select
  using (
    auth.role() = 'authenticated' and (
      created_by = auth.uid() or
      public.is_class_member(id, auth.uid())
    )
  );

create policy "Authenticated users can create workspaces"
  on public.class_workspaces
  for insert
  with check (auth.uid() = created_by);

create policy "Only CR can update workspace details or rotate code"
  on public.class_workspaces
  for update
  using (public.is_class_cr(id, auth.uid()));

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

-- 2. class_members
create policy "Workspace members can view member directory"
  on public.class_members
  for select
  using (public.is_class_member(workspace_id, auth.uid()));

drop policy if exists "Users can join workspaces as member or CR upon creation" on public.class_members;
drop policy if exists "Workspace creators can insert their initial membership upon creation" on public.class_members;
create policy "Workspace creators can insert their initial membership upon creation"
  on public.class_members
  for insert
  with check (
    auth.uid() = user_id and
    role in ('owner', 'cr') and
    exists (
      select 1 from public.class_workspaces where id = workspace_id and created_by = auth.uid()
    )
  );

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

-- 3. class_timetable_rules
create policy "Members can view official timetable rules"
  on public.class_timetable_rules
  for select
  using (public.is_class_member(workspace_id, auth.uid()));

create policy "Only CR and Co-Admins can create timetable rules"
  on public.class_timetable_rules
  for insert
  with check (public.is_class_admin(workspace_id, auth.uid()));

create policy "Only CR and Co-Admins can update timetable rules"
  on public.class_timetable_rules
  for update
  using (public.is_class_admin(workspace_id, auth.uid()));

create policy "Only CR and Co-Admins can delete timetable rules"
  on public.class_timetable_rules
  for delete
  using (public.is_class_admin(workspace_id, auth.uid()));

-- 4. class_timetable_overrides
create policy "Members can view timetable overrides"
  on public.class_timetable_overrides
  for select
  using (public.is_class_member(workspace_id, auth.uid()));

create policy "Only CR and Co-Admins can manage timetable overrides"
  on public.class_timetable_overrides
  for all
  using (public.is_class_admin(workspace_id, auth.uid()));

-- 5. class_attendance_records (CRITICAL: Isolated to each student!)
drop policy if exists "Students can view only their own personal attendance records" on public.class_attendance_records;
create policy "Students can view only their own personal attendance records"
  on public.class_attendance_records
  for select
  using (auth.uid() = user_id);

create policy "Students can insert only their own attendance records"
  on public.class_attendance_records
  for insert
  with check (auth.uid() = user_id and public.is_class_member(workspace_id, auth.uid()));

create policy "Students can update only their own attendance records"
  on public.class_attendance_records
  for update
  using (auth.uid() = user_id);

create policy "Students can delete only their own attendance records"
  on public.class_attendance_records
  for delete
  using (auth.uid() = user_id);

-- 6. class_messages
create policy "Members can read community messages"
  on public.class_messages
  for select
  using (public.is_class_member(workspace_id, auth.uid()));

create policy "Members can send community messages"
  on public.class_messages
  for insert
  with check (auth.uid() = sender_id and public.is_class_member(workspace_id, auth.uid()));

create policy "Users can edit own messages; Admins can moderate"
  on public.class_messages
  for update
  using (auth.uid() = sender_id or public.is_class_admin(workspace_id, auth.uid()));

create policy "Users can delete own messages; Admins can moderate"
  on public.class_messages
  for delete
  using (auth.uid() = sender_id or public.is_class_admin(workspace_id, auth.uid()));

-- 7. class_message_reactions
create policy "Members can view emoji reactions"
  on public.class_message_reactions
  for select
  using (exists (
    select 1 from public.class_messages m
    where m.id = message_id and public.is_class_member(m.workspace_id, auth.uid())
  ));

create policy "Users can add their own emoji reactions"
  on public.class_message_reactions
  for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.class_messages m
    where m.id = message_id and public.is_class_member(m.workspace_id, auth.uid())
  ));

create policy "Users can remove their own reactions"
  on public.class_message_reactions
  for delete
  using (auth.uid() = user_id);

-- 8. class_saved_messages
create policy "Users can view only their own saved messages"
  on public.class_saved_messages
  for select
  using (auth.uid() = user_id);

create policy "Users can save messages"
  on public.class_saved_messages
  for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave messages"
  on public.class_saved_messages
  for delete
  using (auth.uid() = user_id);

-- 9. class_notifications
create policy "Users can view only their own notifications"
  on public.class_notifications
  for select
  using (auth.uid() = user_id);

create policy "Notifications can be created for members"
  on public.class_notifications
  for insert
  with check (public.is_class_member(workspace_id, auth.uid()));

create policy "Users can update their own notifications"
  on public.class_notifications
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.class_notifications
  for delete
  using (auth.uid() = user_id);

-- 10. class_profiles
-- Users can view their own profile, or verified co-members sharing a common workspace
drop policy if exists "Anyone can read member profiles" on public.class_profiles;
drop policy if exists "Users can view their own profile or co-members can view profile" on public.class_profiles;
create policy "Users can view their own profile or co-members can view profile"
  on public.class_profiles
  for select
  using (
    auth.role() = 'authenticated' and (
      auth.uid() = user_id or
      exists (
        select 1
        from public.class_members m1
        join public.class_members m2 on m1.workspace_id = m2.workspace_id
        where m1.user_id = auth.uid() and m2.user_id = class_profiles.user_id
      )
    )
  );

drop policy if exists "Users can manage only their own profile" on public.class_profiles;
drop policy if exists "Users can insert only their own profile" on public.class_profiles;
drop policy if exists "Users can update only their own profile" on public.class_profiles;
drop policy if exists "Users can delete only their own profile" on public.class_profiles;

create policy "Users can insert only their own profile"
  on public.class_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update only their own profile"
  on public.class_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete only their own profile"
  on public.class_profiles
  for delete
  using (auth.uid() = user_id);


-- ==============================================================================
-- SUPABASE STORAGE BUCKET FOR AVATARS
-- ==============================================================================

-- Create storage bucket `classspace-avatars` if it does not exist
insert into storage.buckets (id, name, public)
values ('classspace-avatars', 'classspace-avatars', true)
on conflict (id) do update set public = true;

-- Storage policies: Public read, users can upload/update/delete only their own folder
drop policy if exists "Public read for classspace avatars" on storage.objects;
create policy "Public read for classspace avatars"
  on storage.objects
  for select
  using (bucket_id = 'classspace-avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects
  for insert
  with check (
    bucket_id = 'classspace-avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects
  for update
  using (
    bucket_id = 'classspace-avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'classspace-avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects
  for delete
  using (
    bucket_id = 'classspace-avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

