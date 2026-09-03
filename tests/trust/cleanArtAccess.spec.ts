import { describe, expect, it } from 'vitest';
import {
  decideCleanArtAccess,
  isPremiumPublicObjectUrl,
  PREMIUM_CLEAN_BUCKET,
  PUBLIC_DISPLAY_BUCKET,
  USER_UPLOADS_BUCKET,
} from '@/utils/trust/cleanArtAccess';
import { isWorldReadableStoragePath } from '@/utils/storagePaths';

describe('clean art access decisions', () => {
  it('allows public display-bucket URLs without auth', () => {
    expect(
      decideCleanArtAccess({
        bucket: PUBLIC_DISPLAY_BUCKET,
        requesterId: null,
        ownerId: 'owner-a',
      })
    ).toEqual({ allowed: true, mode: 'public' });
  });

  it('denies another user access to clean premium art', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: 'user-b',
        ownerId: 'user-a',
        entitledToClean: true,
      })
    ).toEqual({ allowed: false, reason: 'wrong_owner' });
  });

  it('denies unauthenticated access to clean premium art', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: null,
        ownerId: 'user-a',
        entitledToClean: true,
      })
    ).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('mints signed access only for the owning entitled user', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: 'user-a',
        ownerId: 'user-a',
        entitledToClean: true,
      })
    ).toEqual({ allowed: true, mode: 'signed' });
  });

  it('does not treat a public CDN URL as entitlement for premium objects', () => {
    const leaked =
      'https://fvjganetpyyrguuxjtqi.supabase.co/storage/v1/object/public/preview-cache-premium/1/high/1-1/abc.jpg';
    expect(isPremiumPublicObjectUrl(leaked)).toBe(true);
    expect(isWorldReadableStoragePath('preview-cache-premium/1/high/1-1/abc.jpg')).toBe(false);
    expect(isWorldReadableStoragePath('preview-cache-public/display/abc.jpg')).toBe(true);
    expect(isWorldReadableStoragePath('user-uploads/source.jpg')).toBe(false);
  });

  it('keeps user-uploads private', () => {
    expect(
      decideCleanArtAccess({
        bucket: USER_UPLOADS_BUCKET,
        requesterId: 'user-b',
        ownerId: 'user-a',
        entitledToClean: true,
      })
    ).toEqual({ allowed: false, reason: 'wrong_owner' });
  });

  it('denies clean art when ownerId is missing', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: 'user-a',
        ownerId: null,
        entitledToClean: true,
      })
    ).toEqual({ allowed: false, reason: 'missing_owner' });

    expect(
      decideCleanArtAccess({
        bucket: USER_UPLOADS_BUCKET,
        requesterId: 'user-a',
        entitledToClean: true,
      })
    ).toEqual({ allowed: false, reason: 'missing_owner' });
  });

  it('denies clean art when entitledToClean is missing and not pipelineAuthorized', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: 'user-a',
        ownerId: 'user-a',
      })
    ).toEqual({ allowed: false, reason: 'not_entitled' });
  });

  it('denies clean art when entitledToClean is false', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        requesterId: 'user-a',
        ownerId: 'user-a',
        entitledToClean: false,
      })
    ).toEqual({ allowed: false, reason: 'not_entitled' });
  });

  it('allows pipelineAuthorized generate/cache-hit without a separately proven owner', () => {
    expect(
      decideCleanArtAccess({
        bucket: PREMIUM_CLEAN_BUCKET,
        pipelineAuthorized: true,
      })
    ).toEqual({ allowed: true, mode: 'signed' });
  });
});
