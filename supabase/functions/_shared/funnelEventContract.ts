export const FUNNEL_SCHEMA_VERSION = 1;

export const FUNNEL_EVENT_NAMES = [
  'visit',
  'source_selected',
  'upload_complete',
  'style_selected',
  'reveal_shown',
  'reveal_failed',
  'paywall_shown',
  'checkout_started',
  'entitlement_granted',
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];

export const FUNNEL_EVENT_NAME_SET = new Set<string>(FUNNEL_EVENT_NAMES);

export const SERVER_ONLY_FUNNEL_EVENTS = ['entitlement_granted'] as const;

export const CLIENT_FORBIDDEN_FUNNEL_EVENTS = [
  'entitlement_granted',
  'order_completed',
  'payment_succeeded',
  'entitlement_changed',
  'checkout_success',
  'checkout_redirect',
] as const;

export const FUNNEL_AUDIENCES = ['guest', 'member', 'memorial'] as const;

export type FunnelAudience = (typeof FUNNEL_AUDIENCES)[number];

export const ALLOWED_FUNNEL_PROPERTY_KEYS = [
  'source',
  'style_id',
  'reason',
  'sku',
  'surface',
  'cache_hit',
] as const;

export const ALLOWED_PROPERTY_KEY_SET = new Set<string>(ALLOWED_FUNNEL_PROPERTY_KEYS);

export const FORBIDDEN_PROPERTY_KEY_PATTERN =
  /email|password|secret|token|authorization|apikey|api_key|service_role|signed_url|prompt|image|photo|url|payload|exception|stack|cookie|jwt|stripe|credential|phone|address|name|file/i;

export const SENSITIVE_VALUE_PATTERN =
  /(?:https?:\/\/|data:|Bearer\s+|sk_(?:live|test)_|eyJ[A-Za-z0-9_-]{10,}|service_role|token=|sig=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

export type FunnelPropertyKey = (typeof ALLOWED_FUNNEL_PROPERTY_KEYS)[number];

export type FunnelEventRecord = {
  schemaVersion: number;
  eventName: FunnelEventName;
  occurredAt: string;
  audience: FunnelAudience;
  release_id: string;
  releaseSha: string;
  releaseBuildId: string;
  sessionId: string;
  source: 'client' | 'server';
  properties: Record<string, string | number | boolean | null>;
};

const ALLOWED_SOURCE_VALUES = new Set(['photo', 'stock']);
const ALLOWED_FAIL_REASONS = new Set([
  'generation_failed',
  'invalid_image',
  'timeout',
  'internal_error',
  'unavailable',
]);

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

const clampPropertyValue = (
  key: string,
  value: string | number | boolean | null
): string | number | boolean | null | undefined => {
  if (key === 'source' && typeof value === 'string') {
    return ALLOWED_SOURCE_VALUES.has(value) ? value : undefined;
  }
  if (key === 'reason' && typeof value === 'string') {
    return ALLOWED_FAIL_REASONS.has(value) ? value : 'unavailable';
  }
  if (key === 'sku' && typeof value === 'string') {
    return value === 'revealed_artwork_full_res' ? value : undefined;
  }
  if (key === 'surface' && typeof value === 'string') {
    return value === 'memorial' || value === 'studio' ? value : undefined;
  }
  return value;
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
    const clamped = clampPropertyValue(key, value);
    if (clamped === undefined) continue;
    properties[key] = clamped;
  }
  return properties;
};

export const isAllowlistedFunnelEvent = (eventName: string): eventName is FunnelEventName =>
  FUNNEL_EVENT_NAME_SET.has(eventName);

export const isClientPersistableFunnelEvent = (eventName: string): eventName is FunnelEventName =>
  isAllowlistedFunnelEvent(eventName) &&
  !(SERVER_ONLY_FUNNEL_EVENTS as readonly string[]).includes(eventName) &&
  !(CLIENT_FORBIDDEN_FUNNEL_EVENTS as readonly string[]).includes(eventName);

export const isFunnelAudience = (value: unknown): value is FunnelAudience =>
  typeof value === 'string' && (FUNNEL_AUDIENCES as readonly string[]).includes(value);

export const formatReleaseId = (sha: string, buildId: string): string => `${sha}:${buildId}`;
