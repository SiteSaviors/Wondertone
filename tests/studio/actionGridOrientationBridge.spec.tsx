/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import StudioConfigurator from '@/sections/StudioConfigurator';
import { useFounderStore } from '@/store/useFounderStore';
import * as studioAnalytics from '@/utils/studioV2Analytics';

const createTestPreviewEntry = (orientation: string) => ({
  status: 'ready' as const,
  data: {
    previewUrl: 'https://example.com/preview.jpg',
    watermarkApplied: false,
    startedAt: Date.now(),
    completedAt: Date.now(),
  },
  orientation,
});

const waitForButton = async (container: HTMLElement, label: string) => {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const match = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(label)
    );
    if (match) {
      return match as HTMLButtonElement;
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  throw new Error(`Button containing "${label}" not found in time`);
};

const waitUntil = async (assertFn: () => void, timeout = 1000) => {
  let lastError: unknown;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      assertFn();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }
  throw lastError ?? new Error('waitUntil timeout');
};

describe('Studio orientation + canvas CTA integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreState: () => void;
  let previousMatchMedia: typeof window.matchMedia | undefined;
  let previousIntersectionObserver: typeof window.IntersectionObserver | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    previousMatchMedia = window.matchMedia;
    previousIntersectionObserver = (window as typeof window & { IntersectionObserver?: typeof window.IntersectionObserver })
      .IntersectionObserver;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    class MockIntersectionObserver implements Partial<IntersectionObserver> {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });
    (window as typeof window & { __openOrientationCropper?: (orientation?: string) => void }).__openOrientationCropper =
      vi.fn();

    const snapshot = useFounderStore.getState();
    const prevCroppedImage = snapshot.croppedImage;
    const prevOrientationPreviewPending = snapshot.orientationPreviewPending;
    const prevPreviews = JSON.parse(JSON.stringify(snapshot.previews ?? {}));
    const prevEntitlements = snapshot.entitlements ? { ...snapshot.entitlements } : undefined;
    const prevOrientation = snapshot.orientation;

    const styleId = snapshot.selectedStyleId ?? snapshot.styles[0]?.id ?? 'test-style';
    useFounderStore.setState({
      croppedImage: 'data:image/png;base64,test',
      originalImage: 'data:image/png;base64,original',
      orientationPreviewPending: false,
      previews: {
        ...snapshot.previews,
        [styleId]: createTestPreviewEntry(prevOrientation),
      },
      selectedStyleId: styleId,
      entitlements:
        prevEntitlements ?? {
          status: 'ready',
          tier: 'free',
          quota: 10,
          remainingTokens: 5,
          requiresWatermark: false,
          priority: 'normal',
          renewAt: null,
          lastSyncedAt: Date.now(),
          error: null,
        },
    });

    restoreState = () => {
      useFounderStore.setState({
        croppedImage: prevCroppedImage,
        orientationPreviewPending: prevOrientationPreviewPending,
        previews: prevPreviews,
        entitlements: prevEntitlements,
        orientation: prevOrientation,
      });
    };
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    restoreState();
    vi.clearAllMocks();
    if (previousMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: previousMatchMedia,
      });
    } else {
      delete (window as typeof window & { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
    if (previousIntersectionObserver) {
      Object.defineProperty(window, 'IntersectionObserver', {
        writable: true,
        configurable: true,
        value: previousIntersectionObserver,
      });
    } else {
      delete (window as typeof window & { IntersectionObserver?: typeof window.IntersectionObserver }).IntersectionObserver;
    }
    delete (window as typeof window & { __openOrientationCropper?: unknown }).__openOrientationCropper;
  });

  it('routes the ActionGrid orientation CTA through the global cropper bridge with analytics', async () => {
    const cropperSpy = vi.fn();
    (window as typeof window & { __openOrientationCropper?: (orientation?: string) => void }).__openOrientationCropper =
      cropperSpy;
    const orientationAnalyticsSpy = vi.spyOn(studioAnalytics, 'trackStudioV2OrientationCta');

    act(() => {
      root.render(
        <MemoryRouter>
          <StudioConfigurator checkoutNotice={null} />
        </MemoryRouter>
      );
    });

    const orientationButton = await waitForButton(container, 'Change Orientation');

    await act(async () => {
      orientationButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitUntil(() => {
      expect(orientationAnalyticsSpy).toHaveBeenCalledTimes(1);
      expect(cropperSpy).toHaveBeenCalledTimes(1);
    });
    expect(cropperSpy.mock.calls[0][0]).toBe(useFounderStore.getState().orientation);
  });

  it('keeps the center post-reveal CTA on revealed_artwork_full_res only', async () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <StudioConfigurator checkoutNotice={null} />
        </MemoryRouter>
      );
    });

    const fullResButton = await waitForButton(container, 'Get the full-resolution file');
    expect(fullResButton.getAttribute('data-sku')).toBe('revealed_artwork_full_res');
    expect(container.textContent).not.toContain('Create Canvas Art');
    expect(container.textContent).not.toMatch(/ORDERS API COMING SOON/i);
  });
});
