import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import StudioHeader, { type CheckoutNotice } from '@/sections/studio/components/StudioHeader';
import CenterStage from '@/sections/studio/experience/CenterStage';
import {
  StudioOverlayProvider,
  useStudioExperienceContext,
} from '@/sections/studio/experience/context';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioEntitlementState } from '@/store/hooks/studio/useStudioEntitlementState';
import { useStudioActions } from '@/store/hooks/studio/useStudioActions';
import { useOrientationBridge } from '@/components/studio/orientation/useOrientationBridge';
import LeftRail from '@/sections/studio/experience/LeftRail';
import RightRail from '@/sections/studio/experience/RightRail';
import StudioOverlays from '@/sections/studio/experience/StudioOverlays';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

const TokenWarningBanner = lazy(() => import('@/components/studio/TokenWarningBanner'));

export type StudioExperienceProps = {
  checkoutNotice?: CheckoutNotice | null;
  onDismissCheckoutNotice?: () => void;
};

const StudioExperience = ({ checkoutNotice, onDismissCheckoutNotice }: StudioExperienceProps) => {
  const { renderFeedback } = useStudioExperienceContext();
  const { currentStyle, hasCroppedImage } = useStudioPreviewState();
  const { entitlements } = useStudioEntitlementState();
  const { openCanvasModal, hydrateEntitlements } = useStudioActions();
  const { rules } = useProductSurface();
  const { requestOrientationChange, orientationChanging } = useOrientationBridge();

  const [showDownloadUpgradeModal, setShowDownloadUpgradeModal] = useState(false);
  const [mobileStyleDrawerOpen, setMobileStyleDrawerOpen] = useState(false);
  const [showCanvasUpsellToast, setShowCanvasUpsellToast] = useState(false);

  const openDownloadUpgrade = useCallback(() => {
    setShowDownloadUpgradeModal(true);
  }, []);
  const closeDownloadUpgrade = useCallback(() => {
    setShowDownloadUpgradeModal(false);
  }, []);
  const showCanvasUpsell = useCallback(() => {
    setShowCanvasUpsellToast(true);
  }, []);
  const hideCanvasUpsell = useCallback(() => {
    setShowCanvasUpsellToast(false);
  }, []);
  const handleCanvasFallback = useCallback(() => {
    // Modal is the sole entry point; fallback no longer needed but retained for parity.
  }, []);
  const setMobileDrawerOpen = useCallback((open: boolean) => {
    setMobileStyleDrawerOpen(open);
  }, []);

  const handleOpenCanvas = useCallback(
    (source: 'center' | 'rail') => {
      if (!hasCroppedImage) {
        return;
      }

      openCanvasModal(source);
    },
    [hasCroppedImage, openCanvasModal]
  );

  const overlayContextValue = useMemo(
    () => ({
      isDownloadUpgradeOpen: showDownloadUpgradeModal,
      openDownloadUpgrade,
      closeDownloadUpgrade,
      isCanvasUpsellToastVisible: showCanvasUpsellToast,
      showCanvasUpsellToast: showCanvasUpsell,
      hideCanvasUpsellToast: hideCanvasUpsell,
      isMobileDrawerOpen: mobileStyleDrawerOpen,
      setMobileDrawerOpen,
    }),
    [
      showDownloadUpgradeModal,
      openDownloadUpgrade,
      closeDownloadUpgrade,
      showCanvasUpsellToast,
      showCanvasUpsell,
      hideCanvasUpsell,
      mobileStyleDrawerOpen,
      setMobileDrawerOpen,
    ]
  );

  useEffect(() => {
    if (entitlements.status === 'idle') {
      void hydrateEntitlements();
    }
  }, [entitlements.status, hydrateEntitlements]);

  return (
    <StudioOverlayProvider value={overlayContextValue}>
      <section
        className="relative min-h-screen bg-slate-900"
        data-studio-section
        data-founder-anchor="studio"
        id="studio"
      >
        <StudioHeader
          currentStyleName={currentStyle?.name}
          checkoutNotice={checkoutNotice}
          onDismissCheckoutNotice={onDismissCheckoutNotice}
        />

        {!rules.hideTokenPacks && (
          <Suspense fallback={null}>
            <TokenWarningBanner />
          </Suspense>
        )}

        <div className="mx-auto block max-w-[1800px] lg:flex">
          <LeftRail />

          <CenterStage
            onOpenCanvas={handleOpenCanvas}
            onCanvasConfigToggle={handleCanvasFallback}
            onRequestOrientationChange={requestOrientationChange}
            orientationChanging={orientationChanging}
          />

          {!rules.hideCanvasRail && (
            <RightRail
              onRequestCanvas={handleOpenCanvas}
            />
          )}
        </div>

        <StudioOverlays onRequestCanvas={handleOpenCanvas} />

        {renderFeedback()}
      </section>
    </StudioOverlayProvider>
  );
};

export default StudioExperience;
