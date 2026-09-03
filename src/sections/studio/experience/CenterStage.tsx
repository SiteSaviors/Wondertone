import { useCallback } from 'react';
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import {
  trackLaunchflowEmptyStateInteraction,
  trackLaunchflowOpened,
} from '@/utils/launchflowTelemetry';
import { usePreviewEntry } from '@/store/hooks/usePreviewStore';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioEntitlementState } from '@/store/hooks/studio/useStudioEntitlementState';
import { useStudioUiState } from '@/store/hooks/studio/useStudioUiState';
import { useStudioActions } from '@/store/hooks/studio/useStudioActions';
import type { StylePreviewStatus } from '@/store/founder/storeTypes';
import CanvasPreviewPanel from '@/sections/studio/components/CanvasPreviewPanel';
import { useDownloadHandlers } from '@/hooks/studio/useDownloadHandlers';
import { useGalleryHandlers } from '@/hooks/studio/useGalleryHandlers';
import { useCanvasCtaHandlers } from '@/hooks/studio/useCanvasCtaHandlers';
import { useFounderStore } from '@/store/useFounderStore';

type CenterStageProps = {
  onOpenCanvas: (source: 'center' | 'rail') => void;
  onCanvasConfigToggle: () => void;
  onRequestOrientationChange: (orientation: 'square' | 'horizontal' | 'vertical') => Promise<void>;
  orientationChanging: boolean;
};

const CenterStage = ({
  onOpenCanvas,
  onCanvasConfigToggle,
  onRequestOrientationChange,
  orientationChanging,
}: CenterStageProps) => {
  const {
    styles,
    currentStyle,
    currentStyleId,
    croppedImage,
    orientation,
    pendingStyleId,
    stylePreviewStatus,
    stylePreviewMessage,
    stylePreviewError,
    orientationPreviewPending,
    preview,
    hasCroppedImage,
    previewHasData,
    orientationMismatch,
  } = useStudioPreviewState();
  const { launchpadExpanded } = useStudioUiState();
  const { isPremiumUser } = useStudioEntitlementState();
  const { setLaunchpadExpanded } = useStudioActions();
  const { openStockLibrary, requestUpload } = useFounderStore((state) => ({
    openStockLibrary: state.openStockLibrary,
    requestUpload: state.requestUpload,
  }));
  const previewEntry = usePreviewEntry(currentStyleId ?? null);
  const previewOrientationLabel = previewEntry?.orientation
    ? ORIENTATION_PRESETS[previewEntry.orientation].label
    : null;

  const { handleDownloadHD, downloadingHD } = useDownloadHandlers();
  const { handleSaveToGallery, savingToGallery, savedToGallery } = useGalleryHandlers();
  const { handleCreateCanvasFromCenter, handleChangeOrientationFromCenter } = useCanvasCtaHandlers({
    onOpenCanvas,
    onOrientationFallback: onCanvasConfigToggle,
    requestOrientationChange: onRequestOrientationChange,
  });

  const overlayStyleName =
    (pendingStyleId ? styles.find((style) => style.id === pendingStyleId)?.name : currentStyle?.name) ??
    'Selected Style';
  const previewLocked = Boolean(pendingStyleId);
  type OverlayStatus = Exclude<StylePreviewStatus, 'idle'>;
  const overlayStatus: OverlayStatus = stylePreviewStatus === 'idle' ? 'animating' : stylePreviewStatus;
  const displayPreviewUrl = preview?.data?.previewUrl ?? croppedImage ?? undefined;

  const downloadDisabled = !currentStyle || !hasCroppedImage || orientationPreviewPending || !previewHasData;
  const canvasLocked = !hasCroppedImage || orientationPreviewPending;

  const handleOpenLaunchflowFromEmptyState = useCallback(() => {
    trackLaunchflowEmptyStateInteraction('open_launchflow');
    if (!launchpadExpanded) {
      trackLaunchflowOpened('empty_state');
    }
    setLaunchpadExpanded(true);
    const launchflowSection = document.getElementById('launchflow');
    launchflowSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [launchpadExpanded, setLaunchpadExpanded]);

  const handleBrowseStylesFromEmptyState = useCallback(() => {
    trackLaunchflowEmptyStateInteraction('browse_styles');
    openStockLibrary();
  }, [openStockLibrary]);

  const handleUploadNewPhotoFromCanvas = useCallback(() => {
    requestUpload();
    const launchflowSection = document.getElementById('launchflow');
    launchflowSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [requestUpload]);

  return (
    <div className="min-w-0 w-full" data-studio-center>
      <CanvasPreviewPanel
        overlayStyleName={overlayStyleName}
        overlayStatus={overlayStatus}
        stylePreviewStatus={stylePreviewStatus}
        stylePreviewMessage={stylePreviewMessage}
        stylePreviewError={stylePreviewError}
        hasCroppedImage={hasCroppedImage}
        displayPreviewUrl={displayPreviewUrl}
        previewHasData={previewHasData}
        previewStateStatus={preview?.status}
        orientation={orientation}
        orientationPreviewPending={orientationPreviewPending}
        orientationChanging={orientationChanging}
        orientationMismatch={orientationMismatch}
        previewOrientationLabel={previewOrientationLabel}
        croppedImage={croppedImage}
        currentStyle={currentStyle ?? undefined}
        onSaveToGallery={handleSaveToGallery}
        savingToGallery={savingToGallery}
        savedToGallery={savedToGallery}
        launchpadExpanded={launchpadExpanded}
        onOpenLaunchflow={handleOpenLaunchflowFromEmptyState}
        onRequestUpload={handleUploadNewPhotoFromCanvas}
        onBrowseStyles={handleBrowseStylesFromEmptyState}
        onDownloadClick={handleDownloadHD}
        downloadingHD={downloadingHD}
        isPremiumUser={isPremiumUser}
        onCreateCanvas={handleCreateCanvasFromCenter}
        onChangeOrientation={handleChangeOrientationFromCenter}
        downloadDisabled={downloadDisabled}
        canvasLocked={canvasLocked}
        previewLocked={previewLocked}
      />
    </div>
  );
};

export default CenterStage;
