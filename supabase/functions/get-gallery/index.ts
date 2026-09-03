import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildPublicUrl,
  buildSignedUrl,
  parseStoragePath,
  parseStorageUrl,
  type StorageObjectRef
} from '../_shared/storageUtils.ts';
import { isPrivateStorageBucket } from '../_shared/ownerScopedStorage.ts';
import { toPublicDisplayRef } from '../_shared/displayPreview.ts';
import { createSafeLogger, safeErrorMessage } from '../_shared/safeLogger.ts';

const logger = createSafeLogger('get-gallery');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SOURCE_SIGNED_URL_TTL_SECONDS = clampPositiveInt(Deno.env.get('GALLERY_SOURCE_SIGNED_TTL_SECONDS'), 15 * 60);

interface GalleryItem {
  id: string;
  userId: string | null;
  previewLogId: string | null;
  styleId: string;
  styleName: string;
  orientation: string;
  watermarkedUrl: string;
  cleanUrl: string | null;
  thumbnailStoragePath: string | null;
  sourceStoragePath: string | null;
  sourceDisplayUrl: string | null;
  sourceSignedUrl: string | null;
  sourceSignedUrlExpiresAt: number | null;
  cropConfig: Record<string, unknown> | null;
  isFavorited: boolean;
  isDeleted: boolean;
  downloadCount: number;
  lastDownloadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
};

