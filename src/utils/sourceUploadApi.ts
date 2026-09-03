import { ensureJpegDataUrl } from '@/utils/imageUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL) {
  console.warn('[sourceUploadApi] Missing VITE_SUPABASE_URL; canonical source uploads disabled.');
}

export type PersistOriginalUploadSuccess = {
  ok: true;
  bucket: string;
  storagePath: string;
  objectPath: string;
  publicUrl: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  hash: string;
  bytes: number;
  width: number | null;
  height: number | null;
  wasUploaded: boolean;
};

export type PersistOriginalUploadFailure = {
  ok: false;
  error: string;
  message?: string;
};

export type PersistOriginalUploadResult = PersistOriginalUploadSuccess | PersistOriginalUploadFailure;

export interface PersistOriginalUploadParams {
  dataUrl: string;
  width?: number | null;
  height?: number | null;
  accessToken?: string | null;
}

const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/persist-original-upload` : null;

const mapStatusError = (status: number): string => {
  if (status === 401) return 'unauthorized';
  if (status >= 500) return 'server_error';
  if (status === 413) return 'payload_too_large';
  return 'bad_request';
};

export async function persistOriginalUpload(params: PersistOriginalUploadParams): Promise<PersistOriginalUploadResult> {
  if (!ENDPOINT || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      error: 'configuration_error',
      message: 'Supabase environment variables are not configured',
    };
  }

  const { dataUrl, accessToken } = params;

  try {
    const ensured = await ensureJpegDataUrl(dataUrl, params.width ?? null, params.height ?? null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    };

    const token = accessToken ?? SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${token}`;

    const payload = {
      dataUrl: ensured.dataUrl,
      contentType: 'image/jpeg',
      width: ensured.width,
      height: ensured.height,
    };

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as PersistOriginalUploadResult | null;

    if (!response.ok || !json) {
      const fallbackError = mapStatusError(response.status);
      return json ?? { ok: false, error: fallbackError };
    }

    return json;
  } catch (error) {
    console.error('[sourceUploadApi] Failed to persist original upload');
    return {
      ok: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
