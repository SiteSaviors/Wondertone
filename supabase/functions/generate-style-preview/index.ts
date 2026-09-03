import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { StylePromptService, type StylePromptMetadata } from './stylePromptService.ts';
import { handleCorsPreflightRequest, createCorsResponse } from './corsUtils.ts';
import { validateRequest } from './requestValidator.ts';
import { ReplicateService } from './replicateService.ts';
import { validateEnvironment } from './environmentValidator.ts';
import { createSuccessResponse, createErrorResponse } from './responseUtils.ts';
import {
  getPromptCacheConfig,
  getCachedPrompt,
  setCachedPrompt,
  schedulePromptWarmup,
  type PromptWarmupResult
} from './promptCache.ts';
import { CacheMetadataService, type CacheMetadataRecord } from './cache/cacheMetadataService.ts';
import { PreviewStorageClient } from './cache/storageClient.ts';
import { createImageDigest, buildCacheKey } from './cache/cacheKey.ts';
import { LruMemoryCache } from './cache/memoryCache.ts';
import { createRequestLogger } from './logging.ts';
import type { CacheStatus } from './types.ts';
import { resolveEntitlements, computeRemainingAfterDebet, type EntitlementContext } from './entitlements.ts';
import {
  downloadStorageObject,
  parseStoragePath,
  parseStorageUrl,
  buildPublicUrl,
  type StorageObjectRef
} from '../_shared/storageUtils.ts';
import { isPrivateStorageBucket } from '../_shared/ownerScopedStorage.ts';
import { safeErrorMessage } from '../_shared/safeLogger.ts';
import { createDisplayPreview, toPublicDisplayRef } from '../_shared/displayPreview.ts';
import { recordGenerationCostEvent } from '../_shared/generationCost.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW_DEBUG_LOGS = Deno.env.get('WT_PREVIEW_DEBUG_LOGS') === 'true';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const cacheEnabledGlobally = (Deno.env.get('PREVIEW_CACHE_ENABLED') ?? 'true').toLowerCase() !== 'false';
const ttlDays = parsePositiveInt(Deno.env.get('PREVIEW_CACHE_TTL_DAYS'), 30);
const ttlMs = ttlDays * ONE_DAY_MS;
const memoryCapacity = parsePositiveInt(Deno.env.get('PREVIEW_CACHE_MAX_MEMORY_ITEMS'), 256);
const cacheBucket = Deno.env.get('PREVIEW_CACHE_BUCKET') ?? 'preview-cache';
const requireAuthForPreviewFlag = (Deno.env.get('REQUIRE_AUTH_FOR_PREVIEW') ?? 'false').toLowerCase() === 'true';
const asyncEnabled = (Deno.env.get('PREVIEW_ASYNC_ENABLED') ?? 'false').toLowerCase() === 'true';
const webhookBaseUrl = Deno.env.get('PREVIEW_WEBHOOK_BASE_URL');
const webhookSecret = Deno.env.get('PREVIEW_WEBHOOK_SECRET');

const memoryCache = new LruMemoryCache<string>(memoryCapacity);

const entitlementsFlag = (Deno.env.get('WT_FLAG_ENTITLEMENTS_V1') ?? 'true').toLowerCase() === 'true';

const parseDevBypassEmails = (): Set<string> => {
  const raw = Deno.env.get('WT_DEV_BYPASS_EMAILS');
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((value) => String(value).toLowerCase()));
    }
  } catch (error) {
    console.warn('[entitlements] Failed to parse WT_DEV_BYPASS_EMAILS', error);
  }
  return new Set();
};

const devBypassEmails = parseDevBypassEmails();

const cloneJson = <T>(value: T): T => {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return value;
  }
};

const initializeWarmup = (() => {
  let initialized = false;
  return (stylePromptService: StylePromptService) => {
    if (initialized) return;
    initialized = true;

    const config = getPromptCacheConfig();
    if (!config.enabled) {
      return;
    }

    schedulePromptWarmup(async (styleName): Promise<PromptWarmupResult | null> => {
      const metadata = await stylePromptService.getStylePromptWithMetadata(styleName);
      if (!metadata || !metadata.prompt) {
        return metadata ? { ...metadata, prompt: metadata.prompt ?? null } : null;
      }
      return {
        prompt: metadata.prompt,
        styleId: metadata.styleId,
        styleVersion: metadata.styleVersion
      };
    });
  };
})();

const extractBearerToken = (headerValue?: string | null): string | null => {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;
  const [scheme, token] = trimmed.split(' ');
  if (token && /^Bearer$/i.test(scheme)) {
    return token;
  }
  return trimmed;
};

type NormalizeContext = {
  requestId?: string;
  sourceStoragePath?: string | null;
};

