import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildPublicUrl,
  buildSignedUrl,
  parseStoragePath,
  parseStorageUrl,
  type StorageObjectRef,
} from './storageUtils.ts';

export const PRIVATE_STORAGE_BUCKETS = new Set(['preview-cache-premium', 'user-uploads']);
export const PUBLIC_WATERMARK_BUCKET = 'preview-cache-public';
export const DEFAULT_PRIVATE_SIGNED_TTL_SECONDS = 15 * 60;

export const isPrivateStorageBucket = (bucket: string): boolean => PRIVATE_STORAGE_BUCKETS.has(bucket);

export const resolveStorageRef = (value: string | null | undefined): StorageObjectRef | null => {
  if (!value) return null;
  return parseStoragePath(value) ?? parseStorageUrl(value);
};

export const formatStoragePath = (ref: StorageObjectRef): string => `${ref.bucket}/${ref.path}`;

export const userOwnsUploadObject = (userId: string, ref: StorageObjectRef): boolean => {
  if (ref.bucket !== 'user-uploads') return false;
  return ref.path === userId || ref.path.startsWith(`${userId}/`);
};

export const toOwnerScopedClientUrl = async (
  supabase: SupabaseClient,
  ref: StorageObjectRef,
  ttlSeconds = DEFAULT_PRIVATE_SIGNED_TTL_SECONDS
): Promise<string | null> => {
  if (ref.bucket === PUBLIC_WATERMARK_BUCKET || !isPrivateStorageBucket(ref.bucket)) {
    return buildPublicUrl(ref);
  }
  return await buildSignedUrl(supabase, ref, ttlSeconds);
};

export type OwnedPreviewLookup = {
  userId: string;
  storagePath?: string | null;
};

/**
 * Confirm the caller owns a private object via gallery / preview_log rows.
 * Synthetic fixture tests should mock this — never probe real customer artwork.
 */
export const assertPrivateObjectOwnedByUser = async (
  supabase: SupabaseClient,
  userId: string,
  ref: StorageObjectRef
): Promise<boolean> => {
  if (!isPrivateStorageBucket(ref.bucket)) {
    return true;
  }

  if (userOwnsUploadObject(userId, ref)) {
    return true;
  }

  const storagePath = formatStoragePath(ref);
  const publicUrl = buildPublicUrl(ref);

  const { data: galleryHit, error: galleryError } = await supabase
    .from('user_gallery')
    .select('id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .or(`clean_url.eq.${storagePath},clean_url.eq.${publicUrl},watermarked_url.eq.${storagePath},watermarked_url.eq.${publicUrl}`)
    .limit(1)
    .maybeSingle();

  if (!galleryError && galleryHit) {
    return true;
  }

  const { data: logHit, error: logError } = await supabase
    .from('preview_logs')
    .select('id')
    .eq('user_id', userId)
    .or(`preview_url.eq.${storagePath},preview_url.eq.${publicUrl},source_storage_path.eq.${storagePath}`)
    .limit(1)
    .maybeSingle();

  return Boolean(!logError && logHit);
};
