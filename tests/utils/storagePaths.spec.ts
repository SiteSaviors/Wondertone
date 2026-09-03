import { describe, expect, it } from 'vitest';
import {
  buildPublicStorageUrl,
  extractStoragePathFromUrl,
  isWorldReadableStoragePath,
} from '@/utils/storagePaths';

describe('storagePaths trust gates', () => {
  it('extracts locators from public and signed object URLs', () => {
    expect(
      extractStoragePathFromUrl(
        'https://example.supabase.co/storage/v1/object/public/preview-cache-public/display.jpg'
      )
    ).toBe('preview-cache-public/display.jpg');

    expect(
      extractStoragePathFromUrl(
        'https://example.supabase.co/storage/v1/object/sign/preview-cache-premium/1/clean.jpg'
      )
    ).toBe('preview-cache-premium/1/clean.jpg');

    expect(extractStoragePathFromUrl('preview-cache-premium/1/clean.jpg')).toBe(
      'preview-cache-premium/1/clean.jpg'
    );
  });

  it('never issues a public URL for premium or user-upload objects', () => {
    expect(isWorldReadableStoragePath('preview-cache-premium/1/clean.jpg')).toBe(false);
    expect(isWorldReadableStoragePath('user-uploads/original.jpg')).toBe(false);
    expect(buildPublicStorageUrl('preview-cache-premium/1/clean.jpg')).toBeNull();
    expect(buildPublicStorageUrl('user-uploads/original.jpg')).toBeNull();
  });

  it('still allows public URLs for the display preview bucket', () => {
    expect(isWorldReadableStoragePath('preview-cache-public/display.jpg')).toBe(true);
  });
});
