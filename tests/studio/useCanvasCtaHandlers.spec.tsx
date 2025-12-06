/**
 * @vitest-environment jsdom
 */
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCanvasCtaHandlers } from '@/hooks/studio/useCanvasCtaHandlers';

vi.mock('@/store/hooks/studio/useStudioPreviewState', () => ({
  useStudioPreviewState: vi.fn(),
}));

vi.mock('@/utils/studioV2Analytics', () => ({
  trackStudioV2CanvasCtaClick: vi.fn(),
  trackStudioV2OrientationCta: vi.fn(),
}));

vi.mock('@/store/hooks/useFounderCanvasStore', () => ({
  useCanvasConfigState: vi.fn(),
}));

vi.mock('@/store/hooks/useEntitlementsStore', () => ({
  useEntitlementsState: vi.fn(),
}));

vi.mock('@/utils/telemetry', () => ({
  trackOrderStarted: vi.fn(),
  trackRuntimeMetric: vi.fn(),
}));

const { useStudioPreviewState } = await import('@/store/hooks/studio/useStudioPreviewState');
const { trackStudioV2CanvasCtaClick, trackStudioV2OrientationCta } = await import('@/utils/studioV2Analytics');
const { useCanvasConfigState } = await import('@/store/hooks/useFounderCanvasStore');
const { useEntitlementsState } = await import('@/store/hooks/useEntitlementsStore');
const { trackOrderStarted, trackRuntimeMetric } = await import('@/utils/telemetry');

describe('useCanvasCtaHandlers', () => {
  const defaultPreviewState = {
    currentStyle: { id: 'style-1', name: 'Aurora Dreams' },
    hasCroppedImage: true,
    orientation: 'square' as const,
    orientationPreviewPending: false,
    previewHasData: true,
    previewReady: true,
    preview: null,
    pendingStyleId: null,
    stylePreviewStatus: 'ready' as const,
    stylePreviewMessage: null,
    stylePreviewError: null,
    croppedImage: 'preview-data',
    previewStateStatus: 'ready' as const,
    orientationMismatch: false,
  };

  const setupPreviewState = (overrides: Partial<typeof defaultPreviewState> = {}) => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      ...defaultPreviewState,
      ...overrides,
    });
  };

  const renderHandlers = async (props: {
    onOpenCanvas: (source: 'center' | 'rail') => void;
    onOrientationFallback: () => void;
    requestOrientationChange: (orientation: 'square' | 'horizontal' | 'vertical') => Promise<void>;
  }) => {
    let renderer: ReactTestRenderer;
    const latest: { current: ReturnType<typeof useCanvasCtaHandlers> | null } = { current: null };

    const Bridge = ({ children }: { children?: ReactNode }) => {
      const handlers = useCanvasCtaHandlers(props);
      useEffect(() => {
        latest.current = handlers;
      }, [handlers]);
      return <>{children}</>;
    };

    await act(async () => {
      renderer = create(<Bridge />);
    });

    if (!latest.current) {
      throw new Error('Failed to initialize canvas CTA handlers');
    }

    return {
      getHandlers: () => {
        if (!latest.current) {
          throw new Error('Handlers unavailable');
        }
        return latest.current;
      },
      unmount: () => renderer.unmount(),
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    trackStudioV2CanvasCtaClick.mockClear();
    trackStudioV2OrientationCta.mockClear();
    trackRuntimeMetric.mockClear();
    setupPreviewState();
    const computedTotal = vi.fn().mockReturnValue(249);
    (useCanvasConfigState as vi.Mock).mockReturnValue({
      enhancements: [],
      computedTotal,
    });
    (useEntitlementsState as vi.Mock).mockReturnValue({
      userTier: 'free',
    });
    (trackOrderStarted as vi.Mock).mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tracks center canvas CTA with throttling', async () => {
    const onOpenCanvas = vi.fn();
    const { getHandlers, unmount } = await renderHandlers({
      onOpenCanvas,
      onOrientationFallback: vi.fn(),
      requestOrientationChange: vi.fn().mockResolvedValue(undefined),
    });

    await act(async () => {
      getHandlers().handleCreateCanvasFromCenter();
      getHandlers().handleCreateCanvasFromCenter();
    });

    expect(trackStudioV2CanvasCtaClick).toHaveBeenCalledTimes(1);
    expect(trackOrderStarted).toHaveBeenCalledTimes(1);
    expect(trackOrderStarted).toHaveBeenCalledWith('free', 249, false);
    expect(onOpenCanvas).toHaveBeenLastCalledWith('center');

    unmount();
  });

  it('invokes orientation change for center CTA with fallback on failure', async () => {
    const onOrientationFallback = vi.fn();
    const requestOrientationChange = vi.fn().mockRejectedValue(new Error('failed'));

    const { getHandlers, unmount } = await renderHandlers({
      onOpenCanvas: vi.fn(),
      onOrientationFallback,
      requestOrientationChange,
    });

    await act(async () => {
      getHandlers().handleChangeOrientationFromCenter();
    });

    expect(trackStudioV2OrientationCta).toHaveBeenCalledTimes(1);
    expect(requestOrientationChange).toHaveBeenCalledWith('square');
    expect(onOrientationFallback).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('tracks rail orientation CTA independently', async () => {
    const onOrientationFallback = vi.fn();
    const requestOrientationChange = vi.fn().mockResolvedValue(undefined);

    const { getHandlers, unmount } = await renderHandlers({
      onOpenCanvas: vi.fn(),
      onOrientationFallback,
      requestOrientationChange,
    });

    await act(async () => {
      getHandlers().handleChangeOrientationFromRail();
      getHandlers().handleChangeOrientationFromRail();
      getHandlers().handleChangeOrientationFromCenter();
    });

    expect(trackStudioV2OrientationCta).toHaveBeenCalledTimes(2);
    expect(requestOrientationChange).toHaveBeenCalledTimes(3);

    unmount();
  });

  it('skips canvas tracking when prerequisites are missing', async () => {
    setupPreviewState({
      hasCroppedImage: false,
      previewHasData: false,
      previewReady: false,
    });

    const onOpenCanvas = vi.fn();
    const { getHandlers, unmount } = await renderHandlers({
      onOpenCanvas,
      onOrientationFallback: vi.fn(),
      requestOrientationChange: vi.fn().mockResolvedValue(undefined),
    });

    await act(async () => {
      getHandlers().handleCreateCanvasFromCenter();
    });

    expect(trackStudioV2CanvasCtaClick).not.toHaveBeenCalled();
    expect(trackOrderStarted).not.toHaveBeenCalled();
    expect(onOpenCanvas).toHaveBeenCalledWith('center');

    unmount();
  });
});
