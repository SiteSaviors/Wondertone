
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const buildCorsHeaders = (origin?: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  try {
    const origin = req.headers.get("origin");
    const {
      amount: _amount,
      currency = "usd",
      customerEmail = "guest@example.com",
      items,
      successUrl,
      cancelUrl
    } = await req.json() as {
      amount?: number;
      currency?: string;
      customerEmail?: string;
      items: Array<{ name: string; description?: string; amount: number; quantity?: number }>;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No line items provided" }), {
        headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create line items from the provided items
    const lineItems = (items ?? []).map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.amount, // Amount in cents
      },
      quantity: item.quantity || 1,
    }));

    const requestOrigin = origin || "";
    const resolvedSuccessUrl =
      (typeof successUrl === "string" && successUrl.trim().length > 0)
        ? successUrl
        : `${requestOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const resolvedCancelUrl =
      (typeof cancelUrl === "string" && cancelUrl.trim().length > 0)
        ? cancelUrl
        : `${requestOrigin}/product`;

    // Create a one-time payment session
    const session = await stripe.checkout.sessions.create({
      customer_email: customerEmail,
      line_items: lineItems,
      mode: "payment",
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      automatic_tax: { enabled: false },
      metadata: {
        items: JSON.stringify(items),
      },
    });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ scope: 'create-payment', message: 'payment_creation_failed' }));
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...buildCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
