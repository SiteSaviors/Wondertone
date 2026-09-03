-- Trust checkpoint: privacy-bounded funnel events + close clean-art storage hole.
-- Git vs deployed: this file is the intended next schema. Do not assume production
-- already applied the original dual-bucket policies or this repair.

-- ========================================
-- 1. Allowlisted funnel analytics (first-party)
-- ========================================

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  schema_version integer not null,
  event_name text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  release_sha text,
  release_build_id text,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('client', 'server')),
  properties jsonb not null default '{}'::jsonb,
  constraint funnel_events_schema_version_check check (schema_version = 1),
  constraint funnel_events_event_name_check check (event_name in (
    'launchflow_open',
    'launchflow_complete',
    'launchflow_edit_reopen',
    'launchflow_empty_state_interaction',
    'launchflow_health_warning',
    'step_one_substep',
    'step_one_preview',
    'step_one_cta',
    'step_one_upload_started',
    'step_one_upload_success',
    'tone_section_view',
    'tone_style_select',
    'tone_style_locked',
    'tone_upgrade_prompt',
    'conversion',
    'auth_modal_shown',
    'auth_modal_completed',
    'auth_modal_abandoned',
    'cta_download_click',
    'cta_canvas_click',
    'canvas_panel_open',
    'download_success',
    'order_started',
    'checkout_step_view',
    'checkout_exit',
    'recommendation_shown',
    'recommendation_selected',
    'token_drawer_opened',
    'pricing_toggle',
    'token_pack_checkout_start',
    'social_proof_cta_click',
    'social_proof_spotlight_interaction',
    'social_proof_canvas_link_click',
    'canvas_quality_impression',
    'canvas_quality_cta_click',
    'server_checkout_intent_created'
  ))
);

create index if not exists funnel_events_occurred_at_idx
  on public.funnel_events (occurred_at desc);

create index if not exists funnel_events_name_occurred_idx
  on public.funnel_events (event_name, occurred_at desc);

create index if not exists funnel_events_release_idx
  on public.funnel_events (release_sha, occurred_at desc);

create index if not exists funnel_events_session_idx
  on public.funnel_events (session_id, occurred_at desc);

comment on table public.funnel_events is
  'Privacy-bounded, versioned funnel events. No photographs, prompts, signed URLs, emails, credentials, or raw provider payloads.';

alter table public.funnel_events enable row level security;

drop policy if exists funnel_events_service_role_all on public.funnel_events;
create policy funnel_events_service_role_all
  on public.funnel_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.funnel_events from anon, authenticated;
grant insert, select, delete on public.funnel_events to service_role;

-- Gallery aggregate view previously granted to authenticated; it grouped by raw user id.
do $$
begin
  if exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'v_gallery_stats'
  ) then
    revoke all on public.v_gallery_stats from anon, authenticated;
  end if;
end
$$;

-- ========================================
-- 2. Close unconstrained clean-art SELECT
-- ========================================
-- Verified in Git: 20251014130010_create_dual_storage_buckets.sql and CREATE_BUCKETS.sql
-- grant authenticated SELECT on every preview-cache-premium object with no owner/path
-- constraint. Service-role uploads do not set storage.objects.owner to the customer,
-- so owner = auth.uid() RLS would not match. Access is service-role only; edge
-- functions mint short-lived signed URLs after an ownership check.

drop policy if exists "Authenticated users can read premium previews via signed URLs"
  on storage.objects;

-- Defense in depth: no authenticated/anon policies on private customer buckets.
-- Service-role policies from prior migrations remain the only writers/readers.

-- ========================================
-- 3. Notes (unverified vs deployed)
-- ========================================
-- UNVERIFIED: whether production already applied the original dual-bucket SQL
-- or the manual CREATE_BUCKETS.sql runbook. After this migration is applied
-- (out of band; this PR does not deploy), re-check storage.policies for
-- preview-cache-premium and user-uploads.
