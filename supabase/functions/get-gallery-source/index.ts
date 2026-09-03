import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  buildSignedUrl,
  downloadStorageObject,
  parseStoragePath,
  parseStorageUrl,
  type StorageObjectRef,
} from '../_shared/storageUtils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SOURCE_SIGNED_URL_TTL_SECONDS = clampPositiveInt(
  Deno.env.get('GALLERY_SOURCE_SIGNED_TTL_SECONDS'),
  15 * 60
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SourceRequestBody = {
  previewLogId?: string | null;
  sourceStoragePath?: string | null;
  mode?: 'signed_url' | 'download' | string;
};

const clampString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const clampPositiveInt = (value: string | number | null | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const resolveStorageRef = (value: string | null | undefined): StorageObjectRef | null => {
  if (!value) return null;
  return parseStoragePath(value) ?? parseStorageUrl(value);
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  try {
    const body: SourceRequestBody = await req.json().catch(() => ({}));
    const previewLogId = clampString(body.previewLogId ?? body['preview_log_id'] ?? null);
    const requestedSourcePath = clampString(body.sourceStoragePath ?? body['source_storage_path'] ?? null);
    const modeParam = clampString(body.mode) ?? clampString(url.searchParams.get('mode'));
    const mode = (modeParam ?? 'signed_url').toLowerCase();

    if (!previewLogId && !requestedSourcePath) {
      return new Response(
        JSON.stringify({ error: 'previewLogId or sourceStoragePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token === SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authResult, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authResult.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authResult.user.id;
    let targetStoragePath: string | null = null;
    let resolvedPreviewLogId: string | null = null;

    if (previewLogId) {
      const { data: previewLog, error } = await supabase
        .from('preview_logs')
        .select('id, user_id, source_storage_path')
        .eq('id', previewLogId)
        .maybeSingle();

      if (error) {
        console.error(JSON.stringify({ scope: 'get-gallery-source', message: 'preview_log_lookup_failed' }));
        return new Response(
          JSON.stringify({ error: 'Failed to look up preview log' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!previewLog || previewLog.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Preview log not found', previewLogId }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetStoragePath = previewLog.source_storage_path ?? null;
      resolvedPreviewLogId = previewLog.id;
    }

    if (!targetStoragePath && requestedSourcePath) {
      const normalizedRef = resolveStorageRef(requestedSourcePath);
      if (!normalizedRef) {
        return new Response(
          JSON.stringify({ error: 'Invalid sourceStoragePath' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedPath = `${normalizedRef.bucket}/${normalizedRef.path}`;
      const { data: previewLogByPath, error: pathError } = await supabase
        .from('preview_logs')
        .select('id, user_id, source_storage_path')
        .eq('user_id', userId)
        .eq('source_storage_path', normalizedPath)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pathError) {
        console.error(JSON.stringify({ scope: 'get-gallery-source', message: 'preview_log_path_lookup_failed' }));
        return new Response(
          JSON.stringify({ error: 'Failed to resolve storage path' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!previewLogByPath) {
        return new Response(
          JSON.stringify({ error: 'Source storage path not found', sourceStoragePath: normalizedPath }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetStoragePath = normalizedPath;
      resolvedPreviewLogId = previewLogByPath.id;
    }

    if (!targetStoragePath) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve source image' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storageRef = resolveStorageRef(targetStoragePath);
    if (!storageRef) {
      return new Response(
        JSON.stringify({ error: 'Invalid storage reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'download') {
      try {
        const { buffer, contentType } = await downloadStorageObject(supabase, storageRef);
        return new Response(buffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Length': buffer.byteLength.toString(),
            'Content-Disposition': `inline; filename="${storageRef.path.split('/').pop() ?? 'source.jpg'}"`,
          },
        });
      } catch (_error) {
        console.error(JSON.stringify({ scope: 'get-gallery-source', message: 'download_failed' }));
        return new Response(
          JSON.stringify({ error: 'Failed to download source image' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    try {
      const signedUrl = await buildSignedUrl(supabase, storageRef, SOURCE_SIGNED_URL_TTL_SECONDS);
      if (!signedUrl) {
        return new Response(
          JSON.stringify({ error: 'Failed to create signed URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          signedUrl,
          expiresAt: Date.now() + SOURCE_SIGNED_URL_TTL_SECONDS * 1000,
          storagePath: `${storageRef.bucket}/${storageRef.path}`,
          previewLogId: resolvedPreviewLogId,
          ttlSeconds: SOURCE_SIGNED_URL_TTL_SECONDS,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (_error) {
      console.error(JSON.stringify({ scope: 'get-gallery-source', message: 'signed_url_failed' }));
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (_error) {
    console.error(JSON.stringify({ scope: 'get-gallery-source', message: 'unexpected_error' }));
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
