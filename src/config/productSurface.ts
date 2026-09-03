export const PRODUCT_SURFACES = ['studio', 'memorial'] as const;

export type ProductSurface = (typeof PRODUCT_SURFACES)[number];

export const FUNNEL_AUDIENCES = ['guest', 'member', 'memorial'] as const;

export type FunnelAudience = (typeof FUNNEL_AUDIENCES)[number];

export const FIRST_SKU = 'revealed_artwork_full_res' as const;

export type SaleableSku = typeof FIRST_SKU;

let activeSurface: ProductSurface = 'studio';

export const getProductSurface = (): ProductSurface => activeSurface;

export const setProductSurface = (surface: ProductSurface): void => {
  activeSurface = surface;
};

export const isMemorialSurface = (surface: ProductSurface = activeSurface): boolean =>
  surface === 'memorial';

export const resolveFunnelAudience = (isMember: boolean, surface: ProductSurface = activeSurface): FunnelAudience => {
  if (surface === 'memorial') return 'memorial';
  return isMember ? 'member' : 'guest';
};

export type ProductSurfaceRules = {
  hideStockLibrary: boolean;
  hideCanvasRail: boolean;
  hideLivingCanvas: boolean;
  hideTokenPacks: boolean;
  hideSubscriptionTiers: boolean;
  hideSocialProof: boolean;
  hidePressLogos: boolean;
  hideAuthGateBeforeReveal: boolean;
  allowPreviewDownload: boolean;
};

export const getProductSurfaceRules = (surface: ProductSurface = activeSurface): ProductSurfaceRules => {
  if (surface === 'memorial') {
    return {
      hideStockLibrary: true,
      hideCanvasRail: true,
      hideLivingCanvas: true,
      hideTokenPacks: true,
      hideSubscriptionTiers: true,
      hideSocialProof: true,
      hidePressLogos: true,
      hideAuthGateBeforeReveal: true,
      allowPreviewDownload: false,
    };
  }

  return {
    hideStockLibrary: false,
    hideCanvasRail: false,
    hideLivingCanvas: true,
    hideTokenPacks: false,
    hideSubscriptionTiers: false,
    hideSocialProof: false,
    hidePressLogos: false,
    hideAuthGateBeforeReveal: false,
    allowPreviewDownload: false,
  };
};
