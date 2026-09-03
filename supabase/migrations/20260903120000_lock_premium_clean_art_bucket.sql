-- TRUST ONLY / git-only.
-- Forces preview-cache-premium private and drops the unscoped authenticated SELECT.
-- This file is NOT applied to live Supabase by this PR.

-- 1. Force clean-art bucket private (ON CONFLICT DO NOTHING in earlier
--    migrations cannot flip a bucket that was created public).
UPDATE storage.buckets
SET public = false
WHERE id = 'preview-cache-premium';

-- 2. Display / watermarked previews stay world-readable.
UPDATE storage.buckets
SET public = true
WHERE id = 'preview-cache-public';

-- 3. Canonical uploads stay private.
UPDATE storage.buckets
SET public = false
WHERE id = 'user-uploads';

-- 4. Drop the leak: any authenticated user could SELECT every clean object.
DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs"
  ON storage.objects;

-- 5. Service-role-only reads for premium objects. Edge functions mint
--    short-lived signed URLs after authorization. Do not add an
--    unscoped authenticated SELECT back.
DROP POLICY IF EXISTS "Service role can read premium previews"
  ON storage.objects;

CREATE POLICY "Service role can read premium previews"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'preview-cache-premium');

-- 6. Keep display-bucket public read (idempotent).
DROP POLICY IF EXISTS "Public watermarked previews are publicly accessible"
  ON storage.objects;

CREATE POLICY "Public watermarked previews are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'preview-cache-public');
