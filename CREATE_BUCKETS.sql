-- Run this SQL in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste this → Run
-- TRUST: preview-cache-premium must stay private. Do not restore the
-- unscoped authenticated SELECT. Live apply is a separate operator step.

-- 1. Create public bucket for watermarked / display images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'preview-cache-public',
  'preview-cache-public',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- 2. Create private bucket for clean images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'preview-cache-premium',
  'preview-cache-premium',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 3. Set policies for public bucket (drop if exists, then create)
DROP POLICY IF EXISTS "Public watermarked previews are publicly accessible" ON storage.objects;
CREATE POLICY "Public watermarked previews are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'preview-cache-public');

DROP POLICY IF EXISTS "Service role can upload watermarked previews" ON storage.objects;
CREATE POLICY "Service role can upload watermarked previews"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'preview-cache-public');

DROP POLICY IF EXISTS "Service role can update watermarked previews" ON storage.objects;
CREATE POLICY "Service role can update watermarked previews"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'preview-cache-public');

DROP POLICY IF EXISTS "Service role can delete watermarked previews" ON storage.objects;
CREATE POLICY "Service role can delete watermarked previews"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'preview-cache-public');

-- 4. Set policies for premium bucket (service-role only; signed URLs after auth)
DROP POLICY IF EXISTS "Service role can upload premium previews" ON storage.objects;
CREATE POLICY "Service role can upload premium previews"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'preview-cache-premium');

DROP POLICY IF EXISTS "Service role can update premium previews" ON storage.objects;
CREATE POLICY "Service role can update premium previews"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'preview-cache-premium');

DROP POLICY IF EXISTS "Service role can delete premium previews" ON storage.objects;
CREATE POLICY "Service role can delete premium previews"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'preview-cache-premium');

DROP POLICY IF EXISTS "Service role can read premium previews" ON storage.objects;
CREATE POLICY "Service role can read premium previews"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'preview-cache-premium');

-- Removed: unscoped "Authenticated users can read premium previews via signed URLs"
DROP POLICY IF EXISTS "Authenticated users can read premium previews via signed URLs" ON storage.objects;

-- 5. Verify buckets were created
SELECT id, name, public FROM storage.buckets WHERE id LIKE 'preview-cache%';
