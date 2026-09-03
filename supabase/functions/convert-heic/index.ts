import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import libheifInit from 'https://cdn.jsdelivr.net/npm/libheif-js@1.19.8/libheif-wasm/libheif-bundle.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCorsPreflightRequest, createCorsResponse } from '../generate-style-preview/corsUtils.ts';
import { computeSha256Hex } from '../_shared/hash.ts';

// Lazy initialization singleton for libheif WASM module
// This avoids initializing the heavy WASM module on cold starts (which would exceed 2s CPU limit)
let libheifInstance: ReturnType<typeof libheifInit> | null = null;

async function getLibheif() {
  if (!libheifInstance) {
    console.log('[convert-heic] Initializing libheif WASM module');
    libheifInstance = await libheifInit();
  }
  return libheifInstance;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[convert-heic] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const CACHE_BUCKET = Deno.env.get('HEIC_CACHE_BUCKET') ?? 'user-uploads';
const SIGNED_URL_TTL_SECONDS = clampPositiveInt(Deno.env.get('HEIC_SIGNED_URL_TTL_SECONDS'), 24 * 60 * 60);
const CACHE_TTL_DAYS = clampPositiveInt(Deno.env.get('HEIC_CACHE_TTL_DAYS'), 30);
const MAX_FILE_BYTES = clampPositiveInt(Deno.env.get('HEIC_MAX_FILE_BYTES'), 12 * 1024 * 1024); // 12 MB default

const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const originHeader = req.headers.get('origin') ?? undefined;

  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(originHeader);
  }

  if (req.method !== 'POST') {
    return createCorsResponse(JSON.stringify({ error: 'method_not_allowed' }), 405, originHeader);
  }

  try {
    // Validate authorization header (allow both user tokens and anon key)
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError('missing_authorization', 'Missing authorization header', 401);
    }

    // Extract bearer token
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!bearerToken) {
      throw new HttpError('invalid_authorization', 'Authorization must be a Bearer token', 401);
    }

    // Validate token is either a valid user session or the anon key
    const isAnonKey = SUPABASE_ANON_KEY && bearerToken === SUPABASE_ANON_KEY;
    if (!isAnonKey) {
      // Verify it's a valid user session token by checking with Supabase
      try {
        const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
        if (error || !user) {
          throw new HttpError('invalid_token', 'Invalid or expired authorization token', 401);
        }
      } catch (_error) {
        throw new HttpError('auth_verification_failed', 'Failed to verify authorization token', 401);
      }
    }

    const { file, filename } = await extractFile(req);
    if (file.size === 0) {
      throw new HttpError('empty_payload', 'Uploaded file is empty', 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(
        'payload_too_large',
        `HEIC file exceeds maximum size of ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB`,
        413
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const hash = await computeSha256Hex(arrayBuffer);

    const existingRecord = await fetchCachedRecord(hash);
    if (existingRecord && !isExpired(existingRecord.expires_at)) {
      try {
        const signed = await createSignedUrl(existingRecord.bucket, existingRecord.storage_path);
        await touchCacheRecord(hash, existingRecord.hit_count + 1);

        return createCorsResponse(
          JSON.stringify({
            ok: true,
            cacheHit: true,
            hash,
            width: existingRecord.width,
            height: existingRecord.height,
            byteSize: existingRecord.byte_size,
            storagePath: existingRecord.storage_path,
            bucket: existingRecord.bucket,
            signedUrl: signed.signedUrl,
            signedUrlExpiresAt: signed.expiresAt
          }),
          200,
          originHeader
        );
      } catch (cacheError) {
        console.warn('[convert-heic] Cached signed URL retrieval failed, regenerating asset', cacheError);
      }
    }

    const conversion = await convertHeicToJpeg(arrayBuffer);
    const storagePath = buildStoragePath(hash, filename);

    await uploadToStorage(storagePath, conversion.jpegBytes);

    const signed = await createSignedUrl(CACHE_BUCKET, storagePath);
    await upsertCacheRecord({
      hash,
      bucket: CACHE_BUCKET,
      storage_path: storagePath,
      width: conversion.width,
      height: conversion.height,
      byte_size: conversion.jpegBytes.byteLength,
      content_type: 'image/jpeg',
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString()
    });

    return createCorsResponse(
      JSON.stringify({
        ok: true,
        cacheHit: false,
        hash,
        width: conversion.width,
        height: conversion.height,
        byteSize: conversion.jpegBytes.byteLength,
        storagePath,
        bucket: CACHE_BUCKET,
        signedUrl: signed.signedUrl,
        signedUrlExpiresAt: signed.expiresAt
      }),
      200,
      originHeader
    );
  } catch (error) {
    const httpError = normalizeError(error);
    console.error('[convert-heic] Failure', { code: httpError.code });
    return createCorsResponse(
      JSON.stringify({ ok: false, error: httpError.code, message: httpError.message }),
      httpError.status,
      originHeader
    );
  }
});

