-- ==============================================================================
-- TRACKER: User Trackers Schema & Row Level Security (RLS)
-- Migration: 20261020_user_trackers_schema.sql
-- ==============================================================================

create table if not exists public.user_trackers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.user_trackers enable row level security;

-- Strict cross-user data isolation: Users can only read, insert, update, delete their own tracker
drop policy if exists "Users can access their own tracker" on public.user_trackers;
create policy "Users can access their own tracker" on public.user_trackers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Performance index
create index if not exists idx_user_trackers_user_id on public.user_trackers(user_id);

