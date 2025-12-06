/**
 * @vitest-environment jsdom
 */
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StudioExperienceProvider, StudioOverlayProvider } from '@/sections/studio/experience/context';
import { useGalleryHandlers } from '@/hooks/studio/useGalleryHandlers';

vi.mock('@/store/hooks/studio/useStudioPreviewState', () => ({
  useStudioPreviewState: vi.fn(),
}));

vi.mock('@/store/hooks/studio/useStudioEntitlementState', () => ({
  useStudioEntitlementState: vi.fn(),
}));

vi.mock('@/store/hooks/studio/useStudioUserState', () => ({
  useStudioUserState: vi.fn(),
}));

vi.mock('@/store/useAuthModal', () => ({
  useAuthModal: vi.fn(),
}));

vi.mock('@/utils/galleryApi', () => ({
  saveToGallery: vi.fn(),
}));

const { useStudioPreviewState } = await import('@/store/hooks/studio/useStudioPreviewState');
const { useStudioEntitlementState } = await import('@/store/hooks/studio/useStudioEntitlementState');
const { useStudioUserState } = await import('@/store/hooks/studio/useStudioUserState');
const { useAuthModal } = await import('@/store/useAuthModal');
const { saveToGallery } = await import('@/utils/galleryApi');

describe('useGalleryHandlers', () => {
  const showToast = vi.fn();
  const showUpgradeModal = vi.fn();
  const openDownloadUpgrade = vi.fn();
  const closeDownloadUpgrade = vi.fn();
  const showCanvasUpsellToast = vi.fn();
  const hideCanvasUpsellToast = vi.fn();
  const setMobileDrawerOpen = vi.fn();
  const openAuthModal = vi.fn();

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

  const renderGalleryHook = async () => {
    let renderer: ReactTestRenderer;
    const latest: { current: ReturnType<typeof useGalleryHandlers> | null } = { current: null };

    const Bridge = () => {
      const handlers = useGalleryHandlers();
      useEffect(() => {
        latest.current = handlers;
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

    if (!latest.current) {
      throw new Error('Gallery handlers did not initialize');
    }

    return {
      getHandlers: () => {
        if (!latest.current) {
          throw new Error('Gallery handlers not available');
        }
        return latest.current;
      },
      unmount: () => renderer.unmount(),
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    showToast.mockClear();
    showUpgradeModal.mockClear();
    openDownloadUpgrade.mockClear();
    closeDownloadUpgrade.mockClear();
    showCanvasUpsellToast.mockClear();
    hideCanvasUpsellToast.mockClear();
    setMobileDrawerOpen.mockClear();
    openAuthModal.mockClear();
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: null,
      preview: null,
      orientation: 'square',
    });
    (useStudioEntitlementState as vi.Mock).mockReturnValue({
      requiresWatermark: false,
      userTier: 'free',
    });
    (useStudioUserState as vi.Mock).mockReturnValue({
      sessionUser: null,
      sessionAccessToken: null,
    });
    (useAuthModal as vi.Mock).mockImplementation((selector: (state: { openModal: typeof openAuthModal }) => unknown) =>
      selector({ openModal: openAuthModal })
    );
    (saveToGallery as vi.Mock).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('warns when no preview is available', async () => {
    (useStudioUserState as vi.Mock).mockReturnValue({
      sessionUser: { id: 'user-1' },
      sessionAccessToken: 'token',
    });

    const { getHandlers, unmount } = await renderGalleryHook();

    await act(async () => {
      await getHandlers().handleSaveToGallery();
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Upload required',
      })
    );
    expect(getHandlers().savingToGallery).toBe(false);
    expect(openAuthModal).not.toHaveBeenCalled();

    unmount();
  });

  it('prompts authentication when user is not logged in', async () => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: { id: 'style-1', name: 'Aurora Dreams' },
      preview: {
        data: {
          previewUrl: 'https://cdn.example.com/watermark.jpg',
          storagePath: null,
          storageUrl: null,
        },
        status: 'ready',
      },
      orientation: 'square',
    });

    const { getHandlers, unmount } = await renderGalleryHook();

    await act(async () => {
      await getHandlers().handleSaveToGallery();
    });

    expect(openAuthModal).toHaveBeenCalledWith('signup', {
      source: 'gallery-save',
      styleId: 'style-1',
    });
    expect(saveToGallery).not.toHaveBeenCalled();

    unmount();
  });

  it('saves preview to gallery and emits success toast', async () => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: { id: 'style-2', name: 'Golden Hour' },
      preview: {
        data: {
          previewUrl: 'https://cdn.example.com/preview.jpg',
          storagePath: 'preview-cache/user123.jpg',
          storageUrl: null,
          previewLogId: 'log-123',
        },
        status: 'ready',
      },
      orientation: 'square',
    });
    (useStudioUserState as vi.Mock).mockReturnValue({
      sessionUser: { id: 'user-1' },
      sessionAccessToken: 'token',
    });
    (saveToGallery as vi.Mock).mockResolvedValue({
      success: true,
      alreadyExists: false,
    });

    const { getHandlers, unmount } = await renderGalleryHook();

    await act(async () => {
      await getHandlers().handleSaveToGallery();
    });

    expect(saveToGallery).toHaveBeenCalledWith(
      expect.objectContaining({
        previewLogId: 'log-123',
        styleId: 'style-2',
        orientation: 'square',
        storagePath: 'preview-cache/user123.jpg',
        accessToken: 'token',
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Saved to gallery',
      })
    );
    expect(getHandlers().savedToGallery).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(getHandlers().savedToGallery).toBe(false);

    unmount();
  });

  it('shows info toast when preview already exists', async () => {
    (useStudioPreviewState as vi.Mock).mockReturnValue({
      currentStyle: { id: 'style-3', name: 'Midnight Muse' },
      preview: {
        data: {
          previewUrl: 'https://cdn.example.com/preview.jpg',
          storagePath: 'preview-cache/user999.jpg',
          storageUrl:
            'https://fvjganetpyyrguuxjtqi.supabase.co/storage/v1/object/public/preview-cache/user999.jpg',
          previewLogId: 'log-777',
        },
        status: 'ready',
      },
      orientation: 'horizontal',
    });
    (useStudioUserState as vi.Mock).mockReturnValue({
      sessionUser: { id: 'user-2' },
      sessionAccessToken: 'token',
    });
    (saveToGallery as vi.Mock).mockResolvedValue({
      success: true,
      alreadyExists: true,
    });

    const { getHandlers, unmount } = await renderGalleryHook();

    await act(async () => {
      await getHandlers().handleSaveToGallery();
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Already saved',
      })
    );

    unmount();
  });
});
