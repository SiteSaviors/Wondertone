import { fetchImageAsDataUrl } from '@/utils/stockLibrary/assetFetch';
import { downscaleDataUrlForStudio } from '@/utils/studioImageDecode';
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import { persistOriginalUpload } from '@/utils/sourceUploadApi';
import { createPreviewLog } from '@/utils/previewLogApi';
import { emitStockModalClosed } from '@/utils/stockLibrary/telemetry';
import { trackSourceSelected, trackUploadComplete } from '@/utils/telemetry';
import { getProductSurfaceRules } from '@/config/productSurface';
import type { StockLibrarySliceCreator } from '@/store/founder/slices/stockLibrary/types';

export const createStockLibrarySelectionSlice: StockLibrarySliceCreator = (set, get) => ({
  appliedStockImageId: null,
  appliedStockImage: null,
  applyStockImage: (image) =>
    set({
      appliedStockImageId: image.id,
      appliedStockImage: image,
    }),
  clearAppliedStockImage: () =>
    set({
      appliedStockImageId: null,
      appliedStockImage: null,
    }),
  continueWithStockImage: async () => {
    if (getProductSurfaceRules().hideStockLibrary) {
      console.warn('[stockLibrarySlice] stock library is disabled on this surface');
      return;
    }

    const { appliedStockImage } = get();

    if (!appliedStockImage) {
      console.warn('[stockLibrarySlice] continueWithStockImage called with no applied image');
      return;
    }

    // Close the modal immediately so the UI responds instantly while work continues.
    set({ stockLibraryModalOpen: false });

    try {
      const fetched = await fetchImageAsDataUrl(appliedStockImage.fullUrl);
      const decoded = await downscaleDataUrlForStudio(fetched.dataUrl, {
        width: fetched.width,
        height: fetched.height,
      });
      const dataUrl = decoded.dataUrl;
      const width = decoded.width || fetched.width;
      const height = decoded.height || fetched.height;

      get().setOriginalImage(dataUrl);
      get().setOriginalImageDimensions({ width, height });
      get().setUploadedImage(dataUrl);
      get().setCroppedImage(dataUrl);
      get().setOrientation(appliedStockImage.orientation);
      get().setOrientationTip(ORIENTATION_PRESETS[appliedStockImage.orientation]?.description ?? null);
      get().markCropReady();
      get().resetPreviews();

      trackSourceSelected('stock');
      trackUploadComplete('stock');

      get().setPreviewState('original-image', {
        status: 'ready',
        data: {
          previewUrl: dataUrl,
          watermarkApplied: false,
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
        orientation: appliedStockImage.orientation,
      });

      const accessToken = get().getSessionAccessToken ? get().getSessionAccessToken() : null;
      const persistResult = await persistOriginalUpload({ dataUrl, width, height, accessToken });

      if (persistResult.ok) {
        get().setOriginalImageSource({
          storagePath: persistResult.storagePath,
          publicUrl: persistResult.publicUrl,
          signedUrl: persistResult.signedUrl,
          signedUrlExpiresAt: persistResult.signedUrlExpiresAt,
          hash: persistResult.hash,
          bytes: persistResult.bytes,
        });
        get().setCurrentImageHash(persistResult.hash);

        const previewLogResponse = await createPreviewLog({
          storagePath: persistResult.storagePath,
          orientation: appliedStockImage.orientation,
          displayUrl: persistResult.publicUrl,
          accessToken,
        });

        if (previewLogResponse.ok) {
          get().setOriginalImagePreviewLogId(previewLogResponse.previewLogId);
        } else {
          console.warn('[stockLibrarySlice] Failed to create preview log', previewLogResponse.error);
          get().setOriginalImagePreviewLogId(null);
        }
      } else {
        console.warn('[stockLibrarySlice] Failed to persist stock image', persistResult.error);
        get().setOriginalImagePreviewLogId(null);
      }
    } catch (error) {
      console.error('[stockLibrarySlice] Unable to apply stock image', error);
      // Re-open the modal if something fails so the user can retry.
      set({ stockLibraryModalOpen: true });
      return;
    }

    const latestState = get();
    const durationMs = latestState.modalOpenedAt ? Date.now() - latestState.modalOpenedAt : 0;
    emitStockModalClosed({
      reason: 'continue',
      durationMs,
      imagesViewed: latestState.viewedImageIds.size,
      imageApplied: true,
      category: latestState.selectedCategory,
    });

    set({
      stockLibraryModalOpen: false,
      currentView: 'category-selector',
      appliedStockImageId: null,
      appliedStockImage: null,
      modalOpenedAt: null,
      viewedImageIds: new Set(),
    });
  },
});
