# Wondertone source of truth

Describes **current `main` plus this trust-checkpoint PR**. Anything not verified against a live project is labeled.

## Product invariants (current)

- Personal uploads and stock photographs are distinct, valid entry paths.
- The three-rail Studio is intentional product architecture.
- Selecting a style does not spend credits. Generation is explicit, idempotent, and server-authoritative.
- Interrupted retries must not duplicate provider work or credit charges.
- A later failure must not erase the last successful artwork.
- Watermarked and clean artwork stay distinct.
- Customer photographs and clean artwork are owner-isolated.
- The browser is never authoritative for payment, entitlement, or order completion.
- Living Canvas remains **purchase-disabled** (modal + store + payment intent).

## Trust checkpoint (this PR)

### Funnel analytics

- First-party table `public.funnel_events` + edge function `ingest-funnel-event`.
- Versioned allowlist (`schema_version = 1`). Photographs, prompts, signed URLs, emails, credentials, raw provider payloads, and unfiltered errors are dropped.
- Client `order_completed` is **not** persisted. Checkout completion stays server-authoritative.
- Release identification is injected at build time as `VITE_RELEASE_SHA` (git SHA) and `VITE_BUILD_ID` (CI/Vercel build id, else the SHA). Every accepted row stores `release_sha` and `release_build_id`.

### Clean-art ownership

- **Verified in Git:** `supabase/migrations/20251014130010_create_dual_storage_buckets.sql` and `CREATE_BUCKETS.sql` granted `authenticated` SELECT on every `preview-cache-premium` object with no owner/path constraint.
- **This PR:** drops that policy. Premium and `user-uploads` stay private. Edge functions mint short-lived signed URLs after the caller is identified.
- `user-uploads` was already service-role-only in Git (`20251123120000_create_user_uploads_bucket.sql`).
- `user_gallery` and `preview_logs` already have owner-scoped RLS in Git.

### Logging

- Replicate/OpenAI edge logs no longer emit tokens, prompts, image payloads, or raw provider bodies.
- Gallery/source persist errors no longer echo storage paths, signed URLs, or exception objects to clients.

## Unverified vs deployed

- **UNVERIFIED:** whether production already ran the original dual-bucket SQL, the `CREATE_BUCKETS.sql` runbook, or this repair. Git, local, and deployed storage policies can differ.
- **UNVERIFIED:** live Stripe mode, Vercel production env, and whether `funnel_events` / the ingest function are applied. This PR does not deploy.
- Historical docs (`TECHNICAL-SPEC.md`, `WATERMARK-DIAGNOSTIC.md`) describe older PostHog/Sentry plans and dashboard bucket steps. They are not current SOT.

## Out of scope here

Tablet layout, mobile large-photo memory, production E2E reveal proof, Vercel production deploy, Stripe live mode, printing/Living Canvas fulfillment.
