import { getReleaseIdentity, formatReleaseId, type ReleaseIdentity } from '@/config/releaseInfo';
import {
  getProductSurface,
  resolveFunnelAudience,
  type FunnelAudience,
} from '@/config/productSurface';

export const FUNNEL_SCHEMA_VERSION = 1;

/**
 * Prism event contract v1. Persist ONLY these names.
 * Conversion is entitlement_granted (server-authored). Never checkout success / redirect.
 */
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

const FUNNEL_EVENT_NAME_SET = new Set<string>(FUNNEL_EVENT_NAMES);

export const SERVER_ONLY_FUNNEL_EVENTS = ['entitlement_granted'] as const;

/**
 * Client must never persist conversion, payment, or entitlement. Those stay server-authoritative.
 */
export const CLIENT_FORBIDDEN_FUNNEL_EVENTS = [
  'entitlement_granted',
  'order_completed',
  'payment_succeeded',
  'entitlement_changed',
  'checkout_success',
  'checkout_redirect',
] as const;

export const ALLOWED_FUNNEL_PROPERTY_KEYS = [
  'source',
  'style_id',
  'reason',
  'sku',
  'surface',
  'cache_hit',
] as const;

export type FunnelPropertyKey = (typeof ALLOWED_FUNNEL_PROPERTY_KEYS)[number];

const ALLOWED_PROPERTY_KEY_SET = new Set<string>(ALLOWED_FUNNEL_PROPERTY_KEYS);

const FORBIDDEN_PROPERTY_KEY_PATTERN =
  /email|password|secret|token|authorization|apikey|api_key|service_role|signed_url|prompt|image|photo|url|payload|exception|stack|cookie|jwt|stripe|credential|phone|address|name|file/i;

const SENSITIVE_VALUE_PATTERN =
  /(?:https?:\/\/|data:|Bearer\s+|sk_(?:live|test)_|eyJ[A-Za-z0-9_-]{10,}|service_role|token=|sig=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const ALLOWED_SOURCE_VALUES = new Set(['photo', 'stock']);
const ALLOWED_FAIL_REASONS = new Set([
  'generation_failed',
  'invalid_image',
  'timeout',
  'internal_error',
  'unavailable',
]);

export type FunnelEventRecord = {
  schemaVersion: typeof FUNNEL_SCHEMA_VERSION;
  eventName: FunnelEventName;
  occurredAt: string;
  audience: FunnelAudience;
  release_id: string;
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
  audience?: FunnelAudience;
  isMember?: boolean;
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

const clampPropertyValue = (
  key: FunnelPropertyKey,
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

export const sanitizeFunnelEvent = (input: SanitizeFunnelEventInput): FunnelEventRecord | null => {
  if (!isFunnelEventName(input.eventName)) {
    return null;
  }

  if (
    input.source !== 'server' &&
    (SERVER_ONLY_FUNNEL_EVENTS as readonly string[]).includes(input.eventName)
  ) {
    return null;
  }

  if (
    input.source !== 'server' &&
    (CLIENT_FORBIDDEN_FUNNEL_EVENTS as readonly string[]).includes(input.eventName)
  ) {
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
    const clamped = clampPropertyValue(key as FunnelPropertyKey, value);
    if (clamped === undefined) continue;
    properties[key as FunnelPropertyKey] = clamped;
  }

  if (!properties.surface) {
    properties.surface = getProductSurface();
  }

  const sessionId =
    typeof input.sessionId === 'string' &&
    input.sessionId.length > 0 &&
    input.sessionId.length <= 80 &&
    !SENSITIVE_VALUE_PATTERN.test(input.sessionId)
      ? input.sessionId
      : resolveFunnelSessionId();

  const release = input.release ?? getReleaseIdentity();
  const audience =
    input.audience ??
    resolveFunnelAudience(Boolean(input.isMember), getProductSurface());

  return {
    schemaVersion: FUNNEL_SCHEMA_VERSION,
    eventName: input.eventName,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    audience,
    release_id: formatReleaseId(release),
    release,
    sessionId,
    source: input.source ?? 'client',
    properties,
  };
};

const mapLegacyKey = (key: string): string => {
  const aliases: Record<string, string> = {
    styleId: 'style_id',
    cacheHit: 'cache_hit',
  };
  return aliases[key] ?? key;
};

export const normalizeFunnelProperties = (payload: Record<string, unknown> = {}): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const mapped = mapLegacyKey(key);
    next[mapped] = value;
  }
  return next;
};
