import { Suspense, lazy } from 'react';
import { useStudioOverlayContext } from '@/sections/studio/experience/context';
import { useStudioEntitlementState } from '@/store/hooks/studio/useStudioEntitlementState';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioUiState } from '@/store/hooks/studio/useStudioUiState';
import { useFounderStore } from '@/store/useFounderStore';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

const LivingCanvasModal = lazy(() => import('@/components/studio/LivingCanvasModal'));
const DownloadUpgradeModal = lazy(() => import('@/components/modals/DownloadUpgradeModal'));
const MobileStyleDrawer = lazy(() => import('@/components/studio/MobileStyleDrawer'));
const StockLibraryModal = lazy(() => import('@/components/studio/stock-library/StockLibraryModal'));

const StudioOverlays = () => {
  const {
    isDownloadUpgradeOpen,
    closeDownloadUpgrade,
    isMobileDrawerOpen,
    setMobileDrawerOpen,
  } = useStudioOverlayContext();
  const { entitlements, displayRemainingTokens } = useStudioEntitlementState();
  const { hasCroppedImage } = useStudioPreviewState();
  const { livingCanvasModalOpen } = useStudioUiState();
  const stockLibraryModalOpen = useFounderStore((state) => state.stockLibraryModalOpen);
  const { rules } = useProductSurface();

  return (
    <>
      <Suspense fallback={null}>
        {!rules.hideLivingCanvas && livingCanvasModalOpen && <LivingCanvasModal />}
      </Suspense>

      <Suspense fallback={null}>
        <DownloadUpgradeModal isOpen={isDownloadUpgradeOpen} onClose={closeDownloadUpgrade} />
      </Suspense>

      <Suspense fallback={null}>
        <MobileStyleDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          hasCroppedImage={hasCroppedImage}
          remainingTokens={displayRemainingTokens}
          userTier={entitlements.tier}
        />
      </Suspense>

      <Suspense fallback={null}>
        {!rules.hideStockLibrary && stockLibraryModalOpen && <StockLibraryModal />}
      </Suspense>
    </>
  );
};

export default StudioOverlays;
