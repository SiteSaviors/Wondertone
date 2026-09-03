import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

const { requestArtworkDownload } = await import('@/utils/artworkDownload');

describe('requestArtworkDownload', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ downloadUrl: 'https://signed.example/clean.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not treat a download URL as entitled without the entitlement flag', async () => {
    const result = await requestArtworkDownload({
      previewLogId: 'log-1',
      accessToken: 'token',
    });
    expect(result).toEqual({
      status: 'error',
      message: 'Download is unavailable right now.',
    });
  });

  it('returns entitled only when the server confirms the entitlement row', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            downloadUrl: 'https://signed.example/clean.jpg',
            entitled: true,
            sku: 'revealed_artwork_full_res',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const result = await requestArtworkDownload({
      previewLogId: 'log-1',
      accessToken: 'token',
    });
    expect(result).toEqual({
      status: 'entitled',
      downloadUrl: 'https://signed.example/clean.jpg',
    });
  });

  it('opens the paywall when the entitlement row is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'entitlement_required', entitled: false }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await requestArtworkDownload({
      previewLogId: 'log-1',
      accessToken: 'token',
    });
    expect(result).toEqual({ status: 'paywall' });
  });
});
