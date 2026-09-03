import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";
import { formatReleaseId, isFunnelAudience, type FunnelAudience } from "../_shared/funnelEventContract.ts";

const ARTWORK_SKU = "revealed_artwork_full_res";
const TEST_PRICE_ENV = "STRIPE_TEST_PRICE_REVEALED_ARTWORK";
const RELEASE_SHA = (Deno.env.get("WT_RELEASE_SHA") ?? Deno.env.get("GITHUB_SHA") ?? "unknown").slice(0, 64);
const RELEASE_BUILD_ID = (Deno.env.get("WT_BUILD_ID") ?? Deno.env.get("GITHUB_RUN_ID") ?? RELEASE_SHA).slice(0, 64);

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const testPriceId = (Deno.env.get(TEST_PRICE_ENV) ?? "").trim();
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isTestSecret = (secret: string): boolean => secret.startsWith("sk_test_");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "configuration_error" }, 500);
  }

  if (!stripeSecret || stripeSecret.startsWith("sk_live_")) {
    return json({ error: "live_payments_disabled" }, 403);
  }

  if (!isTestSecret(stripeSecret)) {
    return json({ error: "test_mode_required" }, 403);
  }

  if (!testPriceId || !testPriceId.startsWith("price_")) {
    return json({ error: "price_not_configured", sku: ARTWORK_SKU }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token === serviceKey || token === anonKey) {
    return json({ error: "authentication_required" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user?.id) {
    return json({ error: "invalid_token" }, 401);
  }

  const body = await req.json().catch(() => null);
  const sku = typeof body?.sku === "string" ? body.sku : "";
  const previewLogId = typeof body?.previewLogId === "string" ? body.previewLogId : "";
  const origin = req.headers.get("origin") ?? "";
  const isSafeReturnUrl = (value: unknown): value is string => {
    if (typeof value !== "string" || !origin) return false;
    try {
      return new URL(value).origin === origin;
    } catch {
      return false;
    }
  };
  const successUrl = isSafeReturnUrl(body?.successUrl) ? body.successUrl : `${origin}/create?checkout=success`;
  const cancelUrl = isSafeReturnUrl(body?.cancelUrl) ? body.cancelUrl : `${origin}/create?checkout=cancelled`;

  if (sku !== ARTWORK_SKU) {
    return json({ error: "sku_not_saleable" }, 400);
  }
  if (!previewLogId) {
    return json({ error: "preview_required" }, 400);
  }

  const { data: logRow } = await supabase
    .from("preview_logs")
    .select("id, user_id")
    .eq("id", previewLogId)
    .maybeSingle();

  if (!logRow || logRow.user_id !== userData.user.id) {
    return json({ error: "artwork_not_found" }, 404);
  }

  const claimedAudience = typeof body?.audience === "string" ? body.audience : null;
  const audience: FunnelAudience = isFunnelAudience(claimedAudience)
    ? claimedAudience
    : "member";
  const releaseId =
    typeof body?.release_id === "string" && body.release_id.length <= 129
      ? body.release_id
      : formatReleaseId(RELEASE_SHA, RELEASE_BUILD_ID);

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: previewLogId,
      line_items: [{ price: testPriceId, quantity: 1 }],
      metadata: {
        sku: ARTWORK_SKU,
        user_id: userData.user.id,
        preview_log_id: previewLogId,
        audience,
        release_id: releaseId,
      },
      payment_intent_data: {
        metadata: {
          sku: ARTWORK_SKU,
          user_id: userData.user.id,
          preview_log_id: previewLogId,
        },
      },
    });

    if (!session.url) {
      return json({ error: "checkout_failed" }, 500);
    }

    return json({ url: session.url, sessionId: session.id, sku: ARTWORK_SKU });
  } catch (_error) {
    return json({ error: "checkout_failed" }, 500);
  }
});