type HttpErrorShape = {
  code: string;
  message: string;
  status: number;
};

class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function clampPositiveInt(value: string | undefined | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function extractFile(req: Request): Promise<{ file: File; filename: string }> {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new HttpError('invalid_payload', 'Expected file field in multipart payload', 400);
    }
    return { file, filename: file.name ?? 'upload.heic' };
  }

  if (contentType === 'application/octet-stream') {
    const arrayBuffer = await req.arrayBuffer();
    const file = new File([arrayBuffer], 'upload.heic', { type: 'image/heic' });
    return { file, filename: 'upload.heic' };
  }

  throw new HttpError('unsupported_media_type', 'Only multipart/form-data or application/octet-stream supported', 415);
}

type CacheRecord = {
  hash: string;
  bucket: string;
  storage_path: string;
  width: number;
  height: number;
  byte_size: number;
  content_type: string;
  created_at: string;
  last_accessed_at: string;
  expires_at: string;
  hit_count: number;
};

async function fetchCachedRecord(hash: string): Promise<CacheRecord | null> {
  const { data, error } = await supabase
    .from('heic_conversion_cache')
    .select('*')
    .eq('hash', hash)
    .maybeSingle();

  if (error) {
    console.error('[convert-heic] Failed to fetch cached record', error);
    return null;
  }

  return data as CacheRecord | null;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

async function touchCacheRecord(hash: string, nextHitCount: number): Promise<void> {
  const { error } = await supabase
    .from('heic_conversion_cache')
    .update({
      last_accessed_at: new Date().toISOString(),
      hit_count: nextHitCount
    })
    .eq('hash', hash);

  if (error) {
    console.warn('[convert-heic] Failed to update cache record', error);
  }
}

async function upsertCacheRecord(entry: {
  hash: string;
  bucket: string;
  storage_path: string;
  width: number;
  height: number;
  byte_size: number;
  content_type: string;
  expires_at: string;
}): Promise<void> {
  const { error } = await supabase
    .from('heic_conversion_cache')
    .upsert(
      {
        ...entry,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        hit_count: 1
      },
      { onConflict: 'hash' }
    );

  if (error) {
    throw new Error(`failed_to_cache: ${error.message}`);
  }
}

async function uploadToStorage(storagePath: string, data: Uint8Array): Promise<void> {
  const { error } = await supabase
    .storage
    .from(CACHE_BUCKET)
    .upload(storagePath, data, {
      contentType: 'image/jpeg',
      cacheControl: 'private, max-age=2592000',
      upsert: true
    });

  if (error) {
    throw new Error(`storage_upload_failed: ${error.message}`);
  }
}

async function createSignedUrl(bucket: string, storagePath: string) {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`signed_url_failed: ${error?.message ?? 'unknown error'}`);
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
  };
}

function buildStoragePath(hash: string, filename: string): string {
  const safeName = filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')
    ? filename
    : `${filename.replace(/\.[^/.]+$/, '') || 'upload'}.jpg`;
  return `heic-conversions/${hash}/${safeName}`;
}

async function convertHeicToJpeg(buffer: ArrayBuffer): Promise<{ jpegBytes: Uint8Array; width: number; height: number }> {
  try {
    // Lazy initialize libheif WASM module only when needed
    const libheif = await getLibheif();

    // Initialize libheif decoder
    const decoder = new libheif.HeifDecoder();
    const data = new Uint8Array(buffer);

    // Decode HEIC file - returns array of all images in the file
    const images = decoder.decode(data);

    if (!images || images.length === 0) {
      throw new Error('heif_decode_failed: No images found in HEIC file');
    }

    // Get the first image
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();

    if (!width || !height) {
      throw new Error('heif_invalid_dimensions');
    }

    // Get RGBA image data
    const rgbaData = await new Promise<Uint8ClampedArray>((resolve, reject) => {
      const displayData = {
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
      };

      image.display(displayData, (result: typeof displayData | null) => {
        if (!result) {
          reject(new Error('heif_display_failed: Failed to get image data'));
          return;
        }
        resolve(result.data);
      });
    });

    // Convert RGBA to JPEG using ImageScript
    const imgScript = new Image(width, height);
    imgScript.bitmap.set(rgbaData);
    const jpegBytes = await imgScript.encodeJPEG(92);

    return { jpegBytes, width, height };
  } catch (error) {
    console.error('[convert-heic] HEIC conversion failed', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}


function normalizeError(error: unknown): HttpErrorShape {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  if (error instanceof Error) {
    return {
      code: 'internal_error',
      message: error.message ?? 'Unhandled error',
      status: 500
    };
  }

  return {
    code: 'internal_error',
    message: 'Unknown error',
    status: 500
  };
}

if (!SUPABASE_ANON_KEY) {
  console.warn('[convert-heic] SUPABASE_ANON_KEY not configured; client requests must include Authorization header');
}
