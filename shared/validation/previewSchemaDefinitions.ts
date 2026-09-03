import { z } from 'zod';

export const qualityEnum = z.enum(['low', 'medium', 'high', 'auto']);

export type PreviewQuality = z.infer<typeof qualityEnum>;

const previewCropConfigSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    orientation: z.string().optional(),
  })
  .passthrough();

export const previewRequestSchema = z
  .object({
    imageUrl: z.string().min(1),
    style: z.string().min(1),
    photoId: z.string().optional(),
    aspectRatio: z.string().regex(/^\d+:\d+$/).optional(),
    watermark: z.boolean().optional(),
    quality: qualityEnum.optional(),
    cacheBypass: z.boolean().optional(),
    isAuthenticated: z.boolean().optional(),
    sourceStoragePath: z.string().nullable().optional(),
    sourceDisplayUrl: z.string().nullable().optional(),
    cropConfig: previewCropConfigSchema.nullable().optional(),
  })
  .passthrough();

export const previewCompleteSchema = z
  .object({
    status: z.literal('complete'),
    previewUrl: z.string().min(1),
    requiresWatermark: z.boolean(),
    remainingTokens: z.number().nullable(),
  })
  .passthrough();

export const previewProcessingSchema = z
  .object({
    status: z.literal('processing'),
    requestId: z.string().optional(),
    request_id: z.string().optional(),
    previewUrl: z.null().optional(),
    requiresWatermark: z.boolean().optional(),
    requires_watermark: z.boolean().optional(),
    remainingTokens: z.number().nullable().optional(),
    remaining_tokens: z.number().nullable().optional(),
  })
  .passthrough();

export const previewStatusSchema = z
  .object({
    request_id: z.string().min(1),
    status: z.string().min(1),
    preview_url: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
  })
  .passthrough();


export type PreviewCropConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation?: string;
  [key: string]: unknown;
};

export type PreviewRequest = {
  imageUrl: string;
  style: string;
  photoId?: string;
  aspectRatio?: string;
  watermark?: boolean;
  quality?: PreviewQuality;
  cacheBypass?: boolean;
  isAuthenticated?: boolean;
  sourceStoragePath?: string | null;
  sourceDisplayUrl?: string | null;
  cropConfig?: PreviewCropConfig | null;
  [key: string]: unknown;
};

export type PreviewResponse = {
  status: 'complete';
  previewUrl: string;
  requiresWatermark: boolean;
  remainingTokens: number | null;
  tier?: string;
  priority?: string;
  storageUrl?: string | null;
  storagePath?: string | null;
  softRemaining?: number | null;
  sourceStoragePath?: string | null;
  sourceDisplayUrl?: string | null;
  previewLogId?: string | null;
  cropConfig?: PreviewCropConfig | null;
} | {
  status: 'processing';
  previewUrl: null;
  requestId: string;
  requiresWatermark: boolean;
  remainingTokens: number | null;
  tier?: string;
  priority?: string;
  storageUrl?: string | null;
  storagePath?: string | null;
  softRemaining?: number | null;
  sourceStoragePath?: string | null;
  sourceDisplayUrl?: string | null;
  previewLogId?: string | null;
  cropConfig?: PreviewCropConfig | null;
};

export type PreviewStatusResponse = {
  request_id: string;
  status: string;
  preview_url?: string | null;
  error?: string | null;
  [key: string]: unknown;
};
