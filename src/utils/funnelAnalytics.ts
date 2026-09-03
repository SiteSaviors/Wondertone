import { getReleaseIdentity, type ReleaseIdentity } from '@/config/releaseInfo';

export const FUNNEL_SCHEMA_VERSION = 1;

export const FUNNEL_EVENT_NAMES = [
  'launchflow_open',
  'launchflow_complete',
  'launchflow_edit_reopen',
  'launchflow_empty_state_interaction',
  'launchflow_health_warning',
  'step_one_substep',
  'step_one_preview',
  'step_one_cta',
  'step_one_upload_started',
  'step_one_upload_success',
  'tone_section_view',
  'tone_style_select',
  'tone_style_locked',
  'tone_upgrade_prompt',
  'conversion',
  'auth_modal_shown',
  'auth_modal_completed',
  'auth_modal_abandoned',
  'cta_download_click',
  'cta_canvas_click',
  'canvas_panel_open',
  'download_success',
  'order_started',
  'checkout_step_view',
  'checkout_exit',
  'recommendation_shown',
  'recommendation_selected',
  'token_drawer_opened',
  'pricing_toggle',
  'token_pack_checkout_start',
  'social_proof_cta_click',
  'social_proof_spotlight_interaction',
  'social_proof_canvas_link_click',
  'canvas_quality_impression',
  'canvas_quality_cta_click',
  'server_checkout_intent_created',
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];

const FUNNEL_EVENT_NAME_SET = new Set<string>(FUNNEL_EVENT_NAMES);

/**
 * Client `order_completed` is intentionally excluded. Payment, entitlement, and
 * order completion remain server-authoritative.
 */
export const CLIENT_FORBIDDEN_FUNNEL_EVENTS = ['order_completed', 'payment_succeeded', 'entitlement_changed'] as const;

export const ALLOWED_FUNNEL_PROPERTY_KEYS = [
  'source',
  'action',
  'style_id',
  'tone',
  'step',
  'status',
  'cache_hit',
  'user_tier',
  'is_premium',
  'has_enhancements',
  'order_total_cents',
  'pack_id',
  'tokens',
  'price_cents',
  'orientation',
  'size_id',
  'is_recommended',
  'is_most_popular',
  'remaining_tokens',
  'authenticated',
  'returning_status',
  'device_type',
  'session_hydrated',
  'elapsed_ms',
  'deficit',
  'open_count',
  'completion_count',
  'window_ms',
  'method',
  'reason',
  'surface',
  'required_tier',
  'product',
  'interaction',
  'target',
  'authed',
  'has_upload',
  'mode',
  'value',
  'was_recommended',
  'was_most_popular',
  'enhancement_count',
] as const;

export type FunnelPropertyKey = (typeof ALLOWED_FUNNEL_PROPERTY_KEYS)[number];

const ALLOWED_PROPERTY_KEY_SET = new Set<string>(ALLOWED_FUNNEL_PROPERTY_KEYS);

const FORBIDDEN_PROPERTY_KEY_PATTERN =
  /email|password|secret|token|authorization|apikey|api_key|service_role|signed_url|prompt|image|photo|url|payload|exception|stack|cookie|jwt|stripe|credential|phone|address/i;

const SENSITIVE_VALUE_PATTERN =
  /(?:https?:\/\/|data:|Bearer\s+|sk_(?:live|test)_|eyJ[A-Za-z0-9_-]{10,}|service_role|token=|sig=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

export type FunnelEventRecord = {
  schemaVersion: typeof FUNNEL_SCHEMA_VERSION;
  eventName: FunnelEventName;
  occurredAt: string;
  release: ReleaseIdentity;
  sessionId: string;
  source: 'client' | 'server';
  properties: Partial<Record<FunnelPropertyKey, string | number | boolean | null>>;
};

export type SanitizeFunnelEventInput = {
  eventName: string;
  properties?: Record<string, unknown>;
  occurredAt?: number | string;
  source?: 'client' | 'server';
  sessionId?: string;
  release?: ReleaseIdentity;
};

const SESSION_STORAGE_KEY = 'wt_funnel_session';

const isFunnelEventName = (value: string): value is FunnelEventName => FUNNEL_EVENT_NAME_SET.has(value);

const isSafeScalar = (value: unknown): value is string | number | boolean | null => {
  if (value === null) return true;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    if (value.length > 80) return false;
    return !SENSITIVE_VALUE_PATTERN.test(value);
  }
  return false;
};

