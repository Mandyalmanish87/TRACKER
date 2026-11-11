-- ==============================================================================
-- TRACKER: YouTube API Quota Protection, Caching & Abuse Prevention Schema
-- Migration: 20261110_youtube_api_quota_protection.sql
-- Description:
--   Establishes production-grade protection for YouTube API integration:
--   1. youtube_playlist_cache: Shared 24h server-side cache for public playlists.
--   2. youtube_import_usage: Persistent atomic per-user rate counters (min/hr/day).
--   3. youtube_api_quota_usage & youtube_api_quota_daily_summary:
--      Tracks Pacific Time daily quota consumption, atomic reservations & safety thresholds.
--   4. youtube_import_config: Centralized server-side configuration directives.
--   5. Security Definer RPCs with strict access controls (zero direct client writes).
-- ==============================================================================

-- 1. Table: public.youtube_import_config
create table if not exists public.youtube_import_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.youtube_import_config enable row level security;
revoke all on public.youtube_import_config from anon, authenticated;

-- Seed default configuration directives
insert into public.youtube_import_config (key, value, description)
values
  ('cache_enabled', 'true'::jsonb, 'Whether server-side playlist caching is enabled'),
  ('cache_ttl_hours', '24'::jsonb, 'Cache time-to-live in hours (default 24h)'),
  ('user_limit_minute', '5'::jsonb, 'Maximum playlist imports per minute per user'),
  ('user_limit_hour', '30'::jsonb, 'Maximum playlist imports per hour per user'),
  ('user_limit_day', '100'::jsonb, 'Maximum playlist imports per day per user'),
  ('daily_quota_budget', '10000'::jsonb, 'Google Cloud YouTube Data API v3 daily quota budget'),
  ('quota_monitoring_threshold', '5000'::jsonb, 'Informational monitoring alert threshold (5,000 units)'),
  ('quota_warning_threshold', '6000'::jsonb, 'Warning alert threshold (6,000 units)'),
  ('quota_hard_safety_threshold', '7000'::jsonb, 'Hard safety cutoff blocking uncached API requests (7,000 units)'),
  ('max_playlist_size', '500'::jsonb, 'Maximum allowed videos per playlist import'),
  ('rss_fallback_enabled', 'true'::jsonb, 'Whether public RSS fallback is permitted when API quota is exhausted'),
  ('max_rss_videos', '15'::jsonb, 'Maximum videos provided by YouTube public RSS feed'),
  ('api_retry_count', '2'::jsonb, 'Bounded retry count for transient 5xx errors')
on conflict (key) do nothing;

-- 2. Table: public.youtube_playlist_cache
create table if not exists public.youtube_playlist_cache (
  playlist_id text primary key,
  playlist_data jsonb not null,
  video_count integer not null default 0,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_accessed_at timestamptz not null default now(),
  access_count integer not null default 1
);

alter table public.youtube_playlist_cache enable row level security;
create index if not exists idx_yt_playlist_cache_expires_at on public.youtube_playlist_cache(expires_at);
revoke all on public.youtube_playlist_cache from anon, authenticated;

-- 3. Table: public.youtube_import_usage (Persistent Per-User Rate Counter)
create table if not exists public.youtube_import_usage (
  user_id text not null,
  period_type text not null check (period_type in ('minute', 'hour', 'day')),
  period_start timestamptz not null,
  request_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type, period_start)
);

alter table public.youtube_import_usage enable row level security;
create index if not exists idx_yt_import_usage_user_period on public.youtube_import_usage(user_id, period_type, period_start desc);
revoke all on public.youtube_import_usage from anon, authenticated;

