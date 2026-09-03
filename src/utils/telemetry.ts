import { sendAnalyticsEvent } from '@/utils/analyticsClient';
import { FIRST_SKU } from '@/config/commerceGuards';
import { getProductSurface } from '@/config/productSurface';

const VISIT_SESSION_KEY = 'wt_prism_visit';

export function trackVisit() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(VISIT_SESSION_KEY)) {
      return;
    }
    sessionStorage.setItem(VISIT_SESSION_KEY, '1');
  } catch {
    // private mode
  }
  sendAnalyticsEvent('visit', { surface: getProductSurface() });
}

export function trackSourceSelected(source: 'photo' | 'stock') {
  sendAnalyticsEvent('source_selected', { source, surface: getProductSurface() });
}

export function trackUploadComplete(source: 'photo' | 'stock') {
  sendAnalyticsEvent('upload_complete', { source, surface: getProductSurface() });
}

export function trackStyleSelected(styleId: string) {
  sendAnalyticsEvent('style_selected', { style_id: styleId, surface: getProductSurface() });
}

export function trackRevealShown(styleId: string, cacheHit?: boolean) {
  sendAnalyticsEvent('reveal_shown', {
    style_id: styleId,
    cache_hit: typeof cacheHit === 'boolean' ? cacheHit : null,
    surface: getProductSurface(),
  });
}

export function trackRevealFailed(styleId: string, reason = 'unavailable') {
  sendAnalyticsEvent('reveal_failed', {
    style_id: styleId,
    reason,
    surface: getProductSurface(),
  });
}

export function trackPaywallShown() {
  sendAnalyticsEvent('paywall_shown', { sku: FIRST_SKU, surface: getProductSurface() });
}

export function trackCheckoutStarted() {
  sendAnalyticsEvent('checkout_started', { sku: FIRST_SKU, surface: getProductSurface() });
}

export type StepOneEvent =
  | { type: 'substep'; value: 'upload' | 'crop' | 'style-selection' | 'complete' }
  | { type: 'preview'; styleId: string; status: 'generating' | 'ready' | 'error' | 'start' | 'complete' | string }
  | { type: 'cta'; value: 'continue-to-studio' }
  | { type: 'upload_started' }
  | { type: 'upload_success'; value: string }
  | { type: 'tone_section_view'; tone: string }
  | { type: 'tone_style_select'; styleId: string; tone?: string }
  | { type: 'tone_style_locked'; styleId: string; requiredTier?: string | null }
  | { type: 'tone_upgrade_prompt'; styleId?: string; tone?: string; requiredTier?: string | null }
  | { type: 'conversion'; status: 'start' | 'success' | 'error'; cacheHit?: boolean };

export function emitStepOneEvent(event: StepOneEvent) {
  if (event.type === 'tone_style_select') {
    trackStyleSelected(event.styleId);
    return;
  }
  if (event.type === 'preview' && (event.status === 'complete' || event.status === 'ready')) {
    trackRevealShown(event.styleId);
    return;
  }
  if (event.type === 'preview' && event.status === 'error') {
    trackRevealFailed(event.styleId, 'generation_failed');
    return;
  }
  // Other launchflow/step-one names are not in the Prism v1 allowlist.
}

export type AuthProviderMethod = 'google' | 'microsoft' | 'facebook' | 'email';

export type AuthGateEvent =
  | { type: 'auth_modal_shown'; surface: 'preview'; styleId?: string | null }
  | { type: 'auth_modal_completed'; method: AuthProviderMethod }
  | { type: 'auth_modal_abandoned'; reason: 'dismiss' | 'close' };

export function emitAuthGateEvent(event: AuthGateEvent) {
  sendAnalyticsEvent(event.type, { ...event });
}

export type ProgressiveDisclosureEvent =
  | { type: 'cta_download_click'; userTier: string; isPremium: boolean; timestamp: number }
  | { type: 'cta_canvas_click'; userTier: string; timestamp: number }
  | { type: 'canvas_panel_open'; userTier: string; timestamp: number }
  | { type: 'download_success'; userTier: string; styleId: string; timestamp: number }
  | { type: 'order_started'; userTier: string; orderTotal: number; hasEnhancements: boolean; timestamp: number }
  | { type: 'checkout_step_view'; step: string; userTier: string; timestamp: number }
  | { type: 'checkout_exit'; action: 'stay' | 'leave'; step: string; reason: string; timestamp: number }
  | {
      type: 'order_completed';
      userTier: string;
      orderTotal: number;
      hasEnhancements: boolean;
      shippingCountry?: string | null;
      timestamp: number;
    };

