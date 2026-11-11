-- ============================================================================
-- Student Tracker: Fitness Ecosystem Database Migration & Storage Policies
-- Document ID: FITNESS-M07-CLOUD-SYNC
-- Date: 2026-11-10
--
-- 1. Verifies public.user_trackers supports complete Fitness Ecosystem JSONB state
-- 2. Creates private non-public storage bucket: 'user-fitness-photos'
-- 3. Configures strict Row Level Security (RLS) policies for authenticated photo vault
-- ============================================================================

-- 1. Ensure user_trackers table exists with user isolation RLS
create table if not exists public.user_trackers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_trackers enable row level security;

-- Idempotent RLS Policies on user_trackers
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'user_trackers' 
      and policyname = 'Users can only access their own fitness tracker'
  ) then
    create policy "Users can only access their own fitness tracker"
      on public.user_trackers
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 2. Create private storage bucket for encrypted progress photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-fitness-photos',
  'user-fitness-photos',
  false,
  10485760, -- 10MB limit per photo
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- 3. Storage RLS Policies: authenticated users can ONLY access their own photo directory: {user_id}/{photo_id}.webp

-- INSERT Policy
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Allow authenticated upload to own fitness photo folder'
  ) then
    create policy "Allow authenticated upload to own fitness photo folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- SELECT Policy
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Allow authenticated read from own fitness photo folder'
  ) then
    create policy "Allow authenticated read from own fitness photo folder"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- DELETE Policy
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Allow authenticated delete from own fitness photo folder'
  ) then
    create policy "Allow authenticated delete from own fitness photo folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