export const isForbiddenPropertyKey = (key: string): boolean => FORBIDDEN_PROPERTY_KEY_PATTERN.test(key);

export const resolveFunnelSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (existing && existing.length <= 80 && !SENSITIVE_VALUE_PATTERN.test(existing)) {
          return existing;
        }
        const next = crypto.randomUUID();
        sessionStorage.setItem(SESSION_STORAGE_KEY, next);
        return next;
      }
    } catch {
      // sessionStorage can throw in locked/private contexts
    }
    return crypto.randomUUID();
  }
  return `anon-${Date.now().toString(36)}`;
};

const normalizeOccurredAt = (value: number | string | undefined): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
};

export const sanitizeFunnelEvent = (input: SanitizeFunnelEventInput): FunnelEventRecord | null => {
  if (!isFunnelEventName(input.eventName)) {
    return null;
  }

  const properties: FunnelEventRecord['properties'] = {};
  const raw = input.properties ?? {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_PROPERTY_KEY_SET.has(key)) {
      continue;
    }
    if (!isSafeScalar(value)) {
      continue;
    }
    properties[key as FunnelPropertyKey] = value;
  }

  const sessionId =
    typeof input.sessionId === 'string' &&
    input.sessionId.length > 0 &&
    input.sessionId.length <= 80 &&
    !SENSITIVE_VALUE_PATTERN.test(input.sessionId)
      ? input.sessionId
      : resolveFunnelSessionId();

  return {
    schemaVersion: FUNNEL_SCHEMA_VERSION,
    eventName: input.eventName,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    release: input.release ?? getReleaseIdentity(),
    sessionId,
    source: input.source ?? 'client',
    properties,
  };
};

const mapLegacyKey = (key: string): string => {
  const aliases: Record<string, string> = {
    styleId: 'style_id',
    userTier: 'user_tier',
    tier: 'user_tier',
    isPremium: 'is_premium',
    hasEnhancements: 'has_enhancements',
    orderTotal: 'order_total_cents',
    packId: 'pack_id',
    priceCents: 'price_cents',
    sizeId: 'size_id',
    isRecommended: 'is_recommended',
    isMostPopular: 'is_most_popular',
    remainingTokens: 'remaining_tokens',
    returningStatus: 'returning_status',
    deviceType: 'device_type',
    sessionHydrated: 'session_hydrated',
    elapsedMs: 'elapsed_ms',
    openCount: 'open_count',
    completionCount: 'completion_count',
    windowMs: 'window_ms',
    requiredTier: 'required_tier',
    hasUpload: 'has_upload',
    cacheHit: 'cache_hit',
    wasRecommended: 'was_recommended',
    wasMostPopular: 'was_most_popular',
  };
  return aliases[key] ?? key;
};

export const normalizeFunnelProperties = (payload: Record<string, unknown> = {}): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const mapped = mapLegacyKey(key);
    if (key === 'orderTotal' && typeof value === 'number') {
      next.order_total_cents = Math.round(value * 100);
      continue;
    }
    if (mapped === 'authenticated') {
      if (value === true || value === 'authenticated') {
        next[mapped] = 'authenticated';
      } else if (value === false || value === 'guest') {
        next[mapped] = 'guest';
      }
      continue;
    }
    next[mapped] = value;
  }
  return next;
};
