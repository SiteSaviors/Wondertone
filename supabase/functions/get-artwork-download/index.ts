import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  buildSignedUrl,
  parseStoragePath,
  parseStorageUrl,
} from "../_shared/storageUtils.ts";
import { createSafeLogger, safeErrorMessage } from "../_shared/safeLogger.ts";

const ARTWORK_SKU = "revealed_artwork_full_res";
const SIGNED_TTL_SECONDS = 60;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const logger = createSafeLogger("get-artwork-download");

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

const resolvePremiumRef = (value: string | null | undefined) => {
  if (!value) return null;
  const ref = parseStoragePath(value) ?? parseStorageUrl(value);
  if (!ref) return null;
  if (ref.bucket === "preview-cache-public") {
    return { bucket: "preview-cache-premium", path: ref.path };
  }
  if (ref.bucket === "preview-cache-premium") {
    return ref;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "configuration_error" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token === SUPABASE_SERVICE_ROLE_KEY || token === SUPABASE_ANON_KEY) {
    return json({ error: "authentication_required" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user?.id) {
    return json({ error: "invalid_token" }, 401);
  }

  const userId = userData.user.id;
  const body = await req.json().catch(() => null);
  const previewLogId = typeof body?.previewLogId === "string" ? body.previewLogId : null;
  const sku = typeof body?.sku === "string" ? body.sku : ARTWORK_SKU;

  if (sku !== ARTWORK_SKU) {
    return json({ error: "sku_not_saleable" }, 400);
  }
  if (!previewLogId) {
    return json({ error: "preview_required" }, 400);
  }

  try {
    const { data: entitlement } = await supabase
      .from("artwork_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("sku", ARTWORK_SKU)
      .eq("preview_log_id", previewLogId)
      .maybeSingle();

    if (!entitlement) {
      return json({ error: "entitlement_required", entitled: false }, 402);
    }

    const { data: logRow } = await supabase
      .from("preview_logs")
      .select("id, user_id, preview_url")
      .eq("id", previewLogId)
      .maybeSingle();

    if (!logRow || logRow.user_id !== userId) {
      return json({ error: "not_found" }, 404);
    }

    const premiumRef = resolvePremiumRef(logRow.preview_url);
    if (!premiumRef) {
      return json({ error: "artwork_unavailable" }, 404);
    }

    const signedUrl = await buildSignedUrl(supabase, premiumRef, SIGNED_TTL_SECONDS);
    if (!signedUrl) {
      return json({ error: "signed_url_failed" }, 500);
    }

    return json({ downloadUrl: signedUrl, sku: ARTWORK_SKU, entitled: true });
  } catch (error) {
    logger.error("download_failed", { message: safeErrorMessage(error) });
    return json({ error: "internal_error" }, 500);
  }
});
