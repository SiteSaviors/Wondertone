const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

let supabaseOrigin: string | null = null;
try {
  supabaseOrigin = SUPABASE_URL ? new URL(SUPABASE_URL).origin : null;
} catch {
  supabaseOrigin = null;
}

const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/';
const STORAGE_SIGN_PREFIX = '/storage/v1/object/sign/';
const STORAGE_AUTH_PREFIX = '/storage/v1/object/authenticated/';
const STORAGE_OBJECT_PREFIXES = [STORAGE_PUBLIC_PREFIX, STORAGE_SIGN_PREFIX, STORAGE_AUTH_PREFIX];

const STORAGE_PATH_REGEX = /^(preview-cache(?:-public|-premium)?|user-uploads)\/(.+)$/;

const WORLD_READABLE_BUCKETS = new Set(['preview-cache-public', 'preview-cache']);

const extractBucket = (storagePath: string): string => storagePath.replace(/^\/+/, '').split('/')[0] ?? '';

const pathAfterObjectPrefix = (value: string): string | null => {
  for (const prefix of STORAGE_OBJECT_PREFIXES) {
    const index = value.indexOf(prefix);
    if (index !== -1) {
      return value.slice(index + prefix.length);
    }
  }
  return null;
};

export const extractStoragePathFromUrl = (value?: string | null): string | null => {
  if (!value) return null;

  if (STORAGE_PATH_REGEX.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    if (supabaseOrigin && url.origin !== supabaseOrigin) {
      return null;
    }
    const path = pathAfterObjectPrefix(url.pathname);
    if (!path) return null;
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

export const isWorldReadableStoragePath = (storagePath: string | null | undefined): boolean => {
  if (!storagePath) return false;
  return WORLD_READABLE_BUCKETS.has(extractBucket(storagePath.replace(/^\/+/, '')));
};

export const buildPublicStorageUrl = (storagePath: string | null | undefined): string | null => {
  if (!storagePath || !SUPABASE_URL) return null;
  const normalized = storagePath.replace(/^\/+/g, '');
  if (!isWorldReadableStoragePath(normalized)) {
    return null;
  }
  return `${SUPABASE_URL.replace(/\/$/, '')}${STORAGE_PUBLIC_PREFIX}${normalized}`;
};
