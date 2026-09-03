import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { buildPublicUrl, isAllowedBucket } from '../_shared/storageUtils.ts';
import type { StorageObjectRef } from '../_shared/storageUtils.ts';
import { computeSha256Hex } from '../_shared/hash.ts';

type PersistOriginalUploadRequest = {
  dataUrl: string;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
};

type PersistOriginalUploadResponse = {
  ok: true;
  bucket: string;
  storagePath: string;
  objectPath: string;
  publicUrl: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  width: number | null;
  height: number | null;
  hash: string;
  bytes: number;
  wasUploaded: boolean;
} | {
  ok: false;
  error: string;
  message?: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SOURCE_BUCKET = Deno.env.get('WT_SOURCE_IMAGE_BUCKET') ?? 'user-uploads';
const SIGNED_URL_TTL_SECONDS = clampPositiveInt(Deno.env.get('WT_SOURCE_IMAGE_SIGNED_TTL'), 15 * 60);
const MAX_BYTES = clampPositiveInt(Deno.env.get('WT_SOURCE_IMAGE_MAX_BYTES'), 15 * 1024 * 1024);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[persist-original-upload] Missing Supabase configuration');
}

if (!isAllowedBucket(SOURCE_BUCKET)) {
  throw new Error(`[persist-original-upload] Bucket "${SOURCE_BUCKET}" is not present in WT_ALLOWED_STORAGE_BUCKETS`);
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JPEG_MIME_TYPES = new Set(['image/jpeg', 'image/jpg']);

const base64Pattern = /^data:(?<mime>[^;]+);base64,(?<payload>[A-Za-z0-9+/=]+)$/;

function clampPositiveInt(value: string | number | undefined | null, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

type ParsedDataUrl = {
  mimeType: string;
  bytes: Uint8Array;
};

export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const match = base64Pattern.exec(dataUrl.trim());
  if (!match?.groups?.mime || !match.groups.payload) {
    throw new Error('Invalid data URL payload');
  }
  const mimeType = match.groups.mime.toLowerCase();
  let binary: string;
  try {
    binary = atob(match.groups.payload);
  } catch {
    throw new Error('Failed to decode base64 payload');
  }
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return { mimeType, bytes: buffer };
}

function toStorageObjectRef(bucket: string, objectPath: string): StorageObjectRef {
  return { bucket, path: objectPath.replace(/^\/+/, '') };
}

export type SupabaseClientLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        data: Uint8Array,
        options: { contentType: string; cacheControl: string; upsert: boolean }
      ) => Promise<{ error: { message?: string } | null }>;
      createSignedUrl: (
        path: string,
        expiresInSeconds: number
      ) => Promise<{ error: { message?: string } | null; data: { signedUrl: string } | null }>;
    };
  };
};

export async function persistOriginalImage(
  supabase: SupabaseClientLike,
  userId: string,
  payload: PersistOriginalUploadRequest
): Promise<PersistOriginalUploadResponse> {
  if (!payload?.dataUrl || typeof payload.dataUrl !== 'string') {
    return { ok: false, error: 'invalid_payload', message: 'dataUrl is required' };
  }

  let parsed: ParsedDataUrl;
  try {
    parsed = parseDataUrl(payload.dataUrl);
  } catch (error) {
    return {
      ok: false,
      error: 'invalid_data_url',
      message: error instanceof Error ? error.message : 'Failed to parse data URL',
    };
  }

  const declaredContentType = (payload.contentType ?? parsed.mimeType).toLowerCase();
  if (!JPEG_MIME_TYPES.has(declaredContentType)) {
    return {
      ok: false,
      error: 'unsupported_content_type',
      message: `Only JPEG content is supported. Received ${declaredContentType}`,
    };
  }

  if (parsed.bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      error: 'file_too_large',
      message: `Payload exceeds limit of ${MAX_BYTES} bytes`,
    };
  }

  const hash = await computeSha256Hex(parsed.bytes);
  const objectPath = `${userId}/${hash}.jpg`;
  const storagePath = `${SOURCE_BUCKET}/${objectPath}`;
  const storageRef = toStorageObjectRef(SOURCE_BUCKET, objectPath);

  let wasUploaded = false;
  const uploadResult = await supabase.storage
    .from(SOURCE_BUCKET)
    .upload(objectPath, parsed.bytes, {
      contentType: 'image/jpeg',
      cacheControl: 'private, max-age=31536000',
      upsert: false,
    });

  if (uploadResult.error) {
    const message = uploadResult.error.message ?? '';
    const isDuplicate = message.toLowerCase().includes('already exists')
      || message.toLowerCase().includes('duplicate');
    if (!isDuplicate) {
      return {
        ok: false,
        error: 'storage_upload_failed',
        message: message || 'Failed to upload original image',
      };
    }
  } else {
    wasUploaded = true;
  }

  let signedUrl: string | null = null;
  let signedUrlExpiresAt: number | null = null;
  const signedResult = await supabase.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (!signedResult.error && signedResult.data?.signedUrl) {
    signedUrl = signedResult.data.signedUrl;
    signedUrlExpiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
  }

  const publicUrl = buildPublicUrl(storageRef);

  return {
    ok: true,
    bucket: SOURCE_BUCKET,
    storagePath,
    objectPath,
    publicUrl,
    signedUrl,
    signedUrlExpiresAt,
    width: typeof payload.width === 'number' ? payload.width : null,
    height: typeof payload.height === 'number' ? payload.height : null,
    hash,
    bytes: parsed.bytes.byteLength,
    wasUploaded,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respond({ ok: false, error: 'method_not_allowed', message: 'Use POST' }, 405);
  }

  try {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const token = extractBearer(authHeader);
    if (!token) {
      return respond({ ok: false, error: 'unauthorized', message: 'Missing bearer token' }, 401);
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult?.user?.id) {
      return respond({ ok: false, error: 'unauthorized', message: 'Invalid Supabase session' }, 401);
    }

    const body = (await req.json()) as PersistOriginalUploadRequest;
    const result = await persistOriginalImage(
      supabase as unknown as SupabaseClientLike,
      userResult.user.id,
      body
    );
    return respond(result, determineStatus(result));
  } catch (error) {
    console.error(JSON.stringify({ scope: 'persist-original-upload', message: 'unexpected_error' }));
    return respond(
      { ok: false, error: 'internal_error', message: error instanceof Error ? error.message : 'Unexpected error' },
      500
    );
  }
});

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function respond(body: PersistOriginalUploadResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function determineStatus(result: PersistOriginalUploadResponse): number {
  if (result.ok) return 200;
  switch (result.error) {
    case 'unauthorized':
      return 401;
    case 'invalid_payload':
    case 'invalid_data_url':
    case 'unsupported_content_type':
    case 'file_too_large':
      return 400;
    case 'storage_upload_failed':
      return 502;
    default:
      return 400;
  }
}
