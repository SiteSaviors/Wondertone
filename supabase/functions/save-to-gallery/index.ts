import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildPublicUrl,
  ensureObjectExists,
  parseStoragePath,
  downloadStorageObject,
  type StorageObjectRef
} from '../_shared/storageUtils.ts';
import { formatStoragePath, isPrivateStorageBucket } from '../_shared/ownerScopedStorage.ts';
import { createSafeLogger, safeErrorMessage } from '../_shared/safeLogger.ts';

const logger = createSafeLogger('save-to-gallery');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SaveToGalleryRequest {
  previewLogId?: string;
  styleId: string;
  styleName: string;
  orientation: 'horizontal' | 'vertical' | 'square';
  storagePath: string;
}

const THUMBNAIL_BUCKET = Deno.env.get('GALLERY_THUMBNAIL_BUCKET') ?? 'preview-cache-public';
const THUMBNAIL_PREFIX = Deno.env.get('GALLERY_THUMBNAIL_PREFIX') ?? 'thumbnails';
const THUMBNAIL_MAX_DIMENSION = Number.isFinite(Number(Deno.env.get('GALLERY_THUMBNAIL_MAX_DIMENSION')))
  ? Math.max(64, Number(Deno.env.get('GALLERY_THUMBNAIL_MAX_DIMENSION')))
  : 200;

type ThumbnailResult = {
  storagePath: string;
  publicUrl: string;
};

type PreviewLogRecord = {
  id: string;
  user_id: string | null;
  source_storage_path: string | null;
  source_display_url: string | null;
  crop_config: Record<string, unknown> | null;
};

type SupabaseClientLike = ReturnType<typeof createClient>;

export const ensurePreviewLogForGallery = async (
  supabase: SupabaseClientLike,
  previewLogId: string,
  userId: string
): Promise<
  | { ok: true; record: PreviewLogRecord }
  | { ok: false; status: number; error: string }
> => {
  const { data, error } = await supabase
    .from('preview_logs')
    .select('id, user_id, source_storage_path, source_display_url, crop_config')
    .eq('id', previewLogId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load preview log', { message: safeErrorMessage(error) });
    return { ok: false, status: 500, error: 'Preview log lookup failed' };
  }

  if (!data) {
    logger.warn('Preview log not found');
    return { ok: false, status: 404, error: 'Preview log not found' };
  }

  if (data.user_id !== userId) {
    logger.warn('Preview log ownership mismatch');
    return { ok: false, status: 403, error: 'Preview log ownership mismatch' };
  }

  if (!data.source_storage_path) {
    logger.error('Preview log missing source metadata');
    return { ok: false, status: 500, error: 'Preview log missing source metadata' };
  }

  return { ok: true, record: data as PreviewLogRecord };
};

const generateThumbnail = async (
  supabase: ReturnType<typeof createClient>,
  source: StorageObjectRef
): Promise<ThumbnailResult | null> => {
  try {
    const { buffer } = await downloadStorageObject(supabase, source);
    const { Image } = await import('https://deno.land/x/imagescript@1.2.15/mod.ts');
    const image = await Image.decode(new Uint8Array(buffer));

    const width = Math.max(1, image.width);
    const height = Math.max(1, image.height);
    const maxDimension = Math.max(64, THUMBNAIL_MAX_DIMENSION);
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const resized = image.resize(targetWidth, targetHeight);
    const encoded = await resized.encodeJPEG(85);

    const objectPath = `${THUMBNAIL_PREFIX}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(objectPath, encoded, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const storagePath = `${THUMBNAIL_BUCKET}/${objectPath}`;
    const publicUrl = buildPublicUrl({ bucket: THUMBNAIL_BUCKET, path: objectPath });
    return { storagePath, publicUrl };
  } catch (error) {
    logger.error('Thumbnail generation failed', { message: safeErrorMessage(error) });
    return null;
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: SaveToGalleryRequest = await req.json();
    const { previewLogId, styleId, styleName, orientation, storagePath } = body;

    if (!previewLogId) {
      logger.warn('Missing previewLogId');
      return new Response(
        JSON.stringify({ error: 'previewLogId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!styleId || !styleName || !orientation || !storagePath) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: styleId, styleName, orientation, storagePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate orientation
    if (!['horizontal', 'vertical', 'square'].includes(orientation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid orientation. Must be: horizontal, vertical, or square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storageRef: StorageObjectRef | null = parseStoragePath(storagePath);
    if (!storageRef) {
      return new Response(
        JSON.stringify({ error: 'Invalid storage path supplied' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from headers
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Determine user identity
    let userId: string | null = null;

    if (token && token !== SUPABASE_SERVICE_ROLE_KEY) {
      // Authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Authentication required to save to gallery' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!(await ensureObjectExists(supabase, storageRef))) {
      return new Response(
        JSON.stringify({ error: 'Storage object not found or not accessible' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previewLogCheck = await ensurePreviewLogForGallery(supabase, previewLogId, userId);
    if (!previewLogCheck.ok) {
      return new Response(
        JSON.stringify({ error: previewLogCheck.error }),
        { status: previewLogCheck.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const previewLog = previewLogCheck.record;
    logger.info('Preview log validated', { hasSource: Boolean(previewLog.source_storage_path) });

    const publicUrl = isPrivateStorageBucket(storageRef.bucket)
      ? formatStoragePath(storageRef)
      : buildPublicUrl(storageRef);
    const cleanUrl = isPrivateStorageBucket(storageRef.bucket) ? formatStoragePath(storageRef) : null;

    // Check if this preview is already saved
    const { data: existing, error: checkError } = await supabase
      .from('user_gallery')
      .select('id, thumbnail_storage_path')
      .eq('is_deleted', false)
      .eq('user_id', userId)
      .eq('style_id', styleId)
      .eq('orientation', orientation)
      .eq('watermarked_url', publicUrl)
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking existing');
      return new Response(
        JSON.stringify({ error: 'Failed to check existing gallery item' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existing) {
      const existingThumbRef = existing.thumbnail_storage_path
        ? parseStoragePath(existing.thumbnail_storage_path as string)
        : null;
      const existingThumbnailUrl = existingThumbRef ? buildPublicUrl(existingThumbRef) : null;
      return new Response(
        JSON.stringify({
          message: 'Preview already saved to gallery',
          galleryItemId: existing.id,
          alreadyExists: true,
          thumbnailUrl: existingThumbnailUrl ?? null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const thumbnailResult = await generateThumbnail(supabase, storageRef);

    // Insert into gallery
    const { data: galleryItem, error: insertError } = await supabase
      .from('user_gallery')
      .insert({
        user_id: userId,
        preview_log_id: previewLogId,
        style_id: styleId,
        style_name: styleName,
        orientation,
        watermarked_url: publicUrl,
        clean_url: cleanUrl,
        thumbnail_storage_path: thumbnailResult?.storagePath ?? null,
        is_favorited: false,
        is_deleted: false,
        download_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Insert error');
      return new Response(
        JSON.stringify({ error: 'Failed to save to gallery' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        message: 'Successfully saved to gallery',
        galleryItemId: galleryItem.id,
        galleryItem: {
          id: galleryItem.id,
          styleId: galleryItem.style_id,
          styleName: galleryItem.style_name,
          orientation: galleryItem.orientation,
          imageUrl: galleryItem.watermarked_url,
          storagePath: `${storageRef.bucket}/${storageRef.path}`,
          createdAt: galleryItem.created_at,
          thumbnailUrl: thumbnailResult?.publicUrl ?? null,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Unexpected error', { message: safeErrorMessage(error) });
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
