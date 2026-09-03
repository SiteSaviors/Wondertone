import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  CLEAN_ART_SIGNED_URL_TTL_SECONDS,
  decideCleanArtAccess,
  isPrivateArtBucket,
  shouldIssuePublicObjectUrl,
  toStorageLocator,
} from './cleanArtAccess.ts';

export type StorageObjectRef = {
  bucket: string;
  path: string;
};

export {
  CLEAN_ART_SIGNED_URL_TTL_SECONDS,
  decideCleanArtAccess,
  isPremiumCleanBucket,
  isPrivateArtBucket,
  isPublicDisplayBucket,
  isPremiumPublicObjectUrl,
  shouldIssuePublicObjectUrl,
  toStorageLocator,
  PREMIUM_CLEAN_BUCKET,
  PUBLIC_DISPLAY_BUCKET,
  USER_UPLOADS_BUCKET,
} from './cleanArtAccess.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) {
  throw new Error('[storageUtils] SUPABASE_URL is not configured');
}

const DEFAULT_ALLOWED_BUCKETS = ['preview-cache', 'preview-cache-public', 'preview-cache-premium', 'user-uploads'];
const allowedBuckets = new Set(
  (Deno.env.get('WT_ALLOWED_STORAGE_BUCKETS') ?? DEFAULT_ALLOWED_BUCKETS.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
);

allowedBuckets.add('user-uploads');

const PUBLIC_PREFIX = '/storage/v1/object/public/';
const SIGN_PREFIX = '/storage/v1/object/sign/';
const AUTHENTICATED_PREFIX = '/storage/v1/object/authenticated/';
const OBJECT_PREFIXES = [PUBLIC_PREFIX, SIGN_PREFIX, AUTHENTICATED_PREFIX];

const normalizePath = (value: string): string => value.replace(/^\/+/, '');

const extractPathAfterObjectPrefix = (value: string): string | null => {
  for (const prefix of OBJECT_PREFIXES) {
    const index = value.indexOf(prefix);
    if (index !== -1) {
      return value.slice(index + prefix.length);
    }
  }
  return null;
};

export const isAllowedBucket = (bucket: string): boolean => allowedBuckets.has(bucket);

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const parseStoragePath = (input?: string | null): StorageObjectRef | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Full URL handling
  if (isUrl(trimmed)) {
    return parseStorageUrl(trimmed);
  }

  const embeddedPath = extractPathAfterObjectPrefix(trimmed);
  if (embeddedPath) {
    return parseStoragePath(embeddedPath);
  }

  const normalized = normalizePath(trimmed);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return null;
  }

  const bucket = normalized.slice(0, slashIndex);
  const path = normalizePath(normalized.slice(slashIndex + 1));

  if (!isAllowedBucket(bucket) || path.length === 0) {
    return null;
  }

  return { bucket, path };
};

export const parseStorageUrl = (urlString: string): StorageObjectRef | null => {
  try {
    const supabaseHost = new URL(SUPABASE_URL);
    const url = new URL(urlString);
    if (url.origin !== supabaseHost.origin) {
      return null;
    }

    const pathAfterPrefix = extractPathAfterObjectPrefix(url.pathname);
    if (!pathAfterPrefix) {
      return null;
    }

    return parseStoragePath(pathAfterPrefix);
  } catch {
    return null;
  }
};

export const buildPublicUrl = ({ bucket, path }: StorageObjectRef): string =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${normalizePath(path)}`;

export const buildStorageLocator = (ref: StorageObjectRef): string =>
  toStorageLocator(ref.bucket, ref.path);

export const resolveAuthorizedObjectUrl = async (
  supabase: SupabaseClient,
  ref: StorageObjectRef,
  options: {
    requesterId?: string | null;
    ownerId?: string | null;
    entitledToClean?: boolean;
    pipelineAuthorized?: boolean;
    expiresInSeconds?: number;
  } = {}
): Promise<string | null> => {
  const decision = decideCleanArtAccess({
    bucket: ref.bucket,
    requesterId: options.requesterId,
    ownerId: options.ownerId,
    entitledToClean: options.entitledToClean,
    pipelineAuthorized: options.pipelineAuthorized,
  });

  if (!decision.allowed) {
    return null;
  }

  if (decision.mode === 'public' || shouldIssuePublicObjectUrl(ref.bucket)) {
    return buildPublicUrl(ref);
  }

  return buildSignedUrl(
    supabase,
    ref,
    options.expiresInSeconds ?? CLEAN_ART_SIGNED_URL_TTL_SECONDS
  );
};

export const resolveLocatorAccessUrl = async (
  supabase: SupabaseClient,
  locator: string,
  options: {
    requesterId?: string | null;
    ownerId?: string | null;
    entitledToClean?: boolean;
    pipelineAuthorized?: boolean;
    expiresInSeconds?: number;
  } = {}
): Promise<string | null> => {
  const ref = parseStorageUrl(locator) ?? parseStoragePath(locator);
  if (!ref) {
    // Provider / data URLs are not entitlement proof; pass through only for
    // this request. Never treat a public CDN URL as authorization.
    if (isPrivateArtBucket(locator.split('/')[0] ?? '')) {
      return null;
    }
    return locator;
  }

  return resolveAuthorizedObjectUrl(supabase, ref, options);
};

export const buildSignedUrl = async (
  supabase: SupabaseClient,
  ref: StorageObjectRef,
  expiresInSeconds: number
): Promise<string | null> => {
  if (!isAllowedBucket(ref.bucket)) return null;
  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
};

export const ensureObjectExists = async (supabase: SupabaseClient, ref: StorageObjectRef): Promise<boolean> => {
  if (!isAllowedBucket(ref.bucket)) return false;
  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 1);
  return Boolean(data?.signedUrl && !error);
};

export const downloadStorageObject = async (
  supabase: SupabaseClient,
  ref: StorageObjectRef
): Promise<{ buffer: ArrayBuffer; contentType: string }> => {
  if (!isAllowedBucket(ref.bucket)) {
    throw new Error(`Storage bucket not allowed: ${ref.bucket}`);
  }
  const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to download storage object');
  }
  const buffer = await data.arrayBuffer();
  return {
    buffer,
    contentType: data.type && data.type.length > 0 ? data.type : 'image/jpeg',
  };
};