-- 4. Table: public.youtube_api_quota_usage (Detailed Operation Ledger)
create table if not exists public.youtube_api_quota_usage (
  id uuid primary key default gen_random_uuid(),
  quota_date date not null,
  api_method text not null,
  request_count integer not null default 1,
  quota_units integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_api_quota_usage enable row level security;
create index if not exists idx_yt_quota_usage_date_method on public.youtube_api_quota_usage(quota_date, api_method);
revoke all on public.youtube_api_quota_usage from anon, authenticated;

-- 5. Table: public.youtube_api_quota_daily_summary (Pacific Time Daily Rollup)
create table if not exists public.youtube_api_quota_daily_summary (
  quota_date date primary key,
  units_used integer not null default 0,
  units_reserved integer not null default 0,
  request_count integer not null default 0,
  cache_hits integer not null default 0,
  cache_misses integer not null default 0,
  successful_imports integer not null default 0,
  failed_imports integer not null default 0,
  quota_blocked_imports integer not null default 0,
  rate_limited_imports integer not null default 0,
  rss_fallback_imports integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.youtube_api_quota_daily_summary enable row level security;
revoke all on public.youtube_api_quota_daily_summary from anon, authenticated;

-- ==============================================================================
-- 6. RPC: check_and_increment_user_import_limits
-- Atomically validates and increments minute, hour, and daily limits for a user
-- Uses atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING to prevent race conditions.
-- ==============================================================================
create or replace function public.check_and_increment_user_import_limits(
  p_user_id text,
  p_minute_limit integer default 5,
  p_hour_limit integer default 30,
  p_day_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_hour_start timestamptz := date_trunc('hour', v_now);
  v_day_start timestamptz := date_trunc('day', v_now at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  
  v_minute_count integer := 0;
  v_hour_count integer := 0;
  v_day_count integer := 0;
  v_retry_after integer := 0;
begin
  if p_user_id is null or trim(p_user_id) = '' then
    return jsonb_build_object('allowed', false, 'reason', 'UNAUTHENTICATED', 'retry_after_seconds', 0);
  end if;

  -- 1. Atomically increment minute counter and retrieve authoritative count
  insert into public.youtube_import_usage (user_id, period_type, period_start, request_count, updated_at)
  values (p_user_id, 'minute', v_minute_start, 1, v_now)
  on conflict (user_id, period_type, period_start)
  do update set request_count = public.youtube_import_usage.request_count + 1, updated_at = v_now
  returning request_count into v_minute_count;

  -- 2. Atomically increment hour counter and retrieve authoritative count
  insert into public.youtube_import_usage (user_id, period_type, period_start, request_count, updated_at)
  values (p_user_id, 'hour', v_hour_start, 1, v_now)
  on conflict (user_id, period_type, period_start)
  do update set request_count = public.youtube_import_usage.request_count + 1, updated_at = v_now
  returning request_count into v_hour_count;

  -- 3. Atomically increment day counter and retrieve authoritative count
  insert into public.youtube_import_usage (user_id, period_type, period_start, request_count, updated_at)
  values (p_user_id, 'day', v_day_start, 1, v_now)
  on conflict (user_id, period_type, period_start)
  do update set request_count = public.youtube_import_usage.request_count + 1, updated_at = v_now
  returning request_count into v_day_count;

  -- 4. Check minute threshold
  if v_minute_count > p_minute_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_minute_start + interval '1 minute' - v_now))));
    insert into public.youtube_api_quota_daily_summary (quota_date, rate_limited_imports)
    values ((v_now at time zone 'America/Los_Angeles')::date, 1)
    on conflict (quota_date)
    do update set rate_limited_imports = public.youtube_api_quota_daily_summary.rate_limited_imports + 1, updated_at = v_now;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'MINUTE_LIMIT_EXCEEDED',
      'retry_after_seconds', v_retry_after,
      'current_count', v_minute_count,
      'limit', p_minute_limit
    );
  end if;

  -- 5. Check hourly threshold
  if v_hour_count > p_hour_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_hour_start + interval '1 hour' - v_now))));
    insert into public.youtube_api_quota_daily_summary (quota_date, rate_limited_imports)
    values ((v_now at time zone 'America/Los_Angeles')::date, 1)
    on conflict (quota_date)
    do update set rate_limited_imports = public.youtube_api_quota_daily_summary.rate_limited_imports + 1, updated_at = v_now;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'HOURLY_LIMIT_EXCEEDED',
      'retry_after_seconds', v_retry_after,
      'current_count', v_hour_count,
      'limit', p_hour_limit
    );
  end if;

  -- 6. Check daily threshold
  if v_day_count > p_day_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_day_start + interval '1 day' - v_now))));
    insert into public.youtube_api_quota_daily_summary (quota_date, rate_limited_imports)
    values ((v_now at time zone 'America/Los_Angeles')::date, 1)
    on conflict (quota_date)
    do update set rate_limited_imports = public.youtube_api_quota_daily_summary.rate_limited_imports + 1, updated_at = v_now;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'DAILY_LIMIT_EXCEEDED',
      'retry_after_seconds', v_retry_after,
      'current_count', v_day_count,
      'limit', p_day_limit
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'minute_count', v_minute_count,
    'hour_count', v_hour_count,
    'day_count', v_day_count
  );
end;
$$;

revoke all on function public.check_and_increment_user_import_limits(text, integer, integer, integer) from public, anon;
grant execute on function public.check_and_increment_user_import_limits(text, integer, integer, integer) to service_role;

