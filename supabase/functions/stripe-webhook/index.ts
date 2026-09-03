import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";

type SubscriptionTier = 'free' | 'creator' | 'plus' | 'pro';

const quotaForTier = (tier: SubscriptionTier): number => {
  switch (tier) {
    case 'creator':
      return 50;
    case 'plus':
      return 250;
    case 'pro':
      return 500;
    default:
      return 10;
  }
};

const parsePriceMap = (): Record<string, SubscriptionTier> => {
  const raw = Deno.env.get('STRIPE_PRICE_MAP_JSON');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed).reduce<Record<string, SubscriptionTier>>((acc, [priceId, tier]) => {
        if (typeof tier === 'string') {
          const normalized = tier.toLowerCase() as SubscriptionTier;
          if (['free', 'creator', 'plus', 'pro'].includes(normalized)) {
            acc[priceId] = normalized;
          }
        }
        return acc;
      }, {});
    }
  } catch (error) {
    console.error('[stripe-webhook] Failed to parse STRIPE_PRICE_MAP_JSON', error);
  }
  return {};
};

const priceMap = parsePriceMap();

const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient()
});

const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

const respond = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });

const isoFromUnix = (timestamp: number | null | undefined): string | null => {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
};

const resolveUserId = async (
  subscription: Stripe.Subscription
): Promise<{ userId: string | null; customerId: string | null }> => {
  const metadataUserId = subscription.metadata?.user_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

  if (metadataUserId) {
    return { userId: metadataUserId, customerId };
  }

  if (customerId && supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data?.user_id) {
      return { userId: data.user_id, customerId };
    }
  }

  return { userId: null, customerId };
};

const upsertSubscription = async (
  userId: string,
  customerId: string | null,
  tier: SubscriptionTier,
  currentPeriodStart: string | null,
  currentPeriodEnd: string | null
) => {
  if (!supabase) return;

  await supabase.from('profiles').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId ?? null
    },
    { onConflict: 'user_id' }
  );

  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      tokens_quota: quotaForTier(tier)
    },
    { onConflict: 'user_id' }
  );
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return respond({ error: 'method_not_allowed' }, 405);
  }

  if (!stripeWebhookSecret || !supabase) {
    return respond({ error: 'configuration_error' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  if (!signature) {
    return respond({ error: 'missing_signature' }, 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (_err) {
    console.error(JSON.stringify({ scope: 'stripe-webhook', message: 'invalid_signature' }));
    return respond({ error: 'invalid_signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const customerId = typeof session.customer === 'string' ? session.customer : null;

        if (userId && customerId) {
          await supabase.from('profiles').upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId
            },
            { onConflict: 'user_id' }
          );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { userId, customerId } = await resolveUserId(subscription);

        if (!userId) {
          console.warn('[stripe-webhook] Missing user mapping for subscription event', {
            subscriptionId: subscription.id,
            customerId
          });
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id ?? '';
        let tier = priceMap[priceId] ?? 'free';

        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          tier = 'free';
        }

        const periodStart = isoFromUnix(subscription.current_period_start);
        const periodEnd = isoFromUnix(subscription.current_period_end);

        await upsertSubscription(userId, customerId, tier, periodStart, periodEnd);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const { userId, customerId } = await resolveUserId(subscription);
        if (!userId) break;
        const priceId = subscription.items.data[0]?.price?.id ?? '';
        const tier = priceMap[priceId] ?? 'free';
        const periodStart = isoFromUnix(subscription.current_period_start);
        const periodEnd = isoFromUnix(subscription.current_period_end);
        await upsertSubscription(userId, customerId, tier, periodStart, periodEnd);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const { userId, customerId } = await resolveUserId(subscription);
        if (!userId) break;
        await upsertSubscription(userId, customerId, 'free', isoFromUnix(subscription.current_period_start), isoFromUnix(subscription.current_period_end));
        break;
      }

      default:
        break;
    }
  } catch (_error) {
    console.error(JSON.stringify({ scope: 'stripe-webhook', message: 'handler_error' }));
    return respond({ error: 'handler_error' }, 500);
  }

  return respond({ received: true });
});
