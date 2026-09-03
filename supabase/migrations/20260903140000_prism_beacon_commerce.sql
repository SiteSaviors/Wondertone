-- Prism event contract v1 + Beacon commerce primitives.
-- Git vs deployed: intended next schema only. This PR does not apply
-- migrations or change production Stripe JWT policy.

-- ========================================
-- 1. Prism funnel allowlist + audience + release_id
-- ========================================

delete from public.funnel_events
where event_name not in (
  'visit',
  'source_selected',
  'upload_complete',
  'style_selected',
  'reveal_shown',
  'reveal_failed',
  'paywall_shown',
  'checkout_started',
  'entitlement_granted'
);

alter table public.funnel_events
  drop constraint if exists funnel_events_event_name_check;

alter table public.funnel_events
  add constraint funnel_events_event_name_check check (event_name in (
    'visit',
    'source_selected',
    'upload_complete',
    'style_selected',
    'reveal_shown',
    'reveal_failed',
    'paywall_shown',
    'checkout_started',
    'entitlement_granted'
  ));

alter table public.funnel_events
  add column if not exists audience text;

alter table public.funnel_events
  add column if not exists release_id text;

update public.funnel_events
set
  audience = coalesce(audience, 'guest'),
  release_id = coalesce(
    release_id,
    concat(coalesce(release_sha, 'unknown'), ':', coalesce(release_build_id, coalesce(release_sha, 'unknown')))
  )
where audience is null or release_id is null;

alter table public.funnel_events
  alter column audience set default 'guest';

alter table public.funnel_events
  drop constraint if exists funnel_events_audience_check;

alter table public.funnel_events
  add constraint funnel_events_audience_check check (audience in ('guest', 'member', 'memorial'));

comment on column public.funnel_events.audience is
  'Prism audience: guest, member, or memorial. No PII.';

comment on column public.funnel_events.release_id is
  'Build identity as sha:buildId. Required on every persisted event.';

create index if not exists funnel_events_audience_idx
  on public.funnel_events (audience, occurred_at desc);

create index if not exists funnel_events_release_id_idx
  on public.funnel_events (release_id, occurred_at desc);

-- ========================================
-- 2. Stripe event ledger (idempotency)
-- ========================================

create table if not exists public.stripe_event_ledger (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  status text not null default 'processed' check (status in ('processed', 'ignored', 'failed'))
);

alter table public.stripe_event_ledger enable row level security;

drop policy if exists stripe_event_ledger_service_role_all on public.stripe_event_ledger;
create policy stripe_event_ledger_service_role_all
  on public.stripe_event_ledger
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.stripe_event_ledger from anon, authenticated;
grant insert, select, update on public.stripe_event_ledger to service_role;

comment on table public.stripe_event_ledger is
  'Idempotent Stripe event ids. checkout.session.completed must not grant twice.';

-- ========================================
-- 3. Artwork entitlements (conversion source of truth)
-- ========================================

create table if not exists public.artwork_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null check (sku = 'revealed_artwork_full_res'),
  preview_log_id uuid references public.preview_logs(id) on delete set null,
  stripe_event_id text references public.stripe_event_ledger(event_id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, sku, preview_log_id)
);

create index if not exists artwork_entitlements_user_idx
  on public.artwork_entitlements (user_id, granted_at desc);

alter table public.artwork_entitlements enable row level security;

drop policy if exists artwork_entitlements_select_own on public.artwork_entitlements;
create policy artwork_entitlements_select_own
  on public.artwork_entitlements
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists artwork_entitlements_service_role_all on public.artwork_entitlements;
create policy artwork_entitlements_service_role_all
  on public.artwork_entitlements
  for all
  to service_role
  using (true)
  with check (true);

revoke insert, update, delete on public.artwork_entitlements from anon, authenticated;
grant select on public.artwork_entitlements to authenticated;
grant insert, select, update, delete on public.artwork_entitlements to service_role;

comment on table public.artwork_entitlements is
  'Server-authored entitlement for the revealed_artwork_full_res SKU. Written before any success UI. Conversion event is entitlement_granted.';

-- ========================================
-- 4. Generation COGS measurements (real path timings only)
-- ========================================

create table if not exists public.generation_cost_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id text,
  style_id text,
  cache_hit boolean not null,
  provider text,
  provider_fallback boolean not null default false,
  duration_ms integer,
  provider_predict_time_s numeric,
  outcome text not null check (outcome in ('success', 'failed', 'cache_hit'))
);

create index if not exists generation_cost_events_created_idx
  on public.generation_cost_events (created_at desc);

alter table public.generation_cost_events enable row level security;

drop policy if exists generation_cost_events_service_role_all on public.generation_cost_events;
create policy generation_cost_events_service_role_all
  on public.generation_cost_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.generation_cost_events from anon, authenticated;
grant insert, select on public.generation_cost_events to service_role;

comment on table public.generation_cost_events is
  'Measured generation timings from code paths. No invented dollar amounts. No photos, prompts, or signed URLs.';
