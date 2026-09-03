import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startStylePreviewFlow,
  resumePendingAuthPreviewFlow,
  generatePreviewsFlow,
  type PreviewEngineRuntime,
} from '@/store/founder/previewEngine/core';
import {
  startStylePreviewEngine,
  abortPreviewGenerationEngine,
} from '@/store/founder/previewEngine/loader';
import type { FounderState, StyleOption } from '@/store/founder/storeTypes';

const mocks = vi.hoisted(() => ({
  emitStepOneEvent: vi.fn(),
  emitAuthGateEvent: vi.fn(),
  logPreviewStage: vi.fn(),
  playPreviewChime: vi.fn(),
  startFounderPreviewGeneration: vi.fn(),
  computeImageDigest: vi.fn(async () => 'computed-hash'),
  buildPreviewIdempotencyKey: vi.fn(async () => 'preview-key'),
  fetchPreviewForStyle: vi.fn(),
}));

vi.mock('@/utils/telemetry', () => ({
  emitStepOneEvent: mocks.emitStepOneEvent,
  emitAuthGateEvent: mocks.emitAuthGateEvent,
}));

vi.mock('@/utils/previewAnalytics', () => ({
  logPreviewStage: mocks.logPreviewStage,
}));

vi.mock('@/utils/playPreviewChime', () => ({
  playPreviewChime: mocks.playPreviewChime,
}));

vi.mock('@/utils/founderPreviewGeneration', () => ({
  startFounderPreviewGeneration: mocks.startFounderPreviewGeneration,
}));

vi.mock('@/utils/imageHash', () => ({
  computeImageDigest: mocks.computeImageDigest,
}));

vi.mock('@/utils/previewIdempotency', () => ({
  buildPreviewIdempotencyKey: mocks.buildPreviewIdempotencyKey,
}));

vi.mock('@/utils/authGate', () => ({
  shouldRequireAuthGate: () => false,
}));

vi.mock('@/config/featureFlags', () => ({
  ENABLE_PREVIEW_QUERY_EXPERIMENT: false,
}));

vi.mock('@/utils/previewClient', () => ({
  fetchPreviewForStyle: mocks.fetchPreviewForStyle,
}));

vi.mock('@/features/preview', () => ({
  executeStartPreview: vi.fn(),
}));

const mockAuthModalState = {
  registerGateIntent: vi.fn(),
  clearGateIntent: vi.fn(),
  completeGateIntent: vi.fn(),
  consumePendingIntent: vi.fn(() => null),
};

vi.mock('@/store/useAuthModal', () => ({
  useAuthModal: {
    getState: () => mockAuthModalState,
  },
}));

const baseStyle: StyleOption = {
  id: 'oil',
  name: 'Oil Painting',
  description: 'test style',
  thumbnail: 'thumb.jpg',
  preview: 'preview.jpg',
  priceModifier: 0,
  thumbnailWebp: null,
  thumbnailAvif: null,
  previewWebp: null,
  previewAvif: null,
};

type MutableState = FounderState & {
  cacheStylePreview: ReturnType<typeof vi.fn>;
  setPreviewState: ReturnType<typeof vi.fn>;
  setStylePreviewState: ReturnType<typeof vi.fn>;
  evaluateStyleGate: ReturnType<typeof vi.fn>;
  hydrateEntitlements: ReturnType<typeof vi.fn>;
  updateEntitlementsFromResponse: ReturnType<typeof vi.fn>;
  incrementGenerationCount: ReturnType<typeof vi.fn>;
  setShowTokenToast: ReturnType<typeof vi.fn>;
  setPreviewStatus: ReturnType<typeof vi.fn>;
  startStylePreview: ReturnType<typeof vi.fn>;
  getCachedStylePreview: ReturnType<typeof vi.fn>;
  setCurrentImageHash: ReturnType<typeof vi.fn>;
};

