-- ==============================================================================
-- TRACKER: Subscriptions & Payment Entitlements Schema
-- Migration: 20261108_subscriptions_schema.sql
-- Description:
--   Establishes server-authoritative subscription lifecycle and entitlements:
--   1. user_subscriptions: Records active tiers and validity periods.
--   2. payment_webhook_events: Idempotent ledger preventing replay attacks.
--   3. get_user_entitlements(): Server-side RPC for feature entitlement checks.
--   4. process_subscription_webhook_event(): Idempotent state machine for webhook events.
-- ==============================================================================

-- 1. Table: public.user_subscriptions
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  customer_id text not null,
  subscription_id text unique,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused')),
  plan_tier text not null check (plan_tier in ('free', 'pro', 'cohort')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  latest_event_created timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions add column if not exists latest_event_created timestamptz;

alter table public.user_subscriptions enable row level security;

-- Performance Indexes
create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_customer_id on public.user_subscriptions(customer_id);
create index if not exists idx_user_subscriptions_subscription_id on public.user_subscriptions(subscription_id);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);

-- RLS Policies on user_subscriptions
drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription" on public.user_subscriptions
  for select using (
    auth.uid() = user_id or
    public.is_platform_admin()
  );

-- Direct client mutations are strictly forbidden; subscriptions are updated only by server webhooks
revoke insert, update, delete, truncate on table public.user_subscriptions from anon, authenticated;

-- 2. Table: public.payment_webhook_events (Idempotency Ledger)
create table if not exists public.payment_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.payment_webhook_events enable row level security;

create index if not exists idx_payment_webhook_events_processed_at on public.payment_webhook_events(processed_at desc);

-- Zero direct client access to webhook ledger
revoke all on table public.payment_webhook_events from anon, authenticated;

-- 3. Stored Procedure: get_user_entitlements
-- Server-authoritative function to resolve a user's active plan and features
create or replace function public.get_user_entitlements(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_target_user uuid;
  v_sub record;
  v_is_active boolean := false;
  v_tier text := 'free';
  v_features text[] := array['timetable', 'attendance', 'pomodoro_timer', 'gym_log', 'syllabus_tracker', 'local_backup', 'classspace_member'];
begin
  v_target_user := coalesce(p_user_id, auth.uid());

  if v_target_user is null then
    return jsonb_build_object(
      'tier', 'free',
      'is_active', false,
      'features', to_jsonb(v_features),
      'current_period_end', null,
      'cancel_at_period_end', false
    );
  end if;

  -- Users can query only their own entitlements; admins can query any user
  if (auth.uid() is distinct from v_target_user) and not public.is_platform_admin() then
    raise exception 'Access denied: cannot inspect another user entitlements (42501)';
  end if;

  select * into v_sub
  from public.user_subscriptions
  where user_id = v_target_user;

  if v_sub.id is not null then
    -- Consider active if status is active or trialing, or past_due within 24hr grace period
    if v_sub.status in ('active', 'trialing') or
       (v_sub.status = 'past_due' and v_sub.current_period_end >= now() - interval '24 hours') then
      v_is_active := true;
      v_tier := v_sub.plan_tier;

      if v_tier = 'pro' then
        v_features := v_features || array['unlimited_cloud_sync', 'advanced_analytics', 'ai_study_planner', 'priority_export'];
      elsif v_tier = 'cohort' then
        v_features := v_features || array['unlimited_cloud_sync', 'advanced_analytics', 'ai_study_planner', 'priority_export', 'cohort_sponsorship', 'verified_class_badge'];
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'tier', v_tier,
    'is_active', v_is_active,
    'features', to_jsonb(v_features),
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
    'status', coalesce(v_sub.status, 'free')
  );
end;
$$;

revoke all on function public.get_user_entitlements(uuid) from public, anon;
grant execute on function public.get_user_entitlements(uuid) to authenticated, service_role;