-- ==============================================================================
-- 7. RPC: reserve_youtube_api_quota
-- Checks Pacific-Time daily quota budget and atomically places reservations
-- ==============================================================================
create or replace function public.reserve_youtube_api_quota(
  p_estimated_units integer default 3,
  p_hard_limit integer default 7000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_used integer := 0;
  v_reserved integer := 0;
begin
  -- Upsert summary row for today
  insert into public.youtube_api_quota_daily_summary (quota_date, units_used, units_reserved, request_count)
  values (v_today, 0, 0, 0)
  on conflict (quota_date) do nothing;

  -- Lock row for atomic reservation
  select units_used, units_reserved into v_used, v_reserved
  from public.youtube_api_quota_daily_summary
  where quota_date = v_today
  for update;

  if (v_used + v_reserved + p_estimated_units) > p_hard_limit then
    update public.youtube_api_quota_daily_summary
    set quota_blocked_imports = quota_blocked_imports + 1,
        updated_at = now()
    where quota_date = v_today;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'SAFETY_THRESHOLD_EXCEEDED',
      'quota_date', v_today::text,
      'current_used', v_used,
      'current_reserved', v_reserved,
      'hard_limit', p_hard_limit,
      'remaining_safety_buffer', greatest(0, p_hard_limit - (v_used + v_reserved))
    );
  end if;

  -- Place reservation
  update public.youtube_api_quota_daily_summary
  set units_reserved = units_reserved + p_estimated_units,
      updated_at = now()
  where quota_date = v_today;

  return jsonb_build_object(
    'allowed', true,
    'quota_date', v_today::text,
    'current_used', v_used,
    'current_reserved', v_reserved + p_estimated_units,
    'reserved_units', p_estimated_units
  );
end;
$$;

revoke all on function public.reserve_youtube_api_quota(integer, integer) from public, anon;
grant execute on function public.reserve_youtube_api_quota(integer, integer) to service_role;

