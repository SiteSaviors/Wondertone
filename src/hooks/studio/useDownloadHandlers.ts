import { useCallback, useEffect, useRef, useState } from 'react';
import { requestArtworkDownload, triggerBrowserDownload } from '@/utils/artworkDownload';
import { trackPaywallShown } from '@/utils/telemetry';
import { useStudioExperienceContext, useStudioOverlayContext } from '@/sections/studio/experience/context';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioUserState } from '@/store/hooks/studio/useStudioUserState';

export const useDownloadHandlers = () => {
  const { showToast } = useStudioExperienceContext();
  const {
    openDownloadUpgrade,
    hideCanvasUpsellToast,
  } = useStudioOverlayContext();
  const { sessionAccessToken } = useStudioUserState();
  const { currentStyle, preview } = useStudioPreviewState();

  const [downloadingHD, setDownloadingHD] = useState(false);
  const paywallShownRef = useRef(false);

  useEffect(() => {
    paywallShownRef.current = false;
  }, [currentStyle?.id, preview?.data?.previewLogId]);

  useEffect(() => {
    return () => {
      hideCanvasUpsellToast();
    };
  }, [hideCanvasUpsellToast]);

  const handleDownloadHD = useCallback(async () => {
    if (!currentStyle || !preview?.data) {
      showToast({
        title: 'File unavailable',
        description: 'Reveal a style before requesting the full-resolution file.',
        variant: 'warning',
      });
      return;
    }

    setDownloadingHD(true);

    try {
      const result = await requestArtworkDownload({
        previewLogId: preview.data.previewLogId,
        accessToken: sessionAccessToken,
      });

      if (result.status === 'paywall') {
        if (!paywallShownRef.current) {
          paywallShownRef.current = true;
          trackPaywallShown();
        }
        openDownloadUpgrade();
        return;
      }

      if (result.status === 'error') {
        showToast({
          title: 'Download unavailable',
          description: result.message,
          variant: 'warning',
        });
        return;
      }

      const filename = `wondertone-${currentStyle.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
      triggerBrowserDownload(result.downloadUrl, filename);
    } catch (_error) {
      showToast({
        title: 'Download failed',
        description: 'Please try again in a moment.',
        variant: 'error',
      });
    } finally {
      setDownloadingHD(false);
    }
  }, [
    currentStyle,
    openDownloadUpgrade,
    preview?.data,
    sessionAccessToken,
    showToast,
  ]);

  return {
    downloadingHD,
    handleDownloadHD,
  };
};