export type MembershipSurfaceEvent = {
  type: 'token_drawer_opened';
  userTier: string;
  remainingTokens: number | null;
  timestamp: number;
};

export function trackTokenDrawerOpened(userTier: string, remainingTokens: number | null) {
  sendAnalyticsEvent('token_drawer_opened', { userTier, remainingTokens });
}

export function trackDownloadCTAClick(_userTier: string, _isPremium: boolean) {
  // Download CTA is not a Prism persist event. Paywall/checkout are explicit.
}

export function trackCanvasCTAClick(userTier: string) {
  sendAnalyticsEvent('cta_canvas_click', { userTier });
}

export function trackCanvasPanelOpen(userTier: string) {
  sendAnalyticsEvent('canvas_panel_open', { userTier });
}

export function trackDownloadSuccess(_userTier: string, _styleId: string) {
  // Preview download is not the product. Conversion is entitlement_granted.
}

export function trackOrderStarted(_userTier: string, _orderTotal: number, _hasEnhancements: boolean) {
  // Canvas/order start is not a Prism persist event on this path.
}

export function trackOrderCompleted(
  _userTier: string,
  _orderTotal: number,
  _hasEnhancements: boolean,
  _shippingCountry?: string | null
) {
  // Intentionally not persisted. Order completion is server-authoritative.
}

export function trackCheckoutStepView(step: string, userTier: string) {
  sendAnalyticsEvent('checkout_step_view', { step, userTier });
}

export function trackCheckoutExit(action: 'stay' | 'leave', step: string, reason: string) {
  sendAnalyticsEvent('checkout_exit', { action, step, reason });
}

export type CheckoutRecommendationEvent =
  | {
      type: 'recommendation_shown';
      sizeId: string;
      orientation: string;
      isRecommended: boolean;
      isMostPopular: boolean;
      timestamp: number;
    }
  | {
      type: 'recommendation_selected';
      sizeId: string;
      wasRecommended: boolean;
      wasMostPopular: boolean;
      timestamp: number;
    };

export function trackCheckoutRecommendationShown(
  sizeId: string,
  orientation: string,
  isRecommended: boolean,
  isMostPopular: boolean
) {
  sendAnalyticsEvent('recommendation_shown', { sizeId, orientation, isRecommended, isMostPopular });
}

export function trackCheckoutRecommendationSelected(
  sizeId: string,
  wasRecommended: boolean,
  wasMostPopular: boolean
) {
  sendAnalyticsEvent('recommendation_selected', { sizeId, wasRecommended, wasMostPopular });
}

export function trackRuntimeMetric(_name: string, _payload?: Record<string, unknown>) {
  // Runtime dumps are not allowlisted funnel events.
}

export type SocialProofEvent =
  | {
      type: 'social_proof_cta_click';
      surface: 'primary' | 'footnote' | 'spotlight';
      context?: string;
    }
  | {
      type: 'social_proof_spotlight_interaction';
      storyId: string;
      product: string;
      interaction: 'auto' | 'manual';
    }
  | {
      type: 'social_proof_canvas_link_click';
      target: 'footnote';
      href?: string;
    }
  | {
      type: 'canvas_quality_impression';
      surface: 'studio';
    }
  | {
      type: 'canvas_quality_cta_click';
      surface: 'pricing' | 'create_canvas';
      authed: boolean;
      hasUpload: boolean;
    };

export function trackSocialProofEvent(event: SocialProofEvent) {
  const { type, ...rest } = event;
  sendAnalyticsEvent(type, rest as Record<string, unknown>);
}

type PricingMode = 'subscription' | 'payg';

export function trackPricingToggle(mode: PricingMode) {
  sendAnalyticsEvent('pricing_toggle', { mode });
}

export function trackTokenPackCheckoutStart(payload: { packId: string; tokens: number; priceCents: number }) {
  sendAnalyticsEvent('token_pack_checkout_start', payload);
}