async function normalizeImageInput(
  image: string,
  supabase: ReturnType<typeof createClient>,
  context?: NormalizeContext
): Promise<string> {
  if (image.startsWith('data:image/')) {
    return image;
  }

  const storageRef: StorageObjectRef | null =
    parseStorageUrl(image) ?? parseStoragePath(image);

  if (!storageRef) {
    throw new Error(`Only Wondertone storage paths are allowed. Received: ${image.substring(0, 50)}...`);
  }

  try {
    const { buffer, contentType } = await downloadStorageObject(supabase, storageRef);

    // Prevent stack overflow from huge images
    if (buffer.byteLength > 50 * 1024 * 1024) {  // 50MB limit
      throw new Error(`Image too large: ${buffer.byteLength} bytes`);
    }

    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mime = contentType && contentType.length > 0 ? contentType : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.error(JSON.stringify({
      message: 'Failed to normalize image input',
      bucket: storageRef.bucket,
      error: safeErrorMessage(error),
    }));
    if (PREVIEW_DEBUG_LOGS) {
      console.log(JSON.stringify({
        message: 'normalize_failure',
        requestId: context?.requestId ?? null,
        bucket: storageRef.bucket,
        error: safeErrorMessage(error),
      }));
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function buildFallbackPrompt(style: string): string {
  return `Transform this image into ${style} style while keeping the exact same subject, composition, and scene. Apply only the artistic style transformation. Do not change what is depicted in the image - only change how it looks artistically.`;
}

const isExpired = (isoDate: string): boolean => {
  const expiresAt = Date.parse(isoDate);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
};

const computeStoragePath = (styleId: number, aspectRatio: string, quality: string, imageDigest: string): string => {
  const sanitizedAspect = aspectRatio.toLowerCase();
  const sanitizedQuality = quality.toLowerCase();
  return `${styleId}/${sanitizedQuality}/${sanitizedAspect}/${imageDigest}.jpg`;
};

async function handleWebhookRequest(req: Request, url: URL, origin: string | null): Promise<Response> {
  if (!webhookSecret) {
    return createCorsResponse(JSON.stringify({ ok: false, error: 'webhook_not_configured' }), 500, origin ?? undefined);
  }

  const token = url.searchParams.get('token');
  if (token !== webhookSecret) {
    return createCorsResponse(JSON.stringify({ ok: false, error: 'unauthorized' }), 401, origin ?? undefined);
  }

  try {
    const body = await req.json();
    const status = body?.status as string | undefined ?? 'unknown';
    const predictionId = body?.id as string | undefined;
    const input = body?.input ?? {};
    const requestId = input?.request_id as string | undefined;
    const webhookLogger = createRequestLogger((requestId ?? predictionId ?? 'webhook').toString());
    let output = body?.output as string | string[] | undefined;
    if (Array.isArray(output)) {
      output = output[0];
    }
    const _errorMsg = body?.error as string | undefined;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return createCorsResponse(JSON.stringify({ ok: false, error: 'configuration_error' }), 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const cacheMetadataService = new CacheMetadataService(supabase);
    const storageClient = new PreviewStorageClient(supabase, cacheBucket);

    const identifierColumn = requestId ? 'request_id' : 'prediction_id';
    const identifier = requestId ?? predictionId;

    if (!identifier) {
      return createCorsResponse(JSON.stringify({ ok: false, error: 'missing_request' }), 400, origin ?? undefined);
    }

    const { data: statusRow, error: statusError } = await supabase
      .from('previews_status')
      .select('*')
      .eq(identifierColumn, identifier)
      .single();

    if (statusError || !statusRow) {
      return createCorsResponse(JSON.stringify({ ok: false, error: 'status_not_found' }), 404, origin ?? undefined);
    }

    let previewUrl: string | null = statusRow.preview_url ?? null;
    let cacheStatus: CacheStatus = 'miss';

    if (status === 'succeeded' && output) {
      try {
        const imageDigest = statusRow.image_digest as string | null;
        const styleId = statusRow.style_id as number | null;
        const styleVersion = statusRow.style_version as string | null;
        const aspectRatio = statusRow.aspect_ratio as string | null;
        const quality = statusRow.quality as string | null;
        const watermark = statusRow.watermark as boolean | null;
        const cacheAllowed = (statusRow.cache_allowed as boolean | null) ?? true;

        if (cacheAllowed && imageDigest && styleId && styleVersion && aspectRatio && quality) {
          const cacheTierForAsync = (statusRow.tier as string | null) ?? 'free';
          const cacheKey = buildCacheKey({
            imageDigest,
            styleId,
            styleVersion,
            aspectRatio,
            quality,
            watermark: false, // Always false - watermarks applied on-demand
            tier: cacheTierForAsync
          });

          const storagePath = computeStoragePath(styleId, aspectRatio, quality, imageDigest);

          // OPUS PLAN: Store clean output only, no pre-watermarking
          const uploadResult = await storageClient.uploadFromUrl(output, storagePath, {}, false);
          previewUrl = uploadResult.publicUrl;

          await cacheMetadataService.upsert({
            cacheKey,
            styleId,
            styleVersion,
            imageDigest,
            aspectRatio,
            quality,
            watermark: false, // Always false - watermarks applied on-demand
            storagePath: uploadResult.storagePath,
            previewUrl: uploadResult.publicUrl,
            ttlExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
            sourceRequestId: statusRow.request_id as string,
            createdByUserId: (statusRow.user_id as string | null) ?? null,
            tier: cacheTierForAsync
          });

          memoryCache.set(cacheKey, uploadResult.publicUrl, ttlMs);
          cacheStatus = 'hit';

          webhookLogger.info('Clean preview cached from webhook (watermark will be applied on-the-fly)', {
            requestId: statusRow.request_id,
            storagePath,
            requiresWatermark: watermark
          });
        } else {
          // Cache bypass: return clean output (watermark will be applied on-the-fly)
          previewUrl = typeof output === 'string' ? output : null;
          cacheStatus = 'bypass';
        }
      } catch (cacheError) {
        webhookLogger.warn('Failed to persist cached preview from webhook', {
          requestId: statusRow.request_id,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError)
        });
      }
    }

    const upsertPayload = {
      request_id: statusRow.request_id,
      prediction_id: predictionId ?? statusRow.prediction_id,
      status,
      preview_url: previewUrl,
      error: errorMsg ?? null,
      image_digest: statusRow.image_digest,
      style_id: statusRow.style_id,
      style_version: statusRow.style_version,
      aspect_ratio: statusRow.aspect_ratio,
      quality: statusRow.quality,
      watermark: statusRow.watermark,
      cache_allowed: statusRow.cache_allowed,
      created_at: statusRow.created_at,
      updated_at: new Date().toISOString()
    };

    await supabase.from('previews_status').upsert(upsertPayload, { onConflict: 'request_id' });

    webhookLogger.info('Processed preview webhook callback', {
      requestId: statusRow.request_id,
      predictionId: predictionId ?? statusRow.prediction_id,
      status,
      cacheStatus,
      hasPreview: Boolean(previewUrl)
    });

    return createCorsResponse(JSON.stringify({ ok: true, cacheStatus }), 200, origin ?? undefined);
  } catch (error) {
    console.error('Webhook handling failed', error);
    return createCorsResponse(JSON.stringify({ ok: false, error: 'webhook_error' }), 500, origin ?? undefined);
  }
}

async function handleStatusRequest(url: URL, origin: string | null): Promise<Response> {
  const requestId = url.searchParams.get('requestId');
  if (!requestId) {
    return createCorsResponse(JSON.stringify({ error: 'missing_requestId' }), 400, origin ?? undefined);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return createCorsResponse(JSON.stringify({ error: 'configuration_error' }), 500, origin ?? undefined);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('previews_status')
    .select('request_id,status,preview_url,error,prediction_id,updated_at')
    .eq('request_id', requestId)
    .single();

  if (error || !data) {
    return createCorsResponse(JSON.stringify({ error: 'not_found' }), 404, origin ?? undefined);
  }

  return createCorsResponse(JSON.stringify(data), 200, origin ?? undefined);
}

serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const originHeader = req.headers.get('origin');
  const respond = (body: string, status = 200) =>
    createCorsResponse(body, status, originHeader ?? undefined);

  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(originHeader ?? undefined);
  }

  if (req.method === 'POST' && pathname.endsWith('/webhook')) {
    return handleWebhookRequest(req, url, originHeader);
  }

  if (req.method === 'GET' && pathname.endsWith('/status')) {
    return handleStatusRequest(url, originHeader);
  }

  if (req.method !== 'POST') {
    return respond(
      JSON.stringify(createErrorResponse('method_not_allowed', 'Method not allowed')),
      405
    );
  }

  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const logger = createRequestLogger(requestId);
  logger.debug('Feature flags snapshot', {
    requireAuthForPreview: requireAuthForPreviewFlag
  });

  try {
    const body = await req.json();
    const validation = validateRequest(body);

    if (!validation.isValid) {
      logger.warn('Request validation failed', { error: validation.error });
      return respond(
        JSON.stringify(createErrorResponse('invalid_request', validation.error!)),
        400
      );
    }

    const {
      imageUrl,
      style,
      aspectRatio,
      quality,
      watermark = true,
      cacheBypass = false,
      sourceStoragePath: requestSourceStoragePath = null,
      sourceDisplayUrl: requestSourceDisplayUrl = null,
      cropConfig: requestCropConfig = null
    } = validation.data!;

    const normalizedAspectRatio = aspectRatio.toLowerCase();
    const normalizedQuality = quality.toLowerCase();

    const sanitizeStorageRef = (value: string | null): StorageObjectRef | null => {
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return null;
      }
      return parseStoragePath(value) ?? parseStorageUrl(value);
    };

    const requestedSourceRef = sanitizeStorageRef(requestSourceStoragePath);
    if (requestSourceStoragePath && !requestedSourceRef) {
      logger.warn('Invalid sourceStoragePath provided; ignoring value', {
        requestId,
        provided: requestSourceStoragePath
      });
    }
    let sourceStoragePath: string | null = requestSourceStoragePath && requestedSourceRef
      ? `${requestedSourceRef.bucket}/${requestedSourceRef.path}`
      : null;

    let sourceDisplayUrl: string | null =
      typeof requestSourceDisplayUrl === 'string' && requestSourceDisplayUrl.trim().length > 0
        ? requestSourceDisplayUrl
        : null;

    if (requestedSourceRef && !sourceDisplayUrl) {
      sourceDisplayUrl = buildPublicUrl(requestedSourceRef);
    }

    const imageSourceRef = sanitizeStorageRef(imageUrl);
    if (!sourceStoragePath && imageSourceRef) {
      sourceStoragePath = `${imageSourceRef.bucket}/${imageSourceRef.path}`;
      if (!sourceDisplayUrl) {
        sourceDisplayUrl = buildPublicUrl(imageSourceRef);
      }
    }

    let cropConfig =
      requestCropConfig && typeof requestCropConfig === 'object'
        ? cloneJson(requestCropConfig as Record<string, unknown>)
        : null;

    // Telemetry: Track input type for monitoring
    const inputScheme = imageUrl.startsWith('data:') ? 'data-uri' :
                       imageUrl.startsWith('http') ? 'http-url' : 'unknown';
    logger.info('Request received', {
      requestId,
      inputScheme,
      inputLength: imageUrl.length,
      style,
      aspectRatio: normalizedAspectRatio,
      quality: normalizedQuality
    });

    const envValidation = await validateEnvironment(req, requestId, originHeader);
    if (!envValidation.isValid || !envValidation.replicateApiToken) {
      logger.error('Environment validation failed');
      return envValidation.error ?? respond(
        JSON.stringify(createErrorResponse('configuration_error', 'AI service configuration error', requestId)),
        500
      );
    }

    const replicateApiToken = envValidation.replicateApiToken;
    const openAiFallbackKey = envValidation.openaiApiKey ?? '';
    const fallbackEnabled = Boolean(openAiFallbackKey && openAiFallbackKey.length > 0);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Missing required environment configuration');
      return respond(
        JSON.stringify(createErrorResponse('configuration_error', 'AI service configuration error', requestId)),
        500
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authorizationHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const idempotencyKey = req.headers.get('x-idempotency-key') ?? req.headers.get('X-Idempotency-Key');

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? null;
    const bearerToken = extractBearerToken(authorizationHeader);
    const bearerIsAnonKey = supabaseAnonKey && bearerToken ? bearerToken === supabaseAnonKey : false;

    if (!bearerToken || bearerIsAnonKey) {
      logger.warn('preview_auth_failed', {
        reason: 'missing_bearer',
        requestId
      });
      return respond(
        JSON.stringify(createErrorResponse('unauthorized', 'Valid Supabase session required', requestId, 'UNAUTHORIZED')),
        401
      );
    }

    if (!idempotencyKey) {
      logger.warn('Missing idempotency key header');
      return respond(
        JSON.stringify(createErrorResponse('missing_idempotency_key', 'X-Idempotency-Key header is required', requestId, 'MISSING_IDEMPOTENCY')),
        400
      );
    }

    let entitlementContext: EntitlementContext | null = null;

    try {
      const { context } = await resolveEntitlements({
        supabase,
        accessToken: authorizationHeader,
        devBypassEmails
      });
      entitlementContext = context;

      if (
        entitlementsFlag &&
        !context.devBypass &&
        context.remainingBefore !== null &&
        context.remainingBefore <= 0
      ) {
        logger.info('Entitlement exceeded', {
          requestId,
          tier: context.tierLabel
        });
        const errorPayload = createErrorResponse(
          'ENTITLEMENT_EXCEEDED',
          'Preview quota exceeded',
          requestId,
          'ENTITLEMENT_EXCEEDED'
        );
        return respond(
          JSON.stringify({
            ...errorPayload,
            remainingTokens: 0,
            tier: context.tierLabel
          }),
          429
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Failed to resolve entitlements', { requestId, message });

      if (message === 'UNAUTHORIZED') {
        logger.warn('preview_auth_failed', {
          reason: 'invalid_session',
          requestId
        });
        return respond(
          JSON.stringify(createErrorResponse('unauthorized', 'Valid Supabase session required', requestId, 'UNAUTHORIZED')),
          401
        );
      }

      return respond(
        JSON.stringify(createErrorResponse('entitlement_error', 'Unable to evaluate entitlements', requestId, 'ENTITLEMENT_ERROR')),
        500
      );
    }

    const stylePromptService = new StylePromptService(supabase);
    initializeWarmup(stylePromptService);

    const cacheMetadataService = new CacheMetadataService(supabase);
    const storageClient = new PreviewStorageClient(supabase, cacheBucket);

    let previewLogId: string | null = null;

    const recordPreviewFailure = async (code: string, message: string, statusCode: number): Promise<Response> => {
      if (previewLogId) {
        await supabase
          .from('preview_logs')
          .update({
            outcome: 'error',
            error_code: code,
            tokens_spent: 0,
          })
          .eq('id', previewLogId);
      }

      await recordGenerationCostEvent(supabase, {
        request_id: requestId,
        style_id: typeof style === 'string' ? style : null,
        cache_hit: false,
        provider: null,
        provider_fallback: false,
        duration_ms: Date.now() - startTime,
        outcome: 'failed',
      });

      const payload = createErrorResponse(code, message, requestId, code);
      return respond(JSON.stringify(payload), statusCode);
    };
    const existingLogResult = await supabase
      .from('preview_logs')
      .select('id, preview_url, outcome, requires_watermark, priority, tier, tokens_spent, error_code, user_id, source_storage_path, source_display_url, crop_config')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    const existingLog = existingLogResult.data ?? null;

    if (existingLog) {
      if (!sourceStoragePath && existingLog.source_storage_path) {
        sourceStoragePath = existingLog.source_storage_path as string;
      }
      if (!sourceDisplayUrl && existingLog.source_display_url) {
        sourceDisplayUrl = existingLog.source_display_url as string;
      }
      if (!cropConfig && existingLog.crop_config) {
        cropConfig = cloneJson(existingLog.crop_config as Record<string, unknown>);
      }
      previewLogId = existingLog.id;

      if (
        entitlementContext?.userId &&
        existingLog.user_id &&
        existingLog.user_id !== entitlementContext.userId
      ) {
        logger.warn('Idempotency key belongs to another user', {
          requestId,
          userId: entitlementContext.userId,
          existingUserId: existingLog.user_id
        });
        return respond(
          JSON.stringify(createErrorResponse('idempotency_conflict', 'Idempotency key conflict', requestId, 'IDEMPOTENCY_CONFLICT')),
          409
        );
      }

      if (existingLog.outcome === 'success' && existingLog.preview_url) {
        const duration = Date.now() - startTime;
        const remainingTokens = entitlementContext
          ? entitlementContext.devBypass
            ? null
            : entitlementContext.remainingBefore
          : null;

        const tierLabel = entitlementContext?.tierLabel ?? existingLog.tier ?? undefined;
        const priority = entitlementContext?.priority ?? existingLog.priority ?? 'normal';
        const requiresWatermark = entitlementContext?.requiresWatermark ?? existingLog.requires_watermark ?? true;
        let previewUrlForResponse: string;
        try {
          previewUrlForResponse = await presentPreviewToClient(
            supabase,
            existingLog.preview_url,
            requiresWatermark,
            requestId
          );
        } catch {
          return respond(
            JSON.stringify(createErrorResponse('preview_presentment_failed', 'Unable to present preview', requestId, 'PREVIEW_PRESENTMENT_FAILED')),
            500
          );
        }

        logger.info('Returning cached idempotent preview result', {
          requestId,
          idempotencyKey,
          tier: tierLabel
        });

        return respond(
          JSON.stringify(
            createSuccessResponse({
              previewUrl: previewUrlForResponse,
              requestId,
              duration,
              cacheStatus: 'hit',
              tier: tierLabel,
              requiresWatermark,
              remainingTokens,
              priority,
              storageUrl: requiresWatermark ? null : previewUrlForResponse,
              storagePath: existingLog.preview_url ? extractStoragePath(existingLog.preview_url) : null,
              sourceStoragePath,
              sourceDisplayUrl,
              previewLogId,
              cropConfig
            })
          ),
          200
        );
      }

      if (existingLog.outcome === 'error') {
        logger.info('Returning cached error for idempotent key', {
          requestId,
          idempotencyKey,
          errorCode: existingLog.error_code
        });
        const errorPayload = createErrorResponse(
          existingLog.error_code ?? 'previous_error',
          'Previous preview attempt failed',
          requestId,
          existingLog.error_code ?? 'PREVIOUS_ERROR'
        );
        return respond(
          JSON.stringify(errorPayload),
          400
        );
      }

      if (existingLog.outcome === 'pending') {
        logger.info('Preview still pending for idempotent key', { requestId, idempotencyKey });
        return respond(
          JSON.stringify({
            status: 'pending',
            requestId,
            message: 'Preview generation is still in progress'
          }),
          202
        );
      }
    }

    // Check in-memory prompt cache FIRST before hitting the database
    let stylePrompt: string;
    let styleMetadata: StylePromptMetadata;

    const cachedPrompt = getCachedPrompt(style);
    if (cachedPrompt) {
      // Cache hit: use cached prompt and metadata
      stylePrompt = cachedPrompt.prompt;
      styleMetadata = {
        prompt: cachedPrompt.prompt,
        styleId: cachedPrompt.styleId,
        styleVersion: cachedPrompt.styleVersion
      };
      console.log('[prompt-cache]', {
        action: 'hit',
        style,
        requestId,
        source: cachedPrompt.source,
        ageMs: cachedPrompt.ageMs
      });
    } else {
      // Cache miss: fetch from database
      const promptFetchStart = Date.now();
      let fetchedMetadata: StylePromptMetadata | null = null;

      try {
        fetchedMetadata = await stylePromptService.getStylePromptWithMetadata(style);
      } catch (error) {
        console.error('[prompt-cache]', {
          action: 'fetch_error',
          style,
          requestId,
          message: error instanceof Error ? error.message : String(error)
        });
      }

      const resolvedMetadata = fetchedMetadata ?? {
        prompt: null,
        styleVersion: '0',
        styleId: stylePromptService.resolveStyleId(style)
      };

      const promptFetchDurationMs = Date.now() - promptFetchStart;

      if (resolvedMetadata.prompt) {
        stylePrompt = resolvedMetadata.prompt;
        setCachedPrompt(style, {
          prompt: resolvedMetadata.prompt,
          styleId: resolvedMetadata.styleId,
          styleVersion: resolvedMetadata.styleVersion
        }, 'db');
      } else {
        stylePrompt = buildFallbackPrompt(style);
        setCachedPrompt(style, {
          prompt: stylePrompt,
          styleId: resolvedMetadata.styleId,
          styleVersion: resolvedMetadata.styleVersion
        }, 'fallback');
      }

      console.log('[prompt-cache]', {
        action: 'miss',
        style,
        requestId,
        fetchDurationMs: promptFetchDurationMs,
        source: resolvedMetadata.prompt ? 'db' : 'fallback'
      });

      styleMetadata = {
        prompt: stylePrompt,
        styleId: resolvedMetadata.styleId,
        styleVersion: resolvedMetadata.styleVersion
      };
    }

    if (!styleMetadata) {
      styleMetadata = {
        prompt: stylePrompt,
        styleId: stylePromptService.resolveStyleId(style),
        styleVersion: '0'
      };
    }

    const effectiveWatermark = entitlementContext?.requiresWatermark ?? watermark;

    if (!previewLogId) {
      const insertPayload = {
        idempotency_key: idempotencyKey,
        user_id: entitlementContext?.userId ?? null,
        tier: entitlementContext?.tierForDb ?? null,
        style_id: String(styleMetadata.styleId),
        orientation: normalizedAspectRatio,
        watermark: effectiveWatermark,
        requires_watermark: effectiveWatermark,
        priority: entitlementContext?.priority ?? 'normal',
        outcome: 'pending',
        tokens_spent: 0,
        source_storage_path: sourceStoragePath,
        source_display_url: sourceDisplayUrl,
        crop_config: cropConfig
      };

      const insertResult = await supabase
        .from('preview_logs')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertResult.error) {
        logger.error('Failed to insert preview log', {
          requestId,
          error: insertResult.error.message
        });
        return respond(
          JSON.stringify(createErrorResponse('log_write_failed', 'Failed to initialize preview log', requestId, 'LOG_WRITE_FAILED')),
          500
        );
      } else {
        previewLogId = insertResult.data?.id ?? null;
      }
      }

    async function recordPreviewSuccess(previewUrl: string, cacheStatus: CacheStatus, statusCode = 200): Promise<Response> {
      const tokensDebit = entitlementContext && !entitlementContext.devBypass ? 1 : 0;
      const storagePath = extractStoragePath(previewUrl);

      let finalPreviewUrl: string;
      try {
        finalPreviewUrl = await presentPreviewToClient(
          supabase,
          previewUrl,
          effectiveWatermark,
          requestId
        );
      } catch (error) {
        logger.error('[on-the-fly] Preview presentment failed', {
          requestId,
          error: safeErrorMessage(error),
        });
        return respond(
          JSON.stringify(createErrorResponse('preview_presentment_failed', 'Unable to present preview', requestId, 'PREVIEW_PRESENTMENT_FAILED')),
          500
        );
      }

      if (previewLogId) {
        await supabase
          .from('preview_logs')
          .update({
            outcome: 'success',
            preview_url: previewUrl, // Store clean URL
            tokens_spent: tokensDebit,
            watermark: effectiveWatermark,
            requires_watermark: effectiveWatermark,
            priority: entitlementContext?.priority ?? 'normal',
            tier: entitlementContext?.tierForDb ?? null,
            source_storage_path: sourceStoragePath,
            source_display_url: sourceDisplayUrl,
            crop_config: cropConfig
          })
          .eq('id', previewLogId);
      }

      const remainingTokens = entitlementContext
        ? (entitlementContext.devBypass
            ? null
            : computeRemainingAfterDebet(entitlementContext, tokensDebit))
        : null;

      const payload = createSuccessResponse({
        previewUrl: finalPreviewUrl, // Return watermarked data URL for free users, clean URL for paid
        requestId,
        duration: Date.now() - startTime,
        cacheStatus,
        tier: entitlementContext?.tierLabel,
        requiresWatermark: effectiveWatermark,
        remainingTokens,
        priority: entitlementContext?.priority ?? 'normal',
        storageUrl: effectiveWatermark ? null : finalPreviewUrl,
        storagePath,
        softRemaining: null,
        sourceStoragePath,
        sourceDisplayUrl,
        previewLogId,
        cropConfig
      });

      return respond(JSON.stringify(payload), statusCode);
    }

    // Build cache key from RAW imageUrl (before normalization)
    const cacheAllowedForRequest = cacheEnabledGlobally && !cacheBypass;
    let cacheStatus: CacheStatus = cacheBypass ? 'bypass' : 'miss';
    const imageDigest = await createImageDigest(imageUrl);
    let cacheKey: string | null = null;

    let metadataEntry: CacheMetadataRecord | null = null;
    const cacheTier = entitlementContext?.tierForDb ?? (entitlementContext?.tierLabel ?? null);
    const cacheTierKey = (cacheTier ?? 'free').toString();
    const cacheOwnerUserId = entitlementContext?.userId ?? null;

    if (cacheAllowedForRequest) {
      cacheKey = buildCacheKey({
        imageDigest,
        styleId: styleMetadata.styleId,
        styleVersion: styleMetadata.styleVersion,
        aspectRatio: normalizedAspectRatio,
        quality: normalizedQuality,
        watermark: effectiveWatermark,
        tier: cacheTierKey
      });

      // Check memory cache FIRST
      const cachedFromMemory = memoryCache.get(cacheKey);
      if (cachedFromMemory) {
        cacheStatus = 'hit';
        logger.info('Cache hit (memory) - skipping normalization', {
          cacheKey,
          inputScheme
        });
        cacheMetadataService.recordHit(cacheKey).catch((error) => {
          logger.warn('Failed to record cache hit', { error: error?.message ?? 'unknown', cacheKey });
        });
        if (!metadataEntry) {
          try {
            metadataEntry = await cacheMetadataService.get(cacheKey);
          } catch (error) {
            logger.warn('Failed to load cache metadata for memory hit', { error: error instanceof Error ? error.message : String(error), cacheKey });
          }
        }
        // OPUS PLAN: Return clean URL, client will request watermarked version via ?context=download if needed
        if (cacheKey) {
          const ttlForEntry = metadataEntry?.ttl_expires_at ? Math.max(Date.parse(metadataEntry.ttl_expires_at) - Date.now(), 1000) : ttlMs;
          memoryCache.set(cacheKey, cachedFromMemory, ttlForEntry);
        }
        await recordGenerationCostEvent(supabase, {
          request_id: requestId,
          style_id: styleMetadata.styleId,
          cache_hit: true,
          provider: null,
          provider_fallback: false,
          duration_ms: Date.now() - startTime,
          outcome: 'cache_hit',
        });
        return await recordPreviewSuccess(cachedFromMemory, cacheStatus);
      }

      // Check storage cache SECOND
      try {
        if (!metadataEntry) {
          metadataEntry = await cacheMetadataService.get(cacheKey);
        }
        if (metadataEntry && metadataEntry.preview_url && !isExpired(metadataEntry.ttl_expires_at)) {
          cacheStatus = 'hit';
          const ttlRemaining = Date.parse(metadataEntry.ttl_expires_at) - Date.now();
          if (ttlRemaining > 0) {
            memoryCache.set(cacheKey, metadataEntry.preview_url, ttlRemaining);
          }
          logger.info('Cache hit (storage) - skipping normalization', {
            cacheKey,
            inputScheme
          });
          cacheMetadataService.recordHit(cacheKey).catch((error) => {
            logger.warn('Failed to record cache hit', { error: error?.message ?? 'unknown', cacheKey });
          });
          // OPUS PLAN: Return clean URL, client will request watermarked version via ?context=download if needed
          if (cacheKey) {
            memoryCache.set(cacheKey, metadataEntry.preview_url, ttlMs);
          }
          await recordGenerationCostEvent(supabase, {
            request_id: requestId,
            style_id: styleMetadata.styleId,
            cache_hit: true,
            provider: null,
            provider_fallback: false,
            duration_ms: Date.now() - startTime,
            outcome: 'cache_hit',
          });
          return await recordPreviewSuccess(metadataEntry.preview_url, cacheStatus);
        } else if (metadataEntry && metadataEntry.preview_url) {
          logger.info('Cache entry expired, regenerating', { cacheKey });
        }
      } catch (error) {
        logger.warn('Cache metadata lookup failed', { error: error instanceof Error ? error.message : String(error), cacheKey });
      }
    }

    // CACHE MISS: Now normalize the image (only happens on misses)
    logger.info('Cache miss, normalizing input', {
      inputScheme,
      cacheKey,
      cacheStatus
    });
    const normalizationStart = Date.now();
    let normalizedImageUrl: string;
    try {
      normalizedImageUrl = await normalizeImageInput(imageUrl, supabase, {
        requestId,
        sourceStoragePath,
      });
    } catch (error) {
      logger.error('Image normalization failed', {
        requestId,
        imageUrl: imageUrl.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return await recordPreviewFailure(
        'invalid_image',
        'Failed to process image. Please ensure the image is accessible.',
        400
      );
    }
    const normalizationDurationMs = Date.now() - normalizationStart;
    logger.info('Normalization complete', {
      requestId,
      normalizationDurationMs,
      wasAlreadyDataUri: imageUrl.startsWith('data:')
    });

    const persistGeneratedPreview = async (rawOutput: string): Promise<string> => {
      let finalPreviewUrl = rawOutput;

      if (cacheAllowedForRequest && cacheKey) {
        try {
          const storagePath = computeStoragePath(styleMetadata.styleId, normalizedAspectRatio, normalizedQuality, imageDigest);
          const ttlExpiresAt = new Date(Date.now() + ttlMs).toISOString();

          const cleanResult = await storageClient.uploadFromUrl(rawOutput, storagePath, {}, false);

          let displayUrl = cleanResult.publicUrl;
          try {
            let sourceBuffer: ArrayBuffer;
            if (rawOutput.startsWith('data:image/')) {
              const data = rawOutput.split(',')[1] ?? '';
              const binary = atob(data);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
              }
              sourceBuffer = bytes.buffer;
            } else {
              const sourceResponse = await fetch(rawOutput);
              if (!sourceResponse.ok) {
                throw new Error(`display_source_fetch_${sourceResponse.status}`);
              }
              sourceBuffer = await sourceResponse.arrayBuffer();
            }
            const displayBuffer = await createDisplayPreview(sourceBuffer);
            const displayResult = await storageClient.uploadFromBuffer(
              displayBuffer,
              storagePath,
              { contentType: 'image/jpeg' },
              true
            );
            displayUrl = displayResult.publicUrl;
          } catch (displayError) {
            logger.warn('Display preview upload failed; keeping clean reference off the client path', {
              requestId,
              message: displayError instanceof Error ? displayError.message : 'unknown',
            });
          }

          finalPreviewUrl = displayUrl;

          await cacheMetadataService.upsert({
            cacheKey,
            styleId: styleMetadata.styleId,
            styleVersion: styleMetadata.styleVersion,
            imageDigest,
            aspectRatio: normalizedAspectRatio,
            quality: normalizedQuality,
            watermark: false,
            storagePath: cleanResult.storagePath,
            previewUrl: displayUrl,
            ttlExpiresAt,
            sourceRequestId: requestId,
            createdByUserId: cacheOwnerUserId,
            tier: cacheTierKey
          });

          memoryCache.set(cacheKey, displayUrl, ttlMs);

          logger.info('Clean full-res stored privately; display preview stored publicly', {
            requestId,
            storagePath,
          });
        } catch (error) {
          logger.warn('Failed to cache preview output', { error: error instanceof Error ? error.message : String(error), cacheKey, requestId });
        }
      } else if (!cacheAllowedForRequest) {
        cacheStatus = cacheBypass ? 'bypass' : cacheStatus;
      }

      return finalPreviewUrl;
    };

    if (asyncEnabled && (!webhookBaseUrl || !webhookSecret)) {
      logger.warn('Async preview enabled but webhook configuration is incomplete. Falling back to synchronous mode.', {
        hasBaseUrl: Boolean(webhookBaseUrl),
        hasSecret: Boolean(webhookSecret)
      });
    }

    if (asyncEnabled && webhookBaseUrl && webhookSecret) {
      const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}/functions/v1/generate-style-preview/webhook?token=${webhookSecret}`;

      // Map quality to SeeDream size parameter
      const seedreamSize = normalizedQuality === 'high' ? '4K' :
                          normalizedQuality === 'low' ? '1K' : '2K';

      const createBody = {
        input: {
          prompt: stylePrompt,
          image_input: [normalizedImageUrl],
          aspect_ratio: normalizedAspectRatio,
          size: seedreamSize,
          max_images: 1,
          request_id: requestId
        },
        webhook: webhookUrl,
        webhook_events_filter: ['completed', 'failed', 'canceled']
      } as const;

      const asyncResp = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicateApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createBody)
      });

      if (!asyncResp.ok) {
        await asyncResp.text().catch(() => '');
        logger.error('Replicate async create failed', { requestId, status: asyncResp.status });
        return await recordPreviewFailure('generation_failed', `SeeDream API request failed: ${asyncResp.status}`, 503);
      }

      const asyncData = await asyncResp.json();

      if (asyncData?.status === 'succeeded' && asyncData?.output) {
        const immediateOutput = Array.isArray(asyncData.output) ? asyncData.output[0] : asyncData.output;
        const finalPreviewUrl = await persistGeneratedPreview(immediateOutput);

        await supabase.from('previews_status').upsert({
          request_id: requestId,
          prediction_id: asyncData?.id ?? null,
          status: 'succeeded',
          preview_url: finalPreviewUrl,
          error: null,
          image_digest: imageDigest,
          style_id: styleMetadata.styleId,
          style_version: styleMetadata.styleVersion,
          aspect_ratio: normalizedAspectRatio,
          quality: normalizedQuality,
          watermark: effectiveWatermark,
          cache_allowed: cacheAllowedForRequest,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'request_id' });

        logger.info('Replicate returned immediate result', { requestId, cacheStatus });
        return await recordPreviewSuccess(finalPreviewUrl, cacheStatus);
      }

      await supabase.from('previews_status').upsert({
        request_id: requestId,
        prediction_id: asyncData?.id ?? null,
        status: asyncData?.status ?? 'processing',
        preview_url: null,
        error: null,
        image_digest: imageDigest,
        style_id: styleMetadata.styleId,
        style_version: styleMetadata.styleVersion,
        aspect_ratio: normalizedAspectRatio,
        quality: normalizedQuality,
        watermark: effectiveWatermark,
        cache_allowed: cacheAllowedForRequest,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'request_id' });

      logger.info('Queued preview generation via webhook', {
        requestId,
        status: asyncData?.status ?? 'processing',
        cacheAllowedForRequest
      });

      return respond(
        JSON.stringify({
          requestId,
          status: asyncData?.status ?? 'processing',
          requires_watermark: entitlementContext?.requiresWatermark ?? effectiveWatermark,
          remainingTokens: entitlementContext?.remainingBefore ?? null,
          tier: entitlementContext?.tierLabel,
          priority: entitlementContext?.priority ?? 'normal'
        }),
        202
      );
    }

    const replicateService = new ReplicateService(replicateApiToken);
    const replicateStart = Date.now();

    logger.info('Generating preview via Replicate (SeeDream 4.0)', {
      requestId,
      cacheStatus,
      cacheEnabled: cacheAllowedForRequest,
      style,
      aspectRatio,
      quality
    });

    const result = await replicateService.generateImageToImage(normalizedImageUrl, stylePrompt, normalizedAspectRatio, normalizedQuality);
    const replicateDurationMs = Date.now() - replicateStart;

    if (result.ok && result.output) {
      const rawOutput = Array.isArray(result.output) ? result.output[0] : result.output;
      const finalPreviewUrl = await persistGeneratedPreview(rawOutput);

      if (asyncEnabled && webhookBaseUrl && webhookSecret) {
        await supabase.from('previews_status').upsert({
          request_id: requestId,
          prediction_id: null,
          status: 'succeeded',
          preview_url: finalPreviewUrl,
          error: null,
          image_digest: imageDigest,
          style_id: styleMetadata.styleId,
          style_version: styleMetadata.styleVersion,
          aspect_ratio: normalizedAspectRatio,
          quality: normalizedQuality,
          watermark: effectiveWatermark,
          cache_allowed: cacheAllowedForRequest,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'request_id' });
      }

      logger.info('Replicate generation success', { requestId, replicateDurationMs, cacheStatus });
      await recordGenerationCostEvent(supabase, {
        request_id: requestId,
        style_id: styleMetadata.styleId,
        cache_hit: false,
        provider: 'replicate_seedream',
        provider_fallback: false,
        duration_ms: Date.now() - startTime,
        provider_predict_time_s:
          typeof result.metrics?.predict_time === 'number' ? result.metrics.predict_time : null,
        outcome: 'success',
      });
      return await recordPreviewSuccess(finalPreviewUrl, cacheStatus);
    }

    logger.error('SeeDream generation failed', { error: result.error, requestId });

    if (fallbackEnabled) {
      logger.warn('Attempting GPT-Image-1 fallback', { requestId });
      const fallbackStart = Date.now();
      const fallbackResult = await replicateService.generateImageToImageWithGpt(
        normalizedImageUrl,
        stylePrompt,
        normalizedAspectRatio,
        normalizedQuality,
        openAiFallbackKey
      );
      const fallbackDurationMs = Date.now() - fallbackStart;

      if (fallbackResult.ok && fallbackResult.output) {
        const fallbackOutput = Array.isArray(fallbackResult.output) ? fallbackResult.output[0] : fallbackResult.output;
        const finalPreviewUrl = await persistGeneratedPreview(fallbackOutput);

        logger.info('GPT-Image-1 fallback succeeded', {
          requestId,
          fallbackDurationMs,
          cacheStatus
        });

        await recordGenerationCostEvent(supabase, {
          request_id: requestId,
          style_id: styleMetadata.styleId,
          cache_hit: false,
          provider: 'openai_gpt',
          provider_fallback: true,
          duration_ms: Date.now() - startTime,
          provider_predict_time_s:
            typeof fallbackResult.metrics?.predict_time === 'number' ? fallbackResult.metrics.predict_time : null,
          outcome: 'success',
        });

        return await recordPreviewSuccess(finalPreviewUrl, cacheStatus);
      }

      logger.error('GPT-Image-1 fallback failed', {
        requestId,
        error: fallbackResult.error,
        technicalError: fallbackResult.technicalError
      });
    }

    return await recordPreviewFailure('generation_failed', result.error || 'AI service is temporarily unavailable. Please try again.', 503);
  } catch (error) {
    logger.error('Unhandled error in preview generation', { error: error instanceof Error ? error.message : String(error), requestId });
    return await recordPreviewFailure('internal_error', 'Internal server error. Please try again.', 500);
  }
});

const extractStoragePath = (sourceUrl: string): string | null => {
  const ref = parseStorageUrl(sourceUrl) ?? parseStoragePath(sourceUrl);
  if (!ref) return null;
  return `${ref.bucket}/${ref.path}`;
};

async function presentPreviewToClient(
  _supabase: ReturnType<typeof createClient>,
  storedUrl: string,
  _requiresWatermark: boolean,
  _requestId: string
): Promise<string> {
  const ref = parseStorageUrl(storedUrl) ?? parseStoragePath(storedUrl);
  if (ref) {
    const displayRef = toPublicDisplayRef(ref.bucket, ref.path);
    if (displayRef.bucket === 'preview-cache-public') {
      return buildPublicUrl(displayRef);
    }
    if (isPrivateStorageBucket(ref.bucket)) {
      throw new Error('private_preview_not_presentable');
    }
    return buildPublicUrl(ref);
  }

  return storedUrl;
}

// LEGACY FUNCTION REMOVED: ensureWatermarkedPreview
// OPUS PLAN: Watermarking now happens on-the-fly via separate download/serve endpoint
// All previews are stored clean, watermarks applied on-demand based on ?context=download param
