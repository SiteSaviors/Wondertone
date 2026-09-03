/**
 * Product capabilities that must stay purchase-disabled until an explicit launch.
 * Living Canvas remains marketing-only: do not enable checkout or Stripe pricing for it.
 */
export const PURCHASE_DISABLED_ENHANCEMENT_IDS = ['living-canvas'] as const;

export type PurchaseDisabledEnhancementId = (typeof PURCHASE_DISABLED_ENHANCEMENT_IDS)[number];

export const isPurchaseDisabledEnhancement = (id: string): boolean =>
  (PURCHASE_DISABLED_ENHANCEMENT_IDS as readonly string[]).includes(id);

export const filterPurchasableEnhancementIds = (ids: readonly string[]): string[] =>
  ids.filter((id) => !isPurchaseDisabledEnhancement(id));
