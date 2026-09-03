-- Key artwork entitlements to user + artwork + Stripe Checkout session.
-- Git-only. This PR does not apply migrations or enable live payments.

alter table public.artwork_entitlements
  add column if not exists stripe_session_id text;

create unique index if not exists artwork_entitlements_session_uidx
  on public.artwork_entitlements (stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists artwork_entitlements_user_artwork_session_uidx
  on public.artwork_entitlements (user_id, preview_log_id, stripe_session_id)
  where preview_log_id is not null and stripe_session_id is not null;

comment on column public.artwork_entitlements.stripe_session_id is
  'Stripe Checkout session id. Entitlement is keyed to user_id + artwork (preview_log_id) + stripe_session_id.';
