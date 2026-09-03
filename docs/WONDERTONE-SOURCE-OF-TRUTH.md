# Wondertone source of truth

Describes **current `main` plus this isolated trust-checkpoint PR**. Anything not verified against a live project is labeled. This PR does not deploy and does not push `main`.

## Product invariants (current)

- Personal uploads and stock photographs are distinct, valid entry paths on Studio.
- Memorial (`/memorial`) is personal-photo only. Stock is hidden there.
- The three-rail Studio is intentional product architecture on `/create`. Memorial hides the canvas rail.
- Selecting a style does not spend credits. Generation is explicit, idempotent, and server-authoritative.
- Interrupted retries must not duplicate provider work or credit charges.
- A later failure must not erase the last successful artwork.
- Dual buckets stay: public display (lower-res, no logo overlay) vs private clean full-res.
- Customer photographs and clean artwork are owner-isolated.
- The browser is never authoritative for payment, entitlement, or order completion.
- Living Canvas remains **purchase-disabled** and **unadvertised**.
- Creator / Plus / Pro and token packs are not sold on the Beacon artwork path.
- Homepage, pricing, and related marketing no longer claim unverified counts, ratings, press logos, ship-in-days promises, or “stays private always.” Do not invent replacement social proof.

## Canonical first path

- `/` is the honest creator home. It is not the memorial page.
- `/memorial` remains the dedicated memorial entrance.
- `/create` is the shared studio.
- `/privacy` and `/terms` are unsigned drafts, not in force. Footer links to both.
- `/gift` is unlisted.
- `/pricing` exists but is not a primary nav or first-path entrance.
- Homepage style cards navigate to `/create?preselected_style=<id>`.
- After reveal, the primary CTA is `revealed_artwork_full_res` only. That control shows no dollar amount. Living Canvas toggle is hidden. “ORDERS API COMING SOON” is hidden.
- No success UI, download, or conversion event until an `artwork_entitlements` row exists. Checkout success/redirect is not conversion. Conversion is `entitlement_granted` only.

## Memorial (first live entrance)

- Dedicated route in `src/main.tsx` (`/memorial/*`). Not the marketing `*` landing wildcard.
- Shared Studio engine with `audience=memorial` on every persisted analytics event.
- Copy: “Bring them back in art.” / “Upload a photo. Choose a style. See them again. No prompts.” / CTA “Upload a photo.” After reveal: “Get the full-resolution file.”
- No price is shown. Checkout is not enabled. No counts, stars, tickers, press logos, Living Canvas, or shipping.
- No auth wall before reveal. Account at pay if required later.
- Preview is display-only, lower-res, not downloadable.

## Prism event contract v1

Persist **only**: `visit`, `source_selected` (`photo`|`stock`), `upload_complete`, `style_selected`, `reveal_shown`, `reveal_failed`, `paywall_shown`, `checkout_started`, `entitlement_granted`.

Every row has `audience` (`guest`|`member`|`memorial`) and `release_id` (`sha:buildId`).

No photographs, prompts, signed URLs, emails, credentials, raw provider payloads, or unfiltered errors.

**Conversion is `entitlement_granted`.** Never checkout success or redirect. The client cannot persist `entitlement_granted`.

## Beacon commerce primitives (not live)

- First SKU: `revealed_artwork_full_res` — full-resolution file of a revealed artwork after entitlement. Not “watermark removal.”
- `stripe-webhook` `checkout.session.completed` upserts `profiles.stripe_customer_id` on `profiles.id`, writes an idempotent Stripe event ledger row, then writes `artwork_entitlements` **before** any success UI, then emits `entitlement_granted`.
- This path does not write Creator/Plus/Pro or token credits.
- `supabase/config.toml` sets `verify_jwt = false` for `stripe-webhook` **in this PR only**. Stripe signature verification stays. Do not apply that JWT-off change to production from this PR.
- `LIVE_CHECKOUT_ENABLED = false`. No live payments.

## Clean art and watermarks

- **Verified in Git:** historical dual-bucket SQL granted `authenticated` SELECT on every `preview-cache-premium` object.
- **This PR:** drops that policy. Premium stays private.
- `generate-style-preview` no longer composites the five-logo grid. `WatermarkService.createWatermarkedImage` is a no-op.
- Clean full-res is stored in `preview-cache-premium`. Display JPEG (max edge 1280) is stored in `preview-cache-public`.
- Clean signed URL only after an owner-checked entitlement via `get-artwork-download`.
- Screenshots of the display preview are an accepted leak. C2PA is later.

## Legal shells

- `/privacy` and `/terms` are **route shells only**. Luke has not approved legal copy. They are not in force, not legal advice, and are not a published privacy policy or terms of service. Do not fabricate one.
- `/gift` is designed-not-live. The route may exist. It is unlisted, not linked, and not sold.

## SPA fallback (release gate)

- **Verified live on forever-in-color.vercel.app:** `GET /` is 200. `GET /create`, `/pricing`, `/gift`, `/memorial`, `/privacy`, `/terms` return Vercel 404 (`x-vercel-error: NOT_FOUND`). Production currently has no `vercel.json`.
- **This PR:** adds `vercel.json` SPA rewrites for `/`, `/create`, `/pricing`, `/memorial`, `/gift`, `/privacy`, `/terms`, plus a general SPA fallback. `/api/`, `/functions/`, `/assets/`, `/Auth-Logos/`, and paths with file extensions (hashed JS/CSS) are excluded from the fallback.
- This file is git-only until a founder-approved production deploy. This PR does not deploy. Memorial must not be treated as a live entrance URL until this rewrite is on the production host.
- Dedicated React routes exist for `/memorial` (page shell + shared studio, not the marketing landing), `/gift`, `/privacy`, and `/terms`. On `main`, those four paths still fall through to `LandingPage`.

## Unverified vs deployed

- **UNVERIFIED:** whether production already ran the original dual-bucket SQL, `CREATE_BUCKETS.sql`, or these repairs.
- **UNVERIFIED:** live Stripe mode, Vercel production env, and whether `funnel_events` / ingest / webhook JWT policy are applied. This PR does not deploy.
- Historical docs (`TECHNICAL-SPEC.md`, `WATERMARK-DIAGNOSTIC.md`) are not current SOT.

## Out of scope here

Tablet layout, mobile large-photo memory, production E2E reveal proof, Vercel production deploy, Stripe live mode, printing/Living Canvas fulfillment, invented prices or ratings.
