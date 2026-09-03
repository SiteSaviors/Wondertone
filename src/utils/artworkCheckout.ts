import { FIRST_SKU, LIVE_CHECKOUT_ENABLED } from '@/config/commerceGuards';
import { formatReleaseId } from '@/config/releaseInfo';
import { getProductSurface, resolveFunnelAudience } from '@/config/productSurface';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type ArtworkCheckoutResult =
  | { status: 'redirect'; url: string }
  | { status: 'not_configured' }
  | { status: 'live_disabled' }
  | { status: 'error'; message: string };

type CreateArtworkCheckoutParams = {
  previewLogId: string | null | undefined;
  accessToken: string | null;
  isMember?: boolean;
};

export async function createArtworkCheckoutSession({
  previewLogId,
  accessToken,
  isMember = Boolean(accessToken),
}: CreateArtworkCheckoutParams): Promise<ArtworkCheckoutResult> {
  if (LIVE_CHECKOUT_ENABLED) {
    return { status: 'live_disabled' };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { status: 'error', message: 'Checkout is not configured.' };
  }
  if (!accessToken) {
    return { status: 'error', message: 'Sign in to continue.' };
  }
  if (!previewLogId) {
    return { status: 'error', message: 'Reveal a style before checkout.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-artwork-checkout`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sku: FIRST_SKU,
        previewLogId,
        audience: resolveFunnelAudience(isMember, getProductSurface()),
        release_id: formatReleaseId(),
      }),
    });

    if (response.status === 503) {
      return { status: 'not_configured' };
    }
    if (response.status === 403) {
      return { status: 'live_disabled' };
    }
    if (!response.ok) {
      return { status: 'error', message: 'Checkout is unavailable right now.' };
    }

    const payload = (await response.json().catch(() => null)) as { url?: string } | null;
    if (!payload?.url || typeof payload.url !== 'string') {
      return { status: 'error', message: 'Checkout is unavailable right now.' };
    }

    return { status: 'redirect', url: payload.url };
  } catch {
    return { status: 'error', message: 'Checkout is unavailable right now.' };
  }
}
