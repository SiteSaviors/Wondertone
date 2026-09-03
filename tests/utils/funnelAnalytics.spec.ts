import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_FORBIDDEN_FUNNEL_EVENTS,
  FUNNEL_EVENT_NAMES,
  FUNNEL_SCHEMA_VERSION,
  normalizeFunnelProperties,
  sanitizeFunnelEvent,
} from '@/utils/funnelAnalytics';
import { sendAnalyticsEvent } from '@/utils/analyticsClient';
import { trackOrderCompleted } from '@/utils/telemetry';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('funnel analytics contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the client and edge allowlists in parity', () => {
    const shared = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/_shared/funnelEventContract.ts'),
      'utf8'
    );
    for (const eventName of FUNNEL_EVENT_NAMES) {
      expect(shared).toContain(`'${eventName}'`);
    }
    for (const forbidden of CLIENT_FORBIDDEN_FUNNEL_EVENTS) {
      expect(shared).toContain(`'${forbidden}'`);
    }
  });

  it('sanitizes allowlisted events and attaches release identity', () => {
    const record = sanitizeFunnelEvent({
      eventName: 'launchflow_open',
      properties: {
        source: 'hero',
        user_tier: 'free',
        authenticated: 'guest',
        email: 'customer@example.com',
        prompt: 'never store this',
        signed_url: 'https://example.supabase.co/storage/v1/object/sign/preview-cache-premium/x?token=abc',
        imageUrl: 'data:image/jpeg;base64,AAAA',
      },
      sessionId: 'session-fixture-1',
      release: { gitSha: 'abc123def', buildId: 'build-9' },
    });

    expect(record).not.toBeNull();
    expect(record?.schemaVersion).toBe(FUNNEL_SCHEMA_VERSION);
    expect(record?.eventName).toBe('launchflow_open');
    expect(record?.release).toEqual({ gitSha: 'abc123def', buildId: 'build-9' });
    expect(record?.properties).toEqual({
      source: 'hero',
      user_tier: 'free',
      authenticated: 'guest',
    });
    expect(JSON.stringify(record)).not.toMatch(/customer@example.com|signed_url|data:image/);
  });

  it('drops unknown events, client order completion, and sensitive scalars', () => {
    expect(sanitizeFunnelEvent({ eventName: 'order_completed', properties: { user_tier: 'pro' } })).toBeNull();
    expect(sanitizeFunnelEvent({ eventName: 'random_console_dump', properties: { status: 'ok' } })).toBeNull();
    expect(
      sanitizeFunnelEvent({
        eventName: 'checkout_step_view',
        properties: {
          step: 'payment',
          user_tier: 'plus',
          contactEmail: 'hidden@example.com',
          previewUrl: 'https://example.com/preview.jpg?token=leak',
        },
      })?.properties
    ).toEqual({
      step: 'payment',
      user_tier: 'plus',
    });
  });

  it('maps legacy telemetry keys without forwarding photographs or URLs', () => {
    const mapped = normalizeFunnelProperties({
      styleId: 'classic-oil',
      userTier: 'creator',
      orderTotal: 199,
      cacheHit: true,
      signedUrl: 'https://example.com/secret',
    });
    const record = sanitizeFunnelEvent({
      eventName: 'order_started',
      properties: mapped,
    });
    expect(record?.properties).toMatchObject({
      style_id: 'classic-oil',
      user_tier: 'creator',
      order_total_cents: 19900,
      cache_hit: true,
    });
    expect(record?.properties).not.toHaveProperty('signedUrl');
  });

  it('does not treat client order completion as authoritative', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    trackOrderCompleted('pro', 249, true, 'US');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sanitizeFunnelEvent({ eventName: 'order_completed' })).toBeNull();
    expect(sanitizeFunnelEvent({ eventName: 'order_started', properties: { user_tier: 'free' } })?.eventName).toBe(
      'order_started'
    );
  });
});

describe('analytics client allowlist sink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not forward dropped events to any sink', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    sendAnalyticsEvent('order_completed', {
      email: 'someone@example.com',
      previewUrl: 'https://signed.example/token',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