const createState = (): MutableState => {
  const state = {
    styles: [baseStyle],
    previewStatus: 'idle' as FounderState['previewStatus'],
    previewGenerationPromise: null,
    previews: { [baseStyle.id]: { status: 'idle' as const } },
    pendingStyleId: null,
    stylePreviewStatus: 'idle' as FounderState['stylePreviewStatus'],
    stylePreviewMessage: null as string | null,
    stylePreviewError: null as string | null,
    stylePreviewStartAt: null as number | null,
    firstPreviewCompleted: false,
    entitlements: {
      status: 'ready' as const,
      tier: 'free',
      quota: null,
      remainingTokens: null,
      requiresWatermark: true,
      priority: 'normal',
      renewAt: null,
      lastSyncedAt: null,
      error: null,
    },
    showTokenToast: false,
    showQuotaModal: false,
    generationCount: 0,
    croppedImage: 'data:image/png;base64,1',
    uploadedImage: null,
    originalImage: null,
    smartCrops: {} as FounderState['smartCrops'],
    orientation: 'square' as const,
    sessionUser: { id: 'user-1', email: null },
    accessToken: 'token',
    orientationPreviewPending: false,
    currentImageHash: 'abc123',
    originalImageStoragePath: null,
    originalImagePublicUrl: null,
    originalImageSignedUrl: null,
    originalImageSignedUrlExpiresAt: null,
    celebrationAt: null,
  } as MutableState;

  state.setPreviewState = vi.fn((id: string, previewState) => {
    state.previews[id] = previewState;
  });
  state.setStylePreviewState = vi.fn((status, message = null, error = null) => {
    state.stylePreviewStatus = status;
    state.stylePreviewMessage = message;
    state.stylePreviewError = status === 'error' ? error : null;
  });
  state.cacheStylePreview = vi.fn();
  state.getCachedStylePreview = vi.fn(() => undefined);
  state.evaluateStyleGate = vi.fn(() => ({ allowed: true }));
  state.hydrateEntitlements = vi.fn(async () => {});
  state.updateEntitlementsFromResponse = vi.fn();
  state.incrementGenerationCount = vi.fn(() => {
    state.generationCount += 1;
  });
  state.setShowTokenToast = vi.fn((show: boolean) => {
    state.showTokenToast = show;
  });
  state.setPreviewStatus = vi.fn((status) => {
    state.previewStatus = status;
  });
  state.startStylePreview = vi.fn(() => Promise.resolve());
  state.setCurrentImageHash = vi.fn((hash: string) => {
    state.currentImageHash = hash;
  });

  return state;
};

const buildRuntime = (state: MutableState): PreviewEngineRuntime => {
  const setFn: PreviewEngineRuntime['set'] = (updater, replace) => {
    if (replace) {
      throw new Error('replace not supported in tests');
    }
    const partial = typeof updater === 'function' ? (updater as (s: FounderState) => Partial<FounderState>)(state) : updater;
    Object.assign(state, partial);
  };

  const getFn = () => state as FounderState;

  return {
    set: setFn,
    get: getFn,
    debugPreviewStage: vi.fn(),
    abortControllerRef: { current: null as AbortController | null },
  };
};

