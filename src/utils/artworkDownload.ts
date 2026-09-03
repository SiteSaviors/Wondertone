import { FIRST_SKU } from '@/config/commerceGuards';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type ArtworkDownloadResult =
  | { status: 'entitled'; downloadUrl: string }
  | { status: 'paywall' }
  | { status: 'error'; message: string };

type RequestArtworkDownloadParams = {
  previewLogId: string | null | undefined;
  accessToken: string | null;
};

export async function requestArtworkDownload({
  previewLogId,
  accessToken,
}: RequestArtworkDownloadParams): Promise<ArtworkDownloadResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { status: 'error', message: 'Download is not configured.' };
  }
  if (!accessToken) {
    return { status: 'paywall' };
  }
  if (!previewLogId) {
    return { status: 'error', message: 'Reveal a style before requesting the file.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-artwork-download`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        previewLogId,
        sku: FIRST_SKU,
      }),
    });

    if (response.status === 401 || response.status === 402 || response.status === 403) {
      return { status: 'paywall' };
    }

    if (!response.ok) {
      return { status: 'error', message: 'Download is unavailable right now.' };
    }

    const payload = (await response.json().catch(() => null)) as {
      downloadUrl?: string;
      entitled?: boolean;
    } | null;
    if (
      payload?.entitled !== true ||
      !payload.downloadUrl ||
      typeof payload.downloadUrl !== 'string'
    ) {
      return { status: 'error', message: 'Download is unavailable right now.' };
    }

    return { status: 'entitled', downloadUrl: payload.downloadUrl };
  } catch {
    return { status: 'error', message: 'Download is unavailable right now.' };
  }
}

export const triggerBrowserDownload = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
