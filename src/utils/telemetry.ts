import { sendAnalyticsEvent } from '@/utils/analyticsClient';

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

const STEP_ONE_EVENT_NAME: Record<StepOneEvent['type'], string> = {
  substep: 'step_one_substep',
  preview: 'step_one_preview',
  cta: 'step_one_cta',
  upload_started: 'step_one_upload_started',
  upload_success: 'step_one_upload_success',
  tone_section_view: 'tone_section_view',
  tone_style_select: 'tone_style_select',
  tone_style_locked: 'tone_style_locked',
  tone_upgrade_prompt: 'tone_upgrade_prompt',
  conversion: 'conversion',
};

export function emitStepOneEvent(event: StepOneEvent) {
  sendAnalyticsEvent(STEP_ONE_EVENT_NAME[event.type], { ...event });
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

export function trackDownloadCTAClick(userTier: string, isPremium: boolean) {
  sendAnalyticsEvent('cta_download_click', { userTier, isPremium });
}

export function trackCanvasCTAClick(userTier: string) {
  sendAnalyticsEvent('cta_canvas_click', { userTier });
}

export function trackCanvasPanelOpen(userTier: string) {
  sendAnalyticsEvent('canvas_panel_open', { userTier });
}

export function trackDownloadSuccess(userTier: string, styleId: string) {
  sendAnalyticsEvent('download_success', { userTier, styleId });
}

export function trackOrderStarted(userTier: string, orderTotal: number, hasEnhancements: boolean) {
  sendAnalyticsEvent('order_started', { userTier, orderTotal, hasEnhancements });
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
