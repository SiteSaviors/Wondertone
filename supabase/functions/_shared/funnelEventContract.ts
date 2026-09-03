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

export const FUNNEL_EVENT_NAME_SET = new Set<string>(FUNNEL_EVENT_NAMES);

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

export const ALLOWED_PROPERTY_KEY_SET = new Set<string>(ALLOWED_FUNNEL_PROPERTY_KEYS);

export const FORBIDDEN_PROPERTY_KEY_PATTERN =
  /email|password|secret|token|authorization|apikey|api_key|service_role|signed_url|prompt|image|photo|url|payload|exception|stack|cookie|jwt|stripe|credential|phone|address/i;

export const SENSITIVE_VALUE_PATTERN =
  /(?:https?:\/\/|data:|Bearer\s+|sk_(?:live|test)_|eyJ[A-Za-z0-9_-]{10,}|service_role|token=|sig=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

export type FunnelPropertyKey = (typeof ALLOWED_FUNNEL_PROPERTY_KEYS)[number];

export type FunnelEventRecord = {
  schemaVersion: number;
  eventName: FunnelEventName;
  occurredAt: string;
  releaseSha: string;
  releaseBuildId: string;
  sessionId: string;
  source: 'client' | 'server';
  properties: Record<string, string | number | boolean | null>;
};

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

export const sanitizeFunnelProperties = (
  raw: Record<string, unknown> | null | undefined
): Record<string, string | number | boolean | null> => {
  const properties: Record<string, string | number | boolean | null> = {};
  if (!raw) return properties;
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_PROPERTY_KEY_SET.has(key)) {
      continue;
    }
    if (!isSafeScalar(value)) continue;
    properties[key] = value;
  }
  return properties;
};

export const isAllowlistedFunnelEvent = (eventName: string): eventName is FunnelEventName =>
  FUNNEL_EVENT_NAME_SET.has(eventName) &&
  !(CLIENT_FORBIDDEN_FUNNEL_EVENTS as readonly string[]).includes(eventName);
