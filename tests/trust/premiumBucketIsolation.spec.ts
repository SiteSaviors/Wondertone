import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const AUTHENTICATED_PREMIUM_SELECT =
  /CREATE POLICY\s+"Authenticated users can read premium previews via signed URLs"[\s\S]*?TO authenticated[\s\S]*?bucket_id = 'preview-cache-premium'/i;

const OWNERLESS_AUTHENTICATED_PREMIUM_SELECT =
  /TO authenticated[\s\S]{0,200}USING \(bucket_id = 'preview-cache-premium'\)/i;

describe('premium clean-art bucket isolation', () => {
  const lockMigration = readRepoFile(
    'supabase/migrations/20260903120000_lock_premium_clean_art_bucket.sql'
  );
  const createBuckets = readRepoFile('CREATE_BUCKETS.sql');

  it('forces preview-cache-premium public=false in the lock migration', () => {
    expect(lockMigration).toMatch(
      /UPDATE storage\.buckets\s+SET public = false\s+WHERE id = 'preview-cache-premium'/
    );
    expect(lockMigration).not.toMatch(
      /UPDATE storage\.buckets\s+SET public = true\s+WHERE id = 'preview-cache-premium'/
    );
  });

  it('keeps display previews world-readable', () => {
    expect(lockMigration).toMatch(
      /UPDATE storage\.buckets\s+SET public = true\s+WHERE id = 'preview-cache-public'/
    );
    expect(lockMigration).toMatch(
      /USING \(bucket_id = 'preview-cache-public'\)/
    );
    expect(createBuckets).toMatch(/'preview-cache-public'[\s\S]*true/);
  });

  it('drops the unscoped authenticated premium SELECT', () => {
    expect(lockMigration).toMatch(
      /DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs"/
    );
    expect(lockMigration).not.toMatch(AUTHENTICATED_PREMIUM_SELECT);
    expect(createBuckets).not.toMatch(AUTHENTICATED_PREMIUM_SELECT);
    expect(createBuckets).toMatch(
      /DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs"/
    );
  });

  it('does not reintroduce ownerless authenticated reads of clean art', () => {
    expect(lockMigration).not.toMatch(OWNERLESS_AUTHENTICATED_PREMIUM_SELECT);
    expect(createBuckets).not.toMatch(OWNERLESS_AUTHENTICATED_PREMIUM_SELECT);
    expect(createBuckets).toMatch(/SET public = false/);
    expect(createBuckets).toMatch(/Service role can read premium previews/);
  });

  it('keeps user-uploads private', () => {
    expect(lockMigration).toMatch(
      /UPDATE storage\.buckets\s+SET public = false\s+WHERE id = 'user-uploads'/
    );
    const userUploads = readRepoFile(
      'supabase/migrations/20251123120000_create_user_uploads_bucket.sql'
    );
    expect(userUploads).toMatch(/'user-uploads'[\s\S]{0,80}false/);
  });
});
