/**
 * @vitest-environment jsdom
 */
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StudioExperienceProvider, StudioOverlayProvider } from '@/sections/studio/experience/context';
import { useDownloadHandlers } from '@/hooks/studio/useDownloadHandlers';

vi.mock('@/store/hooks/studio/useStudioPreviewState', () => ({
  useStudioPreviewState: vi.fn(),
}));

vi.mock('@/store/hooks/studio/useStudioUserState', () => ({
  useStudioUserState: vi.fn(),
}));

vi.mock('@/utils/artworkDownload', () => ({
  requestArtworkDownload: vi.fn(),
  triggerBrowserDownload: vi.fn(),
}));

vi.mock('@/utils/telemetry', () => ({
  trackPaywallShown: vi.fn(),
}));

const { useStudioPreviewState } = await import('@/store/hooks/studio/useStudioPreviewState');
const { useStudioUserState } = await import('@/store/hooks/studio/useStudioUserState');
const { requestArtworkDownload, triggerBrowserDownload } = await import('@/utils/artworkDownload');
const { trackPaywallShown } = await import('@/utils/telemetry');

describe('useDownloadHandlers', () => {
  const showToast = vi.fn();
  const showUpgradeModal = vi.fn();
  const openDownloadUpgrade = vi.fn();
  const closeDownloadUpgrade = vi.fn();
  const showCanvasUpsellToast = vi.fn();
  const hideCanvasUpsellToast = vi.fn();
  const setMobileDrawerOpen = vi.fn();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <StudioExperienceProvider value={{ showToast, showUpgradeModal, renderFeedback: () => null }}>
      <StudioOverlayProvider
        value={{
          isDownloadUpgradeOpen: false,
          openDownloadUpgrade,
          closeDownloadUpgrade,
          isCanvasUpsellToastVisible: false,
          showCanvasUpsellToast,
          hideCanvasUpsellToast,
          isMobileDrawerOpen: false,
          setMobileDrawerOpen,
        }}
      >
        {children}
      </StudioOverlayProvider>
    </StudioExperienceProvider>
  );

  const renderDownloadHook = async () => {
    let renderer: ReactTestRenderer;
    let resolveHandlers: (handlers: ReturnType<typeof useDownloadHandlers>) => void;
    const handlersPromise = new Promise<ReturnType<typeof useDownloadHandlers>>((resolve) => {
      resolveHandlers = resolve;
    });

    const Bridge = () => {
      const handlers = useDownloadHandlers();
      useEffect(() => {
        resolveHandlers!(handlers);
      }, [handlers]);
      return null;
    };

    await act(async () => {
      renderer = create(
        <Wrapper>
          <Bridge />
        </Wrapper>
      );
    });

    const handlers = await handlersPromise;

    return {
      handlers,
      unmount: () => renderer.unmount(),
    };
  };

  beforeEach(() => {
    showToast.mockClear();
    showUpgradeModal.mockClear();
    openDownloadUpgrade.mockClear();
    closeDownloadUpgrade.mockClear();
    showCanvasUpsellToast.mockClear();
    hideCanvasUpsellToast.mockClear();
    setMobileDrawerOpen.mockClear();
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: null,
      preview: null,
    });
    (useStudioUserState as vi.Mock).mockReturnValue({
      sessionAccessToken: 'token',
    });
    (requestArtworkDownload as vi.Mock).mockReset();
    (triggerBrowserDownload as vi.Mock).mockReset();
    (trackPaywallShown as vi.Mock).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when download is requested without a preview', async () => {
    const { handlers, unmount } = await renderDownloadHook();

    await act(async () => {
      await handlers.handleDownloadHD();
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'File unavailable',
      })
    );
    expect(handlers.downloadingHD).toBe(false);

    unmount();
  });

  it('does not download the display preview and shows the paywall when entitlement is missing', async () => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: { id: 'style-1', name: 'Aurora Dreams' },
      preview: {
        data: {
          previewUrl: 'https://cdn.example.com/display.jpg',
          previewLogId: 'log-1',
        },
        status: 'ready',
      },
    });
    (requestArtworkDownload as vi.Mock).mockResolvedValue({ status: 'paywall' });

    const { handlers, unmount } = await renderDownloadHook();

    await act(async () => {
      await handlers.handleDownloadHD();
    });

    expect(requestArtworkDownload).toHaveBeenCalledWith({
      previewLogId: 'log-1',
      accessToken: 'token',
    });
    expect(triggerBrowserDownload).not.toHaveBeenCalled();
    expect(openDownloadUpgrade).toHaveBeenCalledTimes(1);
    expect(trackPaywallShown).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('downloads the entitled full-resolution file via the artwork endpoint', async () => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: { id: 'style-2', name: 'Golden Hour' },
      preview: {
        data: {
          previewUrl: 'https://cdn.example.com/display.jpg',
          previewLogId: 'log-2',
        },
        status: 'ready',
      },
    });
    (requestArtworkDownload as vi.Mock).mockResolvedValue({
      status: 'entitled',
      downloadUrl: 'https://signed.example/clean.jpg',
    });

    const { handlers, unmount } = await renderDownloadHook();

    await act(async () => {
      await handlers.handleDownloadHD();
    });

    expect(triggerBrowserDownload).toHaveBeenCalledWith(
      'https://signed.example/clean.jpg',
      expect.stringContaining('wondertone-golden-hour')
    );
    expect(openDownloadUpgrade).not.toHaveBeenCalled();

    unmount();
  });
});