-- 4. Stored Procedure: process_subscription_webhook_event
-- Atomic, strictly idempotent, and state-machine guarded webhook processor
create or replace function public.process_subscription_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
  v_data jsonb;
  v_user_id uuid;
  v_customer_id text;
  v_subscription_id text;
  v_invoice_id text;
  v_charge_id text;
  v_status text;
  v_plan_tier text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_cancel_at_end boolean;
  v_event_created timestamptz;
  v_existing_sub public.user_subscriptions%rowtype;
  v_target_sub_id text;
  v_charge_created timestamptz;
  v_amount bigint;
  v_amount_refunded bigint;
  v_is_refunded boolean;
begin
  if p_event_id is null or trim(p_event_id) = '' then
    raise exception 'Missing event_id parameter';
  end if;

  -- 1. Idempotency Check & Atomic Ledger Insert
  -- Concurrency-safe: on conflict prevents parallel duplicate insert exceptions
  insert into public.payment_webhook_events (event_id, event_type, payload)
  values (p_event_id, p_event_type, p_payload)
  on conflict (event_id) do nothing;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return jsonb_build_object(
      'status', 'duplicate_ignored',
      'event_id', p_event_id,
      'message', 'Event already processed'
    );
  end if;

  v_data := p_payload->'data'->'object';
  
  if p_payload->>'created' is not null then
    v_event_created := to_timestamp((p_payload->>'created')::bigint);
  else
    v_event_created := now();
  end if;

  -- 2. Subscription State Machine Dispatch
  if p_event_type = 'checkout.session.completed' then
    v_customer_id := v_data->>'customer';
    v_subscription_id := v_data->>'subscription';
    
    -- Extract user_id from client_reference_id or metadata
    begin
      v_user_id := (coalesce(v_data->>'client_reference_id', v_data->'metadata'->>'user_id'))::uuid;
    exception when others then
      v_user_id := null;
    end;

    v_plan_tier := coalesce(v_data->'metadata'->>'plan_tier', 'pro');
    if v_plan_tier not in ('pro', 'cohort') then
      v_plan_tier := 'pro';
    end if;

    if v_user_id is not null and v_customer_id is not null then
      -- Concurrency serialization: Two-key transaction-scoped advisory lock
      -- serializes concurrent initial inserts for the same user before row creation
      perform pg_advisory_xact_lock(
        20261108,
        hashtext(v_user_id::text)
      );

      -- Lock target user record if already present
      perform 1 from public.user_subscriptions where user_id = v_user_id for update;

      insert into public.user_subscriptions (
        user_id,
        customer_id,
        subscription_id,
        status,
        plan_tier,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        latest_event_created,
        updated_at
      ) values (
        v_user_id,
        v_customer_id,
        v_subscription_id,
        'active',
        v_plan_tier,
        now(),
        now() + interval '30 days',
        false,
        v_event_created,
        now()
      )
      on conflict (user_id) do update set
        customer_id          = excluded.customer_id,
        subscription_id      = coalesce(excluded.subscription_id, user_subscriptions.subscription_id),
        status               = 'active',
        plan_tier            = excluded.plan_tier,
        current_period_start = excluded.current_period_start,
        current_period_end   = excluded.current_period_end,
        cancel_at_period_end = false,
        latest_event_created = excluded.latest_event_created,
        updated_at           = now()
      where user_subscriptions.latest_event_created is null
         or excluded.latest_event_created > user_subscriptions.latest_event_created;

      get diagnostics v_row_count = row_count;

      if v_row_count = 0 then
        return jsonb_build_object(
          'status', 'stale_checkout_ignored',
          'event_id', p_event_id,
          'message', 'Checkout event is older than existing active subscription'
        );
      end if;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type,
      'user_id', v_user_id,
      'subscription_id', v_subscription_id
    );

  elsif p_event_type in ('customer.subscription.updated', 'customer.subscription.created') then
    v_subscription_id := v_data->>'id';
    v_customer_id := v_data->>'customer';
    v_status := v_data->>'status';
    v_cancel_at_end := coalesce((v_data->>'cancel_at_period_end')::boolean, false);
    
    if v_data->>'current_period_start' is not null then
      v_period_start := to_timestamp((v_data->>'current_period_start')::bigint);
    end if;
    if v_data->>'current_period_end' is not null then
      v_period_end := to_timestamp((v_data->>'current_period_end')::bigint);
    end if;

    -- Lookup existing subscription by subscription_id first, falling back to customer_id only when subscription_id is null
    -- Acquires row-level write lock (FOR UPDATE) to serialize distinct concurrent webhook events
    select * into v_existing_sub
    from public.user_subscriptions
    where (subscription_id = v_subscription_id)
       or (customer_id = v_customer_id and (subscription_id is null or subscription_id = v_subscription_id))
    order by (case when subscription_id = v_subscription_id then 0 else 1 end)
    limit 1
    for update;

    if v_existing_sub.id is not null then
      -- Stale Subscription Defense:
      -- If user already has a DIFFERENT newer subscription_id, ignore events for the old one
      if v_existing_sub.subscription_id is not null and v_existing_sub.subscription_id <> v_subscription_id then
        return jsonb_build_object(
          'status', 'stale_subscription_ignored',
          'event_id', p_event_id,
          'active_subscription', v_existing_sub.subscription_id,
          'event_subscription', v_subscription_id,
          'message', 'Event belongs to superseded subscription'
        );
      end if;

      -- Out-of-order and equal timestamp event defense:
      if v_existing_sub.latest_event_created is not null then
        if v_event_created < v_existing_sub.latest_event_created then
          return jsonb_build_object(
            'status', 'out_of_order_ignored',
            'event_id', p_event_id,
            'latest_event_created', v_existing_sub.latest_event_created,
            'event_created', v_event_created,
            'message', 'Event arrived out of order'
          );
        elsif v_event_created = v_existing_sub.latest_event_created and v_existing_sub.status = 'canceled' and coalesce(v_status, '') <> 'canceled' then
          return jsonb_build_object(
            'status', 'equal_timestamp_resurrection_ignored',
            'event_id', p_event_id,
            'message', 'Equal timestamp update cannot resurrect canceled subscription'
          );
        end if;
      end if;

      update public.user_subscriptions
      set
        subscription_id = coalesce(v_subscription_id, subscription_id),
        status = coalesce(v_status, status),
        current_period_start = coalesce(v_period_start, current_period_start),
        current_period_end = case
          when v_period_end is not null and v_period_end > coalesce(current_period_end, '-infinity'::timestamptz) then v_period_end
          else coalesce(current_period_end, v_period_end)
        end,
        cancel_at_period_end = v_cancel_at_end,
        latest_event_created = coalesce(v_event_created, latest_event_created),
        updated_at = now()
      where id = v_existing_sub.id;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type,
      'subscription_id', v_subscription_id
    );

  elsif p_event_type = 'customer.subscription.deleted' then
    v_subscription_id := v_data->>'id';
    v_customer_id := v_data->>'customer';

    select * into v_existing_sub
    from public.user_subscriptions
    where (subscription_id = v_subscription_id)
       or (customer_id = v_customer_id and (subscription_id is null or subscription_id = v_subscription_id))
    order by (case when subscription_id = v_subscription_id then 0 else 1 end)
    limit 1
    for update;

    if v_existing_sub.id is not null then
      -- Stale Subscription Defense:
      if v_existing_sub.subscription_id is not null and v_existing_sub.subscription_id <> v_subscription_id then
        return jsonb_build_object(
          'status', 'stale_subscription_ignored',
          'event_id', p_event_id,
          'active_subscription', v_existing_sub.subscription_id,
          'deleted_subscription', v_subscription_id,
          'message', 'Deleted event belongs to superseded subscription'
        );
      end if;

      -- Out-of-order defense:
      if v_existing_sub.latest_event_created is not null and v_event_created < v_existing_sub.latest_event_created then
        return jsonb_build_object(
          'status', 'out_of_order_ignored',
          'event_id', p_event_id
        );
      end if;

      update public.user_subscriptions
      set
        status = 'canceled',
        cancel_at_period_end = false,
        latest_event_created = coalesce(v_event_created, latest_event_created),
        updated_at = now()
      where id = v_existing_sub.id;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type,
      'subscription_id', v_subscription_id
    );

  elsif p_event_type = 'invoice.payment_succeeded' then
    v_subscription_id := v_data->>'subscription';
    v_customer_id := v_data->>'customer';

    select * into v_existing_sub
    from public.user_subscriptions
    where (v_subscription_id is not null and subscription_id = v_subscription_id)
       or (v_customer_id is not null and customer_id = v_customer_id and (subscription_id is null or subscription_id = v_subscription_id))
    order by (case when subscription_id = v_subscription_id then 0 else 1 end)
    limit 1
    for update;

    if v_existing_sub.id is not null then
      -- Stale Subscription Defense:
      if v_subscription_id is not null and v_existing_sub.subscription_id is not null and v_existing_sub.subscription_id <> v_subscription_id then
        return jsonb_build_object(
          'status', 'stale_invoice_ignored',
          'event_id', p_event_id,
          'active_subscription', v_existing_sub.subscription_id,
          'invoice_subscription', v_subscription_id
        );
      end if;

      -- Out-of-order and equal timestamp defense:
      if v_existing_sub.latest_event_created is not null then
        if v_event_created < v_existing_sub.latest_event_created then
          return jsonb_build_object(
            'status', 'out_of_order_ignored',
            'event_id', p_event_id
          );
        elsif v_event_created = v_existing_sub.latest_event_created and v_existing_sub.status = 'canceled' then
          return jsonb_build_object(
            'status', 'equal_timestamp_resurrection_ignored',
            'event_id', p_event_id,
            'message', 'Equal timestamp payment cannot resurrect canceled subscription'
          );
        end if;
      end if;

      update public.user_subscriptions
      set
        status = 'active',
        latest_event_created = coalesce(v_event_created, latest_event_created),
        updated_at = now()
      where id = v_existing_sub.id;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type
    );

  elsif p_event_type = 'invoice.payment_failed' then
    v_subscription_id := v_data->>'subscription';
    v_customer_id := v_data->>'customer';

    select * into v_existing_sub
    from public.user_subscriptions
    where (v_subscription_id is not null and subscription_id = v_subscription_id)
       or (v_customer_id is not null and customer_id = v_customer_id and (subscription_id is null or subscription_id = v_subscription_id))
    order by (case when subscription_id = v_subscription_id then 0 else 1 end)
    limit 1
    for update;

    if v_existing_sub.id is not null then
      -- Stale Subscription Defense:
      if v_subscription_id is not null and v_existing_sub.subscription_id is not null and v_existing_sub.subscription_id <> v_subscription_id then
        return jsonb_build_object(
          'status', 'stale_invoice_ignored',
          'event_id', p_event_id,
          'active_subscription', v_existing_sub.subscription_id,
          'invoice_subscription', v_subscription_id
        );
      end if;

      -- Out-of-order defense:
      if v_existing_sub.latest_event_created is not null and v_event_created < v_existing_sub.latest_event_created then
        return jsonb_build_object(
          'status', 'out_of_order_ignored',
          'event_id', p_event_id
        );
      end if;

      update public.user_subscriptions
      set
        status = 'past_due',
        latest_event_created = coalesce(v_event_created, latest_event_created),
        updated_at = now()
      where id = v_existing_sub.id;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type
    );

  elsif p_event_type = 'charge.refunded' then
    v_charge_id := v_data->>'id';
    v_customer_id := v_data->>'customer';
    v_invoice_id := v_data->>'invoice';
    v_amount := (coalesce(v_data->>'amount', '0'))::bigint;
    v_amount_refunded := (coalesce(v_data->>'amount_refunded', '0'))::bigint;
    v_is_refunded := coalesce((v_data->>'refunded')::boolean, false) or (v_amount > 0 and v_amount_refunded >= v_amount);

    if v_data->>'created' is not null then
      v_charge_created := to_timestamp((v_data->>'created')::bigint);
    end if;

    -- 1. Partial refund defense:
    -- Partial refunds (goodwill gestures, discounts, tax reconciliations) do NOT cancel subscription.
    if not v_is_refunded then
      return jsonb_build_object(
        'status', 'partial_refund_ignored',
        'event_id', p_event_id,
        'charge_id', v_charge_id,
        'amount', v_amount,
        'amount_refunded', v_amount_refunded,
        'message', 'Partial refund does not cancel active subscription'
      );
    end if;

    -- 2. Full refund: Establish relationship to the affected subscription
    -- First: check charge metadata for explicit subscription_id
    v_target_sub_id := v_data->'metadata'->>'subscription_id';

    -- Second: lookup invoice in historical payment_webhook_events ledger
    if v_target_sub_id is null and (v_invoice_id is not null or v_charge_id is not null) then
      select payload->'data'->'object'->>'subscription' into v_target_sub_id
      from public.payment_webhook_events
      where (v_customer_id is null or payload->'data'->'object'->>'customer' = v_customer_id)
        and (
          (v_invoice_id is not null
           and event_type in ('invoice.payment_succeeded', 'invoice.paid', 'invoice.created', 'invoice.updated')
           and payload->'data'->'object'->>'id' = v_invoice_id)
          or
          (v_charge_id is not null
           and payload->'data'->'object'->>'charge' = v_charge_id
           and payload->'data'->'object'->>'subscription' is not null)
        )
      order by processed_at desc
      limit 1;
    end if;

    -- Lookup current subscription for this customer with row-level lock
    select * into v_existing_sub
    from public.user_subscriptions
    where customer_id = v_customer_id
    order by updated_at desc
    limit 1
    for update;

    if v_existing_sub.id is not null then
      -- If target subscription was reliably identified:
      if v_target_sub_id is not null then
        if v_existing_sub.subscription_id is not null and v_existing_sub.subscription_id <> v_target_sub_id then
          -- Refund belongs to an older/different subscription; do NOT cancel current subscription
          return jsonb_build_object(
            'status', 'refund_stale_subscription_ignored',
            'event_id', p_event_id,
            'charge_id', v_charge_id,
            'target_subscription', v_target_sub_id,
            'active_subscription', v_existing_sub.subscription_id,
            'message', 'Refund belongs to previous subscription. Active subscription preserved.'
          );
        else
          -- Matches current active subscription; safely cancel
          update public.user_subscriptions
          set
            status = 'canceled',
            cancel_at_period_end = false,
            latest_event_created = coalesce(v_event_created, latest_event_created),
            updated_at = now()
          where id = v_existing_sub.id;

          return jsonb_build_object(
            'status', 'refund_canceled',
            'event_id', p_event_id,
            'charge_id', v_charge_id,
            'subscription_id', v_target_sub_id
          );
        end if;
      else
        -- If target subscription could NOT be resolved from metadata or invoice ledger:
        -- Check charge creation date against current subscription period start
        if v_existing_sub.current_period_start is not null and v_charge_created is not null
           and v_charge_created < v_existing_sub.current_period_start then
          -- Charge was created before current subscription period; do NOT cancel
          return jsonb_build_object(
            'status', 'refund_stale_charge_ignored',
            'event_id', p_event_id,
            'charge_id', v_charge_id,
            'charge_created', v_charge_created,
            'period_start', v_existing_sub.current_period_start,
            'message', 'Charge predates current subscription period. Active subscription preserved.'
          );
        end if;

        -- Missing or ambiguous association:
        -- SAFE NO-OP: Never cancel an active subscription without unambiguous association.
        -- Record full details for audit/investigation.
        return jsonb_build_object(
          'status', 'refund_unmatched_safe_noop',
          'event_id', p_event_id,
          'charge_id', v_charge_id,
          'customer_id', v_customer_id,
          'invoice_id', v_invoice_id,
          'active_subscription', v_existing_sub.subscription_id,
          'message', 'Charge refund could not be unambiguously linked to current subscription. Subscription preserved.'
        );
      end if;
    end if;

    return jsonb_build_object(
      'status', 'processed',
      'event_id', p_event_id,
      'event_type', p_event_type
    );
  end if;

  return jsonb_build_object(
    'status', 'processed',
    'event_id', p_event_id,
    'event_type', p_event_type
  );
end;
$$;

revoke all on function public.process_subscription_webhook_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_subscription_webhook_event(text, text, jsonb) to service_role;

