import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVE_CHECKOUT_ENABLED } from '@/config/commerceGuards';

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

const { createArtworkCheckoutSession } = await import('@/utils/artworkCheckout');

describe('createArtworkCheckoutSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps live checkout off and never surfaces a dollar amount', async () => {
    expect(LIVE_CHECKOUT_ENABLED).toBe(false);
    const result = await createArtworkCheckoutSession({
      previewLogId: null,
      accessToken: 'token',
    });
    expect(result).toEqual({ status: 'error', message: 'Reveal a style before checkout.' });
    expect(JSON.stringify(result)).not.toMatch(/\$\d/);
  });

  it('treats a missing test price as not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'price_not_configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await createArtworkCheckoutSession({
      previewLogId: 'preview-1',
      accessToken: 'token',
    });
    expect(result).toEqual({ status: 'not_configured' });
  });

  it('returns a redirect url only from the test checkout function', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/test_session', sku: 'revealed_artwork_full_res' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createArtworkCheckoutSession({
      previewLogId: 'preview-1',
      accessToken: 'token',
    });
    expect(result).toEqual({ status: 'redirect', url: 'https://checkout.stripe.com/c/test_session' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/functions/v1/create-artwork-checkout');
  });
});
