/**
 * Product capabilities that must stay purchase-disabled until an explicit launch.
 * Living Canvas stays purchase-disabled and unadvertised. Do not enable checkout or Stripe pricing for it.
 * Creator/Plus/Pro and token packs are not sold on the Beacon artwork path.
 */
export const PURCHASE_DISABLED_ENHANCEMENT_IDS = ['living-canvas'] as const;

export type PurchaseDisabledEnhancementId = (typeof PURCHASE_DISABLED_ENHANCEMENT_IDS)[number];

export const isPurchaseDisabledEnhancement = (id: string): boolean =>
  (PURCHASE_DISABLED_ENHANCEMENT_IDS as readonly string[]).includes(id);

export const filterPurchasableEnhancementIds = (ids: readonly string[]): string[] =>
  ids.filter((id) => !isPurchaseDisabledEnhancement(id));

/** First saleable SKU: full-resolution file of a revealed artwork. Not "watermark removal." */
export const FIRST_SKU = 'revealed_artwork_full_res' as const;

export type SaleableSku = typeof FIRST_SKU;

/** Live Stripe Checkout stays off. Do not flip this for test-mode wiring. */
export const LIVE_CHECKOUT_ENABLED = false;

/**
 * Test-mode Checkout price for revealed_artwork_full_res.
 * Beacon attaches a real test price id to this env later. Do not invent one.
 */
export const ARTWORK_TEST_PRICE_ENV = 'STRIPE_TEST_PRICE_REVEALED_ARTWORK';

/** This path does not sell subscription tiers. */
export const SELLABLE_SUBSCRIPTION_TIERS = [] as const;

export const isSaleableSku = (value: string | null | undefined): value is SaleableSku =>
  value === FIRST_SKU;