describe('previewEngine/core', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthModalState.registerGateIntent.mockReset();
    mockAuthModalState.clearGateIntent.mockReset();
    mockAuthModalState.completeGateIntent.mockReset();
    mockAuthModalState.consumePendingIntent.mockReset();
    mockAuthModalState.consumePendingIntent.mockReturnValue(null);
    (globalThis as unknown as { window: typeof globalThis }).window = {
      setTimeout,
      clearTimeout,
    } as unknown as Window & typeof globalThis;
  });

  it('uses cached preview when available and skips network', async () => {
    const state = createState();
    const cachedEntry = {
      url: 'cached.jpg',
      orientation: 'square' as const,
      generatedAt: Date.now() - 1000,
    };
    state.getCachedStylePreview.mockReturnValue(cachedEntry);
    const runtime = buildRuntime(state);

    await startStylePreviewFlow(runtime, baseStyle, {});

    expect(mocks.startFounderPreviewGeneration).not.toHaveBeenCalled();
    expect(state.setPreviewState).toHaveBeenCalledWith(
      baseStyle.id,
      expect.objectContaining({
        status: 'ready',
        data: expect.objectContaining({ previewUrl: 'cached.jpg' }),
      })
    );
    expect(state.cacheStylePreview).not.toHaveBeenCalled();
  });

  it('keeps the last successful artwork when generation fails', async () => {
    const state = createState();
    state.getCachedStylePreview.mockReturnValue(undefined);
    state.previews[baseStyle.id] = {
      status: 'ready',
      data: {
        previewUrl: 'https://cdn.example.com/last-art.jpg',
        watermarkApplied: false,
        startedAt: 1,
        completedAt: 2,
      },
      orientation: 'square',
    };
    mocks.startFounderPreviewGeneration.mockRejectedValueOnce(new Error('provider failed'));
    const runtime = buildRuntime(state);

    await startStylePreviewFlow(runtime, baseStyle, { force: true });

    expect(state.setPreviewState).toHaveBeenCalledWith(
      baseStyle.id,
      expect.objectContaining({
        status: 'error',
        data: expect.objectContaining({ previewUrl: 'https://cdn.example.com/last-art.jpg' }),
      })
    );
    expect(state.previews[baseStyle.id]?.data?.previewUrl).toBe('https://cdn.example.com/last-art.jpg');
  });

  it('emits telemetry and caches result on fresh preview generation', async () => {
    const state = createState();
    state.getCachedStylePreview.mockReturnValue(undefined);
    const runtime = buildRuntime(state);
    state.currentImageHash = 'base-hash';
    const resultPayload = {
      previewUrl: 'network.jpg',
      requiresWatermark: true,
      storageUrl: 'storage.jpg',
      storagePath: 'path',
      sourceStoragePath: null,
      sourceDisplayUrl: null,
      previewLogId: 'log',
      cropConfig: null,
      remainingTokens: 5,
      tier: 'free',
      priority: 'normal',
      softRemaining: null,
    };
    mocks.startFounderPreviewGeneration.mockResolvedValue(resultPayload);

    await startStylePreviewFlow(runtime, baseStyle, {});

    expect(mocks.startFounderPreviewGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.emitStepOneEvent).toHaveBeenCalledWith({ type: 'preview', styleId: baseStyle.id, status: 'start' });
    expect(mocks.emitStepOneEvent).toHaveBeenCalledWith({ type: 'preview', styleId: baseStyle.id, status: 'complete' });
    expect(mocks.logPreviewStage).toHaveBeenCalledWith(
      expect.objectContaining({ styleId: baseStyle.id, stage: 'complete' })
    );
    expect(state.cacheStylePreview).toHaveBeenCalledWith(
      baseStyle.id,
      expect.objectContaining({ url: 'network.jpg' })
    );
  });

  it('resumes pending auth preview via auth modal intent', async () => {
    const state = createState();
    state.startStylePreview = vi.fn(() => Promise.resolve());
    mockAuthModalState.consumePendingIntent.mockReturnValue({
      styleId: baseStyle.id,
      options: { force: true },
    });
    const runtime = buildRuntime(state);

    await resumePendingAuthPreviewFlow(runtime);

    expect(mockAuthModalState.consumePendingIntent).toHaveBeenCalled();
    expect(state.startStylePreview).toHaveBeenCalledWith(baseStyle, { force: true });
  });

  it('generates previews for styles needing regeneration', async () => {
    const state = createState();
    state.previews[baseStyle.id] = { status: 'idle' };
    mocks.fetchPreviewForStyle.mockResolvedValue({
      previewUrl: 'prefetch.jpg',
      watermarkApplied: true,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
    const runtime = buildRuntime(state);

    await generatePreviewsFlow(runtime, [baseStyle.id], { force: true });

    expect(mocks.fetchPreviewForStyle).toHaveBeenCalledWith(baseStyle, expect.any(String));
  });
});

describe('previewEngine loader proxy', () => {
  it('delegates startStylePreview through the loader', async () => {
    const state = createState();
    state.getCachedStylePreview.mockReturnValue(undefined);
    state.currentImageHash = 'base-hash';
    const runtime = buildRuntime(state);
    const resultPayload = {
      previewUrl: 'network.jpg',
      requiresWatermark: true,
      storageUrl: 'storage.jpg',
      storagePath: 'path',
      sourceStoragePath: null,
      sourceDisplayUrl: null,
      previewLogId: 'log',
      cropConfig: null,
      remainingTokens: 5,
      tier: 'free',
      priority: 'normal',
      softRemaining: null,
    };
    mocks.startFounderPreviewGeneration.mockResolvedValue(resultPayload);

    await startStylePreviewEngine(runtime, baseStyle, {});

    expect(mocks.startFounderPreviewGeneration).toHaveBeenCalledTimes(1);
    const statuses = mocks.emitStepOneEvent.mock.calls
      .map(([payload]) => payload.status)
      .filter((status): status is string => Boolean(status));
    expect(statuses).toEqual(['start', 'complete']);
    expect(mocks.buildPreviewIdempotencyKey).toHaveBeenCalledWith({
      styleId: baseStyle.id,
      orientation: 'square',
      imageHash: expect.any(String),
      sessionUserId: state.sessionUser?.id ?? null,
    });
  });

  it('aborts preview generation via loader helper', async () => {
    const state = createState();
    state.pendingStyleId = baseStyle.id;
    const runtime = buildRuntime(state);
    const abortSpy = vi.fn();
    runtime.abortControllerRef.current = { abort: abortSpy } as unknown as AbortController;

    await abortPreviewGenerationEngine(runtime);

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(state.pendingStyleId).toBeNull();
  });
});
