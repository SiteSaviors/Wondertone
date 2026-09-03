export const PREMIUM_CLEAN_BUCKET = 'preview-cache-premium';
export const PUBLIC_DISPLAY_BUCKET = 'preview-cache-public';
export const USER_UPLOADS_BUCKET = 'user-uploads';

export const CLEAN_ART_SIGNED_URL_TTL_SECONDS = 3600;

export type CleanArtAccessDecision =
  | { allowed: true; mode: 'public' }
  | { allowed: true; mode: 'signed' }
  | { allowed: false; reason: 'unauthenticated' | 'wrong_owner' | 'missing_owner' | 'not_entitled' };

export const isPremiumCleanBucket = (bucket: string): boolean => bucket === PREMIUM_CLEAN_BUCKET;

export const isPublicDisplayBucket = (bucket: string): boolean => bucket === PUBLIC_DISPLAY_BUCKET;

export const isPrivateArtBucket = (bucket: string): boolean =>
  bucket === PREMIUM_CLEAN_BUCKET || bucket === USER_UPLOADS_BUCKET;

export const canAccessOwnedCleanArt = (
  requesterId: string | null | undefined,
  ownerId: string | null | undefined
): boolean => Boolean(requesterId && ownerId && requesterId === ownerId);

export const shouldIssuePublicObjectUrl = (bucket: string): boolean => isPublicDisplayBucket(bucket);

export const isPremiumPublicObjectUrl = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /\/storage\/v1\/object\/public\/preview-cache-premium(?:\/|$)/i.test(value);
};

export const decideCleanArtAccess = (input: {
  bucket: string;
  requesterId?: string | null;
  ownerId?: string | null;
  entitledToClean?: boolean;
  pipelineAuthorized?: boolean;
}): CleanArtAccessDecision => {
  if (isPublicDisplayBucket(input.bucket)) {
    return { allowed: true, mode: 'public' };
  }

  if (!isPrivateArtBucket(input.bucket)) {
    return { allowed: true, mode: 'public' };
  }

  // Only the in-flight generate / cache-hit that produced this object
  // may mint without a separately proven owner. Still never a public URL.
  if (input.pipelineAuthorized) {
    return { allowed: true, mode: 'signed' };
  }

  if (!input.requesterId) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  if (!input.ownerId) {
    return { allowed: false, reason: 'missing_owner' };
  }

  if (input.ownerId !== input.requesterId) {
    return { allowed: false, reason: 'wrong_owner' };
  }

  if (input.entitledToClean !== true) {
    return { allowed: false, reason: 'not_entitled' };
  }

  return { allowed: true, mode: 'signed' };
};
