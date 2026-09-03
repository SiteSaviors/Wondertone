import type {
  PreviewCropConfig,
  PreviewRequest,
  PreviewResponse,
  PreviewStatusResponse,
} from './previewSchemaDefinitions';

export {
  previewRequestSchema,
  previewCompleteSchema,
  previewProcessingSchema,
  previewStatusSchema,
  qualityEnum,
} from './previewSchemaDefinitions';

const QUALITY_VALUES = new Set<PreviewRequest['quality']>(['low', 'medium', 'high', 'auto']);
const ASPECT_RATIO_REGEX = /^\d+:\d+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const coerceNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value === null) return null;
  return null;
};

const getNonEmptyString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`${key} is required`);
};

const getOptionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

const coerceNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const normalizeCropConfig = (value: unknown): PreviewCropConfig | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Invalid cropConfig payload');
  }

  return value as PreviewCropConfig;
};

export const parsePreviewRequest = (data: unknown): PreviewRequest => {
  if (!isRecord(data)) {
    throw new Error('Invalid preview request payload');
  }

  const payload: Record<string, unknown> = { ...data };

  const imageUrl = getNonEmptyString(payload, 'imageUrl');
  const style = getNonEmptyString(payload, 'style');

  const aspectRatioCandidate = getOptionalString(payload, 'aspectRatio');
  const aspectRatio = aspectRatioCandidate && ASPECT_RATIO_REGEX.test(aspectRatioCandidate)
    ? aspectRatioCandidate
    : '1:1';

  const qualityCandidate = payload.quality;
  const quality = QUALITY_VALUES.has(qualityCandidate as PreviewRequest['quality'])
    ? (qualityCandidate as PreviewRequest['quality'])
    : 'medium';

  const watermark = coerceBoolean(payload.watermark, true);
  const cacheBypass = coerceBoolean(payload.cacheBypass, false);

  const result: Record<string, unknown> = {
    ...payload,
    imageUrl,
    style,
    aspectRatio,
    quality,
    watermark,
    cacheBypass,
    cropConfig: normalizeCropConfig(payload.cropConfig ?? null),
  };

  const isAuthenticatedValue = payload.isAuthenticated;
  if (typeof isAuthenticatedValue === 'boolean') {
    result.isAuthenticated = isAuthenticatedValue;
  } else {
    delete result.isAuthenticated;
  }

  if (payload.sourceStoragePath === undefined) {
    delete result.sourceStoragePath;
  }

  if (payload.sourceDisplayUrl === undefined) {
    delete result.sourceDisplayUrl;
  }

  if (payload.photoId !== undefined && typeof payload.photoId !== 'string') {
    delete result.photoId;
  }

  return result as PreviewRequest;
};

const extractPreviewUrl = (source: Record<string, unknown>): string | null => {
  const urlCandidate = source.previewUrl ?? source.preview_url;
  return typeof urlCandidate === 'string' ? urlCandidate : null;
};

const extractRequestId = (source: Record<string, unknown>): string | null => {
  const requestIdCandidate = source.requestId ?? source.request_id;
  return typeof requestIdCandidate === 'string' ? requestIdCandidate : null;
};

const toCompleteResponse = (value: unknown): PreviewResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const previewUrl = extractPreviewUrl(value);
  if (!previewUrl) {
    return null;
  }

  return {
    status: 'complete',
    previewUrl,
    requiresWatermark: coerceBoolean(
      value.requiresWatermark ?? value.requires_watermark,
      false
    ),
    remainingTokens: coerceNullableNumber(
      value.remainingTokens ?? value.remaining_tokens ?? null
    ),
    tier: getOptionalString(value, 'tier'),
    priority: getOptionalString(value, 'priority'),
    storageUrl: coerceNullableString(value.storageUrl ?? value.storage_url ?? null),
    storagePath: coerceNullableString(value.storagePath ?? value.storage_path ?? null),
    softRemaining: coerceNullableNumber(
      value.softRemaining ?? value.soft_remaining ?? null
    ),
    sourceStoragePath: coerceNullableString(
      value.sourceStoragePath ?? value.source_storage_path ?? null
    ),
    sourceDisplayUrl: coerceNullableString(
      value.sourceDisplayUrl ?? value.source_display_url ?? null
    ),
    previewLogId: coerceNullableString(value.previewLogId ?? value.preview_log_id ?? null),
    cropConfig: normalizeCropConfig(value.cropConfig ?? null),
  };
};

const toProcessingResponse = (value: unknown): PreviewResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const requestId = extractRequestId(value);
  if (!requestId) {
    return null;
  }

  return {
    status: 'processing',
    previewUrl: null,
    requestId,
    requiresWatermark: coerceBoolean(
      value.requiresWatermark ?? value.requires_watermark,
      false
    ),
    remainingTokens: coerceNullableNumber(
      value.remainingTokens ?? value.remaining_tokens ?? null
    ),
    tier: getOptionalString(value, 'tier'),
    priority: getOptionalString(value, 'priority'),
    storageUrl: coerceNullableString(value.storageUrl ?? value.storage_url ?? null),
    storagePath: coerceNullableString(value.storagePath ?? value.storage_path ?? null),
    softRemaining: coerceNullableNumber(
      value.softRemaining ?? value.soft_remaining ?? null
    ),
    sourceStoragePath: coerceNullableString(
      value.sourceStoragePath ?? value.source_storage_path ?? null
    ),
    sourceDisplayUrl: coerceNullableString(
      value.sourceDisplayUrl ?? value.source_display_url ?? null
    ),
    previewLogId: coerceNullableString(value.previewLogId ?? value.preview_log_id ?? null),
    cropConfig: normalizeCropConfig(value.cropConfig ?? null),
  };
};

export const normalizePreviewResponse = (data: unknown): PreviewResponse => {
  const complete = toCompleteResponse(data);
  if (complete) {
    return complete;
  }

  const processing = toProcessingResponse(data);
  if (processing) {
    return processing;
  }

  throw new Error('Invalid preview response payload');
};

export const parsePreviewStatusResponse = (data: unknown): PreviewStatusResponse => {
  if (!isRecord(data)) {
    throw new Error('Invalid preview status payload');
  }

  const requestId = getNonEmptyString(data, 'request_id');
  const status = getNonEmptyString(data, 'status');
  let previewUrl: string | null = null;
  if (data.preview_url === undefined) {
    // leave as null
  } else if (data.preview_url === null) {
    previewUrl = null;
  } else if (typeof data.preview_url === 'string') {
    previewUrl = data.preview_url;
  } else {
    throw new Error('Invalid preview status payload');
  }

  let errorValue: string | null | undefined;
  if (data.error === undefined) {
    errorValue = undefined;
  } else if (data.error === null) {
    errorValue = null;
  } else if (typeof data.error === 'string') {
    errorValue = data.error;
  } else {
    throw new Error('Invalid preview status payload');
  }

  const result: Record<string, unknown> = {
    ...data,
    request_id: requestId,
    status,
  };

  if (previewUrl !== null) {
    result.preview_url = previewUrl;
  } else if (data.preview_url === null) {
    result.preview_url = null;
  }

  if (errorValue !== undefined) {
    result.error = errorValue;
  }

  return result as PreviewStatusResponse;
};

export type {
  PreviewCropConfig,
  PreviewRequest,
  PreviewResponse,
  PreviewStatusResponse,
} from './previewSchemaDefinitions';
