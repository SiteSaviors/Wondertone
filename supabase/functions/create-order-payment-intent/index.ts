import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

type Orientation = "horizontal" | "vertical" | "square";

type CanvasConfig = {
  id: string;
  orientation: Orientation;
  label: string;
  price: number;
};

const CANVAS_OPTIONS: CanvasConfig[] = [
  { id: "landscape-16x12", orientation: "horizontal", label: "16×12", price: 149 },
  { id: "landscape-24x18", orientation: "horizontal", label: "24×18", price: 199 },
  { id: "landscape-36x24", orientation: "horizontal", label: "36×24", price: 249 },
  { id: "landscape-40x30", orientation: "horizontal", label: "40×30", price: 319 },
  { id: "landscape-48x32", orientation: "horizontal", label: "48×32", price: 449 },
  { id: "landscape-60x40", orientation: "horizontal", label: "60×40", price: 599 },
  { id: "portrait-12x16", orientation: "vertical", label: "12×16", price: 149 },
  { id: "portrait-18x24", orientation: "vertical", label: "18×24", price: 199 },
  { id: "portrait-24x36", orientation: "vertical", label: "24×36", price: 249 },
  { id: "portrait-30x40", orientation: "vertical", label: "30×40", price: 319 },
  { id: "portrait-32x48", orientation: "vertical", label: "32×48", price: 449 },
  { id: "portrait-40x60", orientation: "vertical", label: "40×60", price: 599 },
  { id: "square-16x16", orientation: "square", label: "16×16", price: 179 },
  { id: "square-24x24", orientation: "square", label: "24×24", price: 219 },
  { id: "square-32x32", orientation: "square", label: "32×32", price: 349 },
  { id: "square-36x36", orientation: "square", label: "36×36", price: 499 },
];

const ENHANCEMENT_PRICES: Record<string, number> = {
  "floating-frame": 29,
  "digital-bundle": 14.99,
};

const PURCHASE_DISABLED_ENHANCEMENTS = new Set(["living-canvas"]);

const corsHeaders = (origin?: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
});

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecret) {
  console.error("[create-order-payment-intent] STRIPE_SECRET_KEY missing");
}

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  if (!stripe) {
    return new Response(JSON.stringify({ error: "configuration_error" }), {
      status: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const {
      styleId,
      styleName,
      canvasSizeId,
      orientation,
      enhancementIds = [],
      previewUrl,
      contact,
      shipping,
      currency = "usd",
    } = body as {
      styleId: string | null;
      styleName: string | null;
      canvasSizeId: string | null;
      orientation: Orientation;
      enhancementIds: string[];
      previewUrl?: string | null;
      contact: {
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
      };
      shipping: {
        addressLine1: string;
        addressLine2?: string;
        city: string;
        region: string;
        postalCode: string;
        country: string;
      };
      currency?: string;
    };

    if (!canvasSizeId) {
      return new Response(JSON.stringify({ error: "missing_canvas_size" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    if (!contact?.email) {
      return new Response(JSON.stringify({ error: "missing_contact_email" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    if (!shipping?.addressLine1 || !shipping.city || !shipping.region || !shipping.postalCode) {
      return new Response(JSON.stringify({ error: "missing_shipping" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const canvasOption = CANVAS_OPTIONS.find((option) => option.id === canvasSizeId);
    if (!canvasOption) {
      return new Response(JSON.stringify({ error: "invalid_canvas_size" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    if (canvasOption.orientation !== orientation) {
      return new Response(JSON.stringify({ error: "orientation_mismatch" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    if (enhancementIds.some((id) => PURCHASE_DISABLED_ENHANCEMENTS.has(id))) {
      return new Response(JSON.stringify({ error: "living_canvas_purchase_disabled" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const purchasableEnhancementIds = enhancementIds.filter((id) => ENHANCEMENT_PRICES[id]);
    let total = canvasOption.price;
    purchasableEnhancementIds.forEach((id) => {
      total += ENHANCEMENT_PRICES[id];
    });

    const amountInCents = Math.round(total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      receipt_email: contact.email,
      metadata: {
        style_id: styleId ?? '',
        style_name: styleName ?? '',
        canvas_size_id: canvasSizeId,
        orientation,
        enhancement_ids: purchasableEnhancementIds.join(','),
        has_preview: previewUrl ? '1' : '0',
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      shipping: {
        name: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email,
        phone: contact.phone || undefined,
        address: {
          line1: shipping.addressLine1,
          line2: shipping.addressLine2 || undefined,
          city: shipping.city,
          state: shipping.region,
          postal_code: shipping.postalCode,
          country: (shipping.country || 'US').toUpperCase(),
        },
      },
    });

    return new Response(
      JSON.stringify({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents,
        currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      },
    );
  } catch (_error) {
    console.error(JSON.stringify({
      scope: "create-order-payment-intent",
      message: "payment_intent_failed",
    }));
    return new Response(JSON.stringify({ error: "payment_intent_failed" }), {
      status: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
});
