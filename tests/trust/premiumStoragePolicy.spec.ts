import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const UNCONSTRAINED_PREMIUM_SELECT =
  /USING\s*\(\s*bucket_id\s*=\s*'preview-cache-premium'\s*\)/i;

describe('clean-art storage policy fixtures', () => {
  it('records the historical unconstrained premium SELECT on main', () => {
    const historical = readRepoFile('supabase/migrations/20251014130010_create_dual_storage_buckets.sql');
    expect(historical).toContain('Authenticated users can read premium previews via signed URLs');
    expect(historical).toMatch(UNCONSTRAINED_PREMIUM_SELECT);
    expect(historical).toMatch(/preview-cache-premium[\s\S]*false/);
  });

  it('drops the unconstrained premium SELECT and does not recreate it', () => {
    const repair = readRepoFile('supabase/migrations/20260903120000_trust_checkpoint_funnel_and_storage.sql');
    expect(repair).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs"'
    );
    expect(repair).not.toMatch(/CREATE POLICY[\s\S]*Authenticated users can read premium previews/);
    expect(repair).toContain('funnel_events');
    expect(repair).toContain('server_checkout_intent_created');
  });

  it('keeps the manual bucket runbook from reopening the hole', () => {
    const runbook = readRepoFile('CREATE_BUCKETS.sql');
    expect(runbook).toContain('DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs"');
    expect(runbook).not.toMatch(/CREATE POLICY[\s\S]*Authenticated users can read premium previews via signed URLs/);
    expect(runbook).toContain('preview-cache-public');
    expect(runbook).toContain('preview-cache-premium');
  });

  it('keeps user-uploads service-role-only in the canonical migration', () => {
    const uploads = readRepoFile('supabase/migrations/20251123120000_create_user_uploads_bucket.sql');
    expect(uploads).toContain("TO service_role");
    expect(uploads).not.toMatch(/TO authenticated[\s\S]*user-uploads/);
  });
});