function clampPositiveInt(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const buildDisplayUrl = (
  storageRef: StorageObjectRef
): string => {
  const displayRef = toPublicDisplayRef(storageRef.bucket, storageRef.path);
  return buildPublicUrl(displayRef);
};

const resolveStorageRef = (value: string | null | undefined): StorageObjectRef | null => {
  if (!value) return null;
  return parseStoragePath(value) ?? parseStorageUrl(value);
};

export const createSignedSource = async (
  supabase: ReturnType<typeof createClient>,
  storagePath: string | null | undefined
): Promise<{ signedUrl: string | null; expiresAt: number | null }> => {
  if (!storagePath) {
    return { signedUrl: null, expiresAt: null };
  }
  const ref = parseStoragePath(storagePath);
  if (!ref) {
    logger.warn('Unable to parse source storage path for signed URL');
    return { signedUrl: null, expiresAt: null };
  }
  try {
    const signed = await buildSignedUrl(supabase, ref, SOURCE_SIGNED_URL_TTL_SECONDS);
    if (!signed) {
      logger.warn('Signed URL generation returned null');
      return { signedUrl: null, expiresAt: null };
    }
    return {
      signedUrl: signed,
      expiresAt: Date.now() + SOURCE_SIGNED_URL_TTL_SECONDS * 1000,
    };
  } catch (error) {
    logger.error('Failed to create signed URL for source', { message: safeErrorMessage(error) });
    return { signedUrl: null, expiresAt: null };
  }
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
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

    if (!token || token === SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    let requiresWatermark = true;
    if (userId) {
      const { data: entitlementRow } = await supabase
        .from('v_entitlements')
        .select('tier, dev_override')
        .eq('user_id', userId)
        .maybeSingle();

      const tier = (entitlementRow?.tier ?? 'free').toString().toLowerCase();
      const devOverride = Boolean(entitlementRow?.dev_override);
      requiresWatermark = !(devOverride || tier === 'creator' || tier === 'plus' || tier === 'pro');
    }

    // GET: Fetch gallery items
    if (req.method === 'GET') {
      const itemIdParam = url.searchParams.get('id');
      const downloadRequested = url.searchParams.get('download') === 'true';

      if (itemIdParam) {
        const { data: itemRow, error: itemError } = await supabase
          .from('user_gallery')
          .select('*, preview_logs!left(source_storage_path, source_display_url, crop_config)')
          .eq('is_deleted', false)
          .eq('user_id', userId)
          .eq('id', itemIdParam)
          .maybeSingle();

        if (itemError) {
          logger.error('Single item fetch error');
          return new Response(
            JSON.stringify({ error: 'Failed to fetch gallery item' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!itemRow) {
          return new Response(
            JSON.stringify({ error: 'Gallery item not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const storageRef =
          resolveStorageRef(itemRow.clean_url) ??
          resolveStorageRef(itemRow.watermarked_url);

        if (!storageRef) {
          return new Response(
            JSON.stringify({ error: 'Gallery item is missing a valid storage reference' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (downloadRequested) {
          return new Response(
            JSON.stringify({ error: 'entitlement_required', sku: 'revealed_artwork_full_res' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const displayUrl = buildDisplayUrl(storageRef);
        const thumbnailRef = itemRow.thumbnail_storage_path
          ? parseStoragePath(itemRow.thumbnail_storage_path)
          : null;
        const thumbnailUrl = thumbnailRef ? buildPublicUrl(thumbnailRef) : null;
        const previewLog = itemRow.preview_logs as
          | { source_storage_path: string | null; source_display_url: string | null; crop_config: Record<string, unknown> | null }
          | null
          | undefined;

        const sourceMeta = await createSignedSource(supabase, previewLog?.source_storage_path ?? null);

        const singlePayload = {
          item: {
            id: itemRow.id,
            styleId: itemRow.style_id,
            styleName: itemRow.style_name,
            orientation: itemRow.orientation,
            imageUrl: isPrivateStorageBucket(storageRef.bucket) ? displayUrl : buildPublicUrl(storageRef),
            displayUrl,
            storagePath: `${storageRef.bucket}/${storageRef.path}`,
            thumbnailUrl,
            thumbnailStoragePath: itemRow.thumbnail_storage_path ?? null,
            sourceStoragePath: previewLog?.source_storage_path ?? null,
            sourceDisplayUrl: previewLog?.source_display_url ?? null,
            sourceSignedUrl: sourceMeta.signedUrl,
            sourceSignedUrlExpiresAt: sourceMeta.expiresAt,
            cropConfig: previewLog?.crop_config ?? null,
            isFavorited: itemRow.is_favorited,
            isDeleted: itemRow.is_deleted,
            downloadCount: itemRow.download_count,
            lastDownloadedAt: itemRow.last_downloaded_at,
            createdAt: itemRow.created_at,
            updatedAt: itemRow.updated_at
          },
          requiresWatermark
        };

        return new Response(
          JSON.stringify(singlePayload),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse query parameters
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const styleFilter = url.searchParams.get('style') || null;
      const orientationFilter = url.searchParams.get('orientation') || null;
      const favoritesOnly = url.searchParams.get('favorites') === 'true';
      const sortBy = url.searchParams.get('sort') || 'newest'; // newest, oldest, downloads

      // Build query
      let query = supabase
        .from('user_gallery')
        .select('*, preview_logs!left(source_storage_path, source_display_url, crop_config)', { count: 'exact' })
        .eq('is_deleted', false)
        .eq('user_id', userId);

      if (styleFilter) {
        query = query.eq('style_id', styleFilter);
      }

      if (orientationFilter && ['horizontal', 'vertical', 'square'].includes(orientationFilter)) {
        query = query.eq('orientation', orientationFilter);
      }

      if (favoritesOnly) {
        query = query.eq('is_favorited', true);
      }

      // Apply sorting
      if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (sortBy === 'downloads') {
        query = query.order('download_count', { ascending: false });
      } else {
        // Default: newest first
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: items, error: fetchError, count } = await query;

      if (fetchError) {
        logger.error('Fetch error');
        return new Response(
          JSON.stringify({ error: 'Failed to fetch gallery items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform to camelCase
      const galleryItems: GalleryItem[] = (items || []).map((item: Record<string, unknown>) => {
        const previewLog = item.preview_logs as
          | { source_storage_path: string | null; source_display_url: string | null; crop_config: Record<string, unknown> | null }
          | null
          | undefined;

        return {
          id: item.id as string,
          userId: (item.user_id ?? null) as string | null,
          previewLogId: (item.preview_log_id ?? null) as string | null,
          styleId: item.style_id as string,
          styleName: item.style_name as string,
          orientation: item.orientation as string,
          watermarkedUrl: item.watermarked_url as string,
          cleanUrl: (item.clean_url ?? null) as string | null,
          thumbnailStoragePath: (item.thumbnail_storage_path ?? null) as string | null,
          sourceStoragePath: previewLog?.source_storage_path ?? null,
          sourceDisplayUrl: previewLog?.source_display_url ?? null,
          sourceSignedUrl: null,
          sourceSignedUrlExpiresAt: null,
          cropConfig: previewLog?.crop_config ?? null,
          isFavorited: Boolean(item.is_favorited),
          isDeleted: Boolean(item.is_deleted),
          downloadCount: Number(item.download_count ?? 0),
          lastDownloadedAt: (item.last_downloaded_at ?? null) as string | null,
          createdAt: item.created_at as string,
          updatedAt: item.updated_at as string,
        };
      });

      const resolvedItems = (
        await Promise.all(
          galleryItems.map(async (item) => {
            const storageRef =
              resolveStorageRef(item.cleanUrl) ??
              resolveStorageRef(item.watermarkedUrl);

            if (!storageRef) {
              logger.warn('Skipping item with invalid storage reference');
              return null;
            }

            let displayUrl: string;
            try {
              displayUrl = buildDisplayUrl(storageRef);
            } catch {
              logger.warn('Skipping item that could not be presented safely');
              return null;
            }
            const imageUrl = isPrivateStorageBucket(storageRef.bucket)
              ? displayUrl
              : buildPublicUrl(storageRef);
            const thumbnailRef = item.thumbnailStoragePath
              ? parseStoragePath(item.thumbnailStoragePath)
              : null;
            const thumbnailUrl = thumbnailRef ? buildPublicUrl(thumbnailRef) : null;
            const sourceMeta = await createSignedSource(supabase, item.sourceStoragePath);

            return {
              id: item.id,
              userId: item.userId,
              previewLogId: item.previewLogId,
              styleId: item.styleId,
              styleName: item.styleName,
              orientation: item.orientation,
              imageUrl,
              displayUrl,
              storagePath: `${storageRef.bucket}/${storageRef.path}`,
              thumbnailUrl,
              thumbnailStoragePath: item.thumbnailStoragePath ?? null,
              sourceStoragePath: item.sourceStoragePath ?? null,
              sourceDisplayUrl: item.sourceDisplayUrl ?? null,
              sourceSignedUrl: sourceMeta.signedUrl,
              sourceSignedUrlExpiresAt: sourceMeta.expiresAt,
              cropConfig: item.cropConfig ?? null,
              isFavorited: item.isFavorited,
              isDeleted: item.isDeleted,
              downloadCount: item.downloadCount,
              lastDownloadedAt: item.lastDownloadedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt
            };
          })
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      const responsePayload = {
        items: resolvedItems,
        total: count || 0,
        limit,
        offset,
      };

      return new Response(
        JSON.stringify({
          ...responsePayload,
          requiresWatermark
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE: Delete a gallery item (soft delete)
    if (req.method === 'DELETE') {
      const itemId = url.searchParams.get('id');
      if (!itemId) {
        return new Response(
          JSON.stringify({ error: 'Missing gallery item ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify ownership and soft delete
      const { error: deleteError } = await supabase
        .from('user_gallery')
        .update({ is_deleted: true })
        .eq('id', itemId)
        .eq('user_id', userId);

      if (deleteError) {
        logger.error('Delete error');
        return new Response(
          JSON.stringify({ error: 'Failed to delete gallery item' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message: 'Gallery item deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PATCH: Update gallery item (favorite toggle, download tracking)
    if (req.method === 'PATCH') {
      const itemId = url.searchParams.get('id');
      if (!itemId) {
        return new Response(
          JSON.stringify({ error: 'Missing gallery item ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();
      const updates: Record<string, unknown> = {};

      if (typeof body.isFavorited === 'boolean') {
        updates.is_favorited = body.isFavorited;
      }

      if (body.incrementDownload === true) {
        // Fetch current download count and increment
        const { data: current } = await supabase
          .from('user_gallery')
          .select('download_count')
          .eq('id', itemId)
          .eq('user_id', userId)
          .single();

        if (current) {
          updates.download_count = ((current as Record<string, number>).download_count || 0) + 1;
          updates.last_downloaded_at = new Date().toISOString();
        }
      }

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid updates provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Apply update
      const { data: updated, error: updateError } = await supabase
        .from('user_gallery')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        logger.error('Update error');
        return new Response(
          JSON.stringify({ error: 'Failed to update gallery item' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          message: 'Gallery item updated successfully',
          item: {
            id: updated.id,
            isFavorited: updated.is_favorited,
            downloadCount: updated.download_count,
            lastDownloadedAt: updated.last_downloaded_at,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
