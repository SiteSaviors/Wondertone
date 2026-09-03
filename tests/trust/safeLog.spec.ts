import { describe, expect, it } from 'vitest';
import { containsCredentialLeak, redactLogMeta, redactLogValue } from '@/utils/trust/safeLog';

describe('safe log redaction', () => {
  it('redacts JWTs, bearer tokens, and stripe secrets', () => {
    const redacted = redactLogMeta({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa.bbbbbbbbbb',
      token: 'sk_live_secretvalue',
      note: 'whsec_abc123 and sb_secret_xyz should vanish',
    });

    expect(JSON.stringify(redacted)).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
    expect(JSON.stringify(redacted)).not.toMatch(/sk_live_secretvalue/);
    expect(JSON.stringify(redacted)).not.toMatch(/whsec_abc123/);
    expect(JSON.stringify(redacted)).not.toMatch(/sb_secret_xyz/);
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
  });

  it('redacts signed URL query strings and premium clean-art paths', () => {
    const signed =
      'https://example.supabase.co/storage/v1/object/sign/preview-cache-premium/1/clean.jpg?token=super-secret-token';
    const redacted = redactLogValue({
      previewUrl: signed,
      storagePath: 'preview-cache-premium/1/clean.jpg',
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('preview-cache-premium/1/clean.jpg');
    expect(containsCredentialLeak(signed)).toBe(true);
    expect(containsCredentialLeak(redacted)).toBe(false);
  });

  it('keeps structured error codes for debugging', () => {
    const redacted = redactLogMeta({
      code: 'CLEAN_ART_ACCESS',
      status: 403,
      requestId: 'req_123',
    });
    expect(redacted).toEqual({
      code: 'CLEAN_ART_ACCESS',
      status: 403,
      requestId: 'req_123',
    });
    expect(containsCredentialLeak(redacted)).toBe(false);
  });
});
