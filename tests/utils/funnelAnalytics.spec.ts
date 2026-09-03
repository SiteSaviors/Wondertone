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
import { setProductSurface } from '@/config/productSurface';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Prism funnel analytics contract v1', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setProductSurface('studio');
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

  it('sanitizes allowlisted events with audience and release_id', () => {
    const record = sanitizeFunnelEvent({
      eventName: 'visit',
      properties: {
        source: 'photo',
        email: 'customer@example.com',
        prompt: 'never store this',
        signed_url: 'https://example.supabase.co/storage/v1/object/sign/preview-cache-premium/x?token=abc',
        imageUrl: 'data:image/jpeg;base64,AAAA',
      },
      sessionId: 'session-fixture-1',
      audience: 'memorial',
      release: { gitSha: 'abc123def', buildId: 'build-9' },
    });

    expect(record).not.toBeNull();
    expect(record?.schemaVersion).toBe(FUNNEL_SCHEMA_VERSION);
    expect(record?.eventName).toBe('visit');
    expect(record?.audience).toBe('memorial');
    expect(record?.release_id).toBe('abc123def:build-9');
    expect(record?.properties).toEqual({
      source: 'photo',
      surface: 'studio',
    });
    expect(JSON.stringify(record)).not.toMatch(/customer@example.com|signed_url|data:image/);
  });

  it('drops unknown events, client conversion, and checkout success', () => {
    expect(sanitizeFunnelEvent({ eventName: 'entitlement_granted', properties: { sku: 'revealed_artwork_full_res' } })).toBeNull();
    expect(sanitizeFunnelEvent({ eventName: 'order_completed', properties: { user_tier: 'pro' } })).toBeNull();
    expect(sanitizeFunnelEvent({ eventName: 'checkout_success' })).toBeNull();
    expect(sanitizeFunnelEvent({ eventName: 'launchflow_open' })).toBeNull();
    expect(
      sanitizeFunnelEvent({
        eventName: 'reveal_failed',
        properties: {
          style_id: 'classic-oil',
          reason: 'generation_failed',
          previewUrl: 'https://example.com/preview.jpg?token=leak',
        },
      })?.properties
    ).toEqual({
      style_id: 'classic-oil',
      reason: 'generation_failed',
      surface: 'studio',
    });
  });

  it('maps legacy style keys without forwarding photographs or URLs', () => {
    const mapped = normalizeFunnelProperties({
      styleId: 'classic-oil',
      cacheHit: true,
      signedUrl: 'https://example.com/secret',
    });
    const record = sanitizeFunnelEvent({
      eventName: 'reveal_shown',
      properties: mapped,
    });
    expect(record?.properties).toMatchObject({
      style_id: 'classic-oil',
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
    expect(sanitizeFunnelEvent({ eventName: 'checkout_started', properties: { sku: 'revealed_artwork_full_res' } })?.eventName).toBe(
      'checkout_started'
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
