import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";
import {
  FUNNEL_SCHEMA_VERSION,
  formatReleaseId,
  isFunnelAudience,
  sanitizeFunnelProperties,
  type FunnelAudience,
} from "../_shared/funnelEventContract.ts";

const ARTWORK_SKU = "revealed_artwork_full_res";
const RELEASE_SHA = (Deno.env.get("WT_RELEASE_SHA") ?? Deno.env.get("GITHUB_SHA") ?? "unknown").slice(0, 64);
const RELEASE_BUILD_ID = (Deno.env.get("WT_BUILD_ID") ?? Deno.env.get("GITHUB_RUN_ID") ?? RELEASE_SHA).slice(0, 64);

const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

const respond = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const claimLedger = async (event: Stripe.Event): Promise<"inserted" | "duplicate" | "failed"> => {
  if (!supabase) return "failed";
  const { error } = await supabase.from("stripe_event_ledger").insert({
    event_id: event.id,
    event_type: event.type,
    status: "processed",
  });
  if (!error) return "inserted";
  if (error.code === "23505") return "duplicate";
  console.error(JSON.stringify({ scope: "stripe-webhook", message: "ledger_insert_failed" }));
  return "failed";
};

const persistEntitlementGranted = async (params: {
  userId: string;
  audience: FunnelAudience;
  releaseId: string;
}): Promise<void> => {
  if (!supabase) return;
  await supabase.from("funnel_events").insert({
    schema_version: FUNNEL_SCHEMA_VERSION,
    event_name: "entitlement_granted",
    occurred_at: new Date().toISOString(),
    release_sha: RELEASE_SHA,
    release_build_id: RELEASE_BUILD_ID,
    release_id: params.releaseId,
    audience: params.audience,
    session_id: null,
    user_id: params.userId,
    source: "server",
    properties: sanitizeFunnelProperties({
      sku: ARTWORK_SKU,
    }),
  });
};

const grantArtworkEntitlement = async (params: {
  userId: string;
  previewLogId: string;
  stripeSessionId: string;
  stripeEventId: string;
  audience: FunnelAudience;
  releaseId: string;
}): Promise<"granted" | "duplicate"> => {
  if (!supabase) throw new Error("configuration_error");

  const { data: existing } = await supabase
    .from("artwork_entitlements")
    .select("id")
    .eq("stripe_session_id", params.stripeSessionId)
    .maybeSingle();

  if (existing) return "duplicate";

  const { error } = await supabase.from("artwork_entitlements").insert({
    user_id: params.userId,
    sku: ARTWORK_SKU,
    preview_log_id: params.previewLogId,
    stripe_session_id: params.stripeSessionId,
    stripe_event_id: params.stripeEventId,
  });

  if (error?.code === "23505") return "duplicate";
  if (error) {
    console.error(JSON.stringify({ scope: "stripe-webhook", message: "entitlement_write_failed" }));
    throw new Error("entitlement_write_failed");
  }

  await persistEntitlementGranted({
    userId: params.userId,
    audience: params.audience,
    releaseId: params.releaseId,
  });
  return "granted";
};

serve(async (req) => {
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, 405);
  }

  if (!stripeWebhookSecret || !supabase) {
    return respond({ error: "configuration_error" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!signature) {
    return respond({ error: "missing_signature" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (_err) {
    console.error(JSON.stringify({ scope: "stripe-webhook", message: "invalid_signature" }));
    return respond({ error: "invalid_signature" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const sku = session.metadata?.sku ?? "";
      const previewLogId = session.metadata?.preview_log_id ?? null;
      const stripeSessionId = session.id;
      const claimedAudience = session.metadata?.audience;
      const audience: FunnelAudience = isFunnelAudience(claimedAudience)
        ? claimedAudience
        : userId
          ? "member"
          : "guest";
      const releaseId =
        typeof session.metadata?.release_id === "string" && session.metadata.release_id.length <= 129
          ? session.metadata.release_id
          : formatReleaseId(RELEASE_SHA, RELEASE_BUILD_ID);

      if (userId && customerId) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            stripe_customer_id: customerId,
          },
          { onConflict: "id" }
        );
      }

      // checkout.session.completed is not conversion. Conversion is entitlement_granted
      // after an artwork_entitlements row exists.
      if (sku === ARTWORK_SKU && userId && previewLogId && stripeSessionId) {
        await grantArtworkEntitlement({
          userId,
          previewLogId,
          stripeSessionId,
          stripeEventId: event.id,
          audience,
          releaseId,
        });
      }
    }

    const ledger = await claimLedger(event);
    if (ledger === "failed") {
      return respond({ error: "ledger_error" }, 500);
    }
  } catch (_error) {
    console.error(JSON.stringify({ scope: "stripe-webhook", message: "handler_error" }));
    return respond({ error: "handler_error" }, 500);
  }

  return respond({ received: true });
});