-- ==============================================================================
-- 8. RPC: reconcile_youtube_api_quota
-- Clears reservation and updates actual quota consumption and metrics
-- ==============================================================================
create or replace function public.reconcile_youtube_api_quota(
  p_reserved_units integer,
  p_actual_units integer,
  p_api_method text default 'playlists.import',
  p_is_success boolean default true,
  p_is_cache_hit boolean default false,
  p_is_rss boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_net_units integer := greatest(0, p_actual_units);
  v_released_reservation integer := greatest(0, p_reserved_units);
begin
  insert into public.youtube_api_quota_daily_summary (quota_date, units_used, units_reserved, request_count)
  values (v_today, 0, 0, 0)
  on conflict (quota_date) do nothing;

  update public.youtube_api_quota_daily_summary
  set units_reserved = greatest(0, units_reserved - v_released_reservation),
      units_used = units_used + v_net_units,
      request_count = request_count + (case when v_net_units > 0 then 1 else 0 end),
      cache_hits = cache_hits + (case when p_is_cache_hit then 1 else 0 end),
      cache_misses = cache_misses + (case when not p_is_cache_hit then 1 else 0 end),
      successful_imports = successful_imports + (case when p_is_success then 1 else 0 end),
      failed_imports = failed_imports + (case when not p_is_success then 1 else 0 end),
      rss_fallback_imports = rss_fallback_imports + (case when p_is_rss then 1 else 0 end),
      updated_at = now()
  where quota_date = v_today;

  if v_net_units > 0 then
    insert into public.youtube_api_quota_usage (quota_date, api_method, request_count, quota_units, updated_at)
    values (v_today, p_api_method, 1, v_net_units, now());
  end if;

  return jsonb_build_object('success', true, 'quota_date', v_today::text);
end;
$$;

revoke all on function public.reconcile_youtube_api_quota(integer, integer, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.reconcile_youtube_api_quota(integer, integer, text, boolean, boolean, boolean) to service_role;

-- ==============================================================================
-- 9. RPC: get_or_set_playlist_cache helpers
-- Atomic lookup and insertion for public playlist cache
-- ==============================================================================
create or replace function public.get_youtube_playlist_cache(p_playlist_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if p_playlist_id is null or trim(p_playlist_id) = '' then
    return null;
  end if;

  select playlist_data, video_count, expires_at into v_rec
  from public.youtube_playlist_cache
  where playlist_id = p_playlist_id and expires_at > now();

  if not found then
    return null;
  end if;

  -- Record access count & bump last_accessed_at asynchronously
  update public.youtube_playlist_cache
  set last_accessed_at = now(),
      access_count = access_count + 1
  where playlist_id = p_playlist_id;

  -- Update daily summary cache_hits
  insert into public.youtube_api_quota_daily_summary (quota_date, cache_hits)
  values (v_today, 1)
  on conflict (quota_date)
  do update set cache_hits = public.youtube_api_quota_daily_summary.cache_hits + 1, updated_at = now();

  return v_rec.playlist_data;
end;
$$;

revoke all on function public.get_youtube_playlist_cache(text) from public, anon;
grant execute on function public.get_youtube_playlist_cache(text) to service_role;

create or replace function public.set_youtube_playlist_cache(
  p_playlist_id text,
  p_playlist_data jsonb,
  p_video_count integer,
  p_ttl_hours integer default 24
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl integer := greatest(1, coalesce(p_ttl_hours, 24));
  v_expires timestamptz := now() + (v_ttl || ' hours')::interval;
begin
  if p_playlist_id is null or trim(p_playlist_id) = '' or p_playlist_data is null then
    return;
  end if;

  insert into public.youtube_playlist_cache (
    playlist_id,
    playlist_data,
    video_count,
    expires_at,
    last_accessed_at,
    updated_at
  )
  values (
    p_playlist_id,
    p_playlist_data,
    coalesce(p_video_count, 0),
    v_expires,
    now(),
    now()
  )
  on conflict (playlist_id)
  do update set
    playlist_data = excluded.playlist_data,
    video_count = excluded.video_count,
    expires_at = excluded.expires_at,
    last_accessed_at = now(),
    access_count = public.youtube_playlist_cache.access_count + 1;
end;
$$;

-- Ensure updated_at column exists in youtube_playlist_cache
alter table public.youtube_playlist_cache add column if not exists updated_at timestamptz not null default now();

revoke all on function public.set_youtube_playlist_cache(text, jsonb, integer, integer) from public, anon;
grant execute on function public.set_youtube_playlist_cache(text, jsonb, integer, integer) to service_role;

-- ==============================================================================
-- 10. RPC: get_youtube_import_status (Admin Monitoring)
-- ==============================================================================
create or replace function public.get_youtube_import_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_summary record;
  v_cached_count integer := 0;
  v_active_alerts jsonb := '[]'::jsonb;
  v_config jsonb := '{}'::jsonb;
begin
  -- Restrict access to platform administrators
  if not public.is_platform_admin() then
    return jsonb_build_object('error', 'Unauthorized: Admin access required');
  end if;

  select * into v_summary
  from public.youtube_api_quota_daily_summary
  where quota_date = v_today;

  select count(*) into v_cached_count
  from public.youtube_playlist_cache
  where expires_at > now();

  select jsonb_object_agg(key, value) into v_config
  from public.youtube_import_config;

  -- Check thresholds
  if coalesce(v_summary.units_used, 0) >= coalesce((v_config->>'quota_hard_safety_threshold')::int, 7000) then
    v_active_alerts := v_active_alerts || jsonb_build_object(
      'level', 'critical',
      'threshold', 7000,
      'message', 'Hard safety quota threshold reached (7,000 units). Uncached YouTube API requests are blocked.'
    );
  elsif coalesce(v_summary.units_used, 0) >= coalesce((v_config->>'quota_warning_threshold')::int, 6000) then
    v_active_alerts := v_active_alerts || jsonb_build_object(
      'level', 'warning',
      'threshold', 6000,
      'message', 'YouTube API quota warning threshold reached (6,000 units). Monitor usage.'
    );
  elsif coalesce(v_summary.units_used, 0) >= coalesce((v_config->>'quota_monitoring_threshold')::int, 5000) then
    v_active_alerts := v_active_alerts || jsonb_build_object(
      'level', 'info',
      'threshold', 5000,
      'message', 'YouTube API quota monitoring threshold reached (5,000 units).'
    );
  end if;

  return jsonb_build_object(
    'quota_date', v_today::text,
    'timezone', 'America/Los_Angeles',
    'units_used', coalesce(v_summary.units_used, 0),
    'units_reserved', coalesce(v_summary.units_reserved, 0),
    'remaining_safety_budget', greatest(0, coalesce((v_config->>'quota_hard_safety_threshold')::int, 7000) - coalesce(v_summary.units_used, 0)),
    'daily_budget', coalesce((v_config->>'daily_budget')::int, 10000),
    'request_count', coalesce(v_summary.request_count, 0),
    'cache_hits', coalesce(v_summary.cache_hits, 0),
    'cache_misses', coalesce(v_summary.cache_misses, 0),
    'successful_imports', coalesce(v_summary.successful_imports, 0),
    'failed_imports', coalesce(v_summary.failed_imports, 0),
    'quota_blocked_imports', coalesce(v_summary.quota_blocked_imports, 0),
    'rate_limited_imports', coalesce(v_summary.rate_limited_imports, 0),
    'rss_fallback_imports', coalesce(v_summary.rss_fallback_imports, 0),
    'active_cached_playlists', v_cached_count,
    'alerts', v_active_alerts,
    'config', v_config
  );
end;
$$;

revoke all on function public.get_youtube_import_status() from public, anon;
grant execute on function public.get_youtube_import_status() to authenticated, service_role;
