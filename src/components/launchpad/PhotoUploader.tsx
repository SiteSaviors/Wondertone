import { ChangeEvent, DragEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';
import { readFileAsDataURL, getImageDimensions, determineOrientationFromDimensions, type FileDataUrlResult } from '@/utils/imageUtils';
import { downscaleDataUrlForStudio } from '@/utils/studioImageDecode';
import SmartCropPreview from '@/components/launchpad/SmartCropPreview';
import AIAnalysisOverlay from '@/components/launchpad/AIAnalysisOverlay';
import { emitStepOneEvent, trackSourceSelected, trackUploadComplete } from '@/utils/telemetry';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';
import { ORIENTATION_PRESETS, cacheSmartCropResult, clearSmartCropCacheForImage, SmartCropResult } from '@/utils/smartCrop';
import { computeImageDigest } from '@/utils/imageHash';
import type { Orientation } from '@/utils/imageUtils';
import { useUploadActions, useUploadState } from '@/store/hooks/useUploadStore';
import { usePreviewActions } from '@/store/hooks/usePreviewStore';
import { persistOriginalUpload } from '@/utils/sourceUploadApi';
import { createPreviewLog } from '@/utils/previewLogApi';
import CropperModal from '@/components/launchpad/cropper/CropperModal';
import { useFounderStore } from '@/store/useFounderStore';

type UploadStage = 'idle' | 'analyzing' | 'preview' | 'cropper' | 'complete';

const PhotoUploader = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    originalImage,
    originalImageDimensions,
    smartCrops,
    croppedImage,
    orientation,
    orientationTip,
    cropReadyAt,
    isDragging,
    uploadIntentAt,
  } = useUploadState();
  const {
    setUploadedImage,
    setCroppedImage,
    setOriginalImage,
    setOriginalImageDimensions,
    setOriginalImageSource,
    setOriginalImagePreviewLogId,
    setOrientation,
    setOrientationTip,
    markCropReady,
    setDragging,
    setSmartCropForOrientation,
    clearSmartCrops,
    setPreviewState,
    setCurrentImageHash,
    getSessionAccessToken,
  } = useUploadActions();
  const { generatePreviews, resetPreviews, shouldAutoGeneratePreviews } = usePreviewActions();
  const openStockLibrary = useFounderStore((state) => state.openStockLibrary);
  const { rules, surface } = useProductSurface();
  const [isCropperOpen, setCropperOpen] = useState(false);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [pendingOrientation, setPendingOrientation] = useState<Orientation>('square');
  const lastHandledUploadIntentRef = useRef<number | null>(null);
  const previousOriginalRef = useRef<string | null>(null);
  const emitStepOne = useCallback((payload: Parameters<typeof emitStepOneEvent>[0]) => {
    if (import.meta.env.DEV) {
      console.info('[canvas-store][step-one]', payload);
    }
    emitStepOneEvent(payload);
  }, []);

  const cropReadyLabel = useMemo(() => {
    if (!cropReadyAt) return null;
    const delta = Date.now() - cropReadyAt;
    if (delta < 1000 * 5) return 'Just now';
    if (delta < 1000 * 60) return `${Math.floor(delta / 1000)}s ago`;
    return 'Updated';
  }, [cropReadyAt]);

  const orientationMeta = useMemo(() => ORIENTATION_PRESETS[orientation], [orientation]);
  const finalizedPreviewBounds = useMemo(() => {
    if (orientation === 'horizontal') {
      return { maxWidth: 'min(92vw, 900px)', maxHeight: 'min(65vh, 620px)' };
    }
    if (orientation === 'vertical') {
      return { maxWidth: 'min(70vw, 520px)', maxHeight: 'min(75vh, 720px)' };
    }
    return { maxWidth: 'min(88vw, 640px)', maxHeight: 'min(70vh, 680px)' };
  }, [orientation]);

  const orientationMessage = useMemo(() => {
    if (!croppedImage) return null;
    return orientationTip ?? orientationMeta.description;
  }, [croppedImage, orientationMeta.description, orientationTip]);

  const handleSelectFile = () => {
    inputRef.current?.click();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    emitStepOne({ type: 'upload_started' });
    setStage('analyzing');
    const accessToken = getSessionAccessToken();
    const result = await readFileAsDataURL(file, {
      accessToken,
      onConversionStart: () => emitStepOne({ type: 'conversion', status: 'start' }),
      onConversionSuccess: (meta) => emitStepOne({ type: 'conversion', status: 'success', cacheHit: meta.cacheHit }),
      onConversionError: () => emitStepOne({ type: 'conversion', status: 'error' }),
    });
    await processDataUrl(result);
  };

  const processDataUrl = async (payload: FileDataUrlResult) => {
    const decoded = await downscaleDataUrlForStudio(payload.dataUrl, {
      width: payload.width,
      height: payload.height,
    });
    const dataUrl = decoded.dataUrl;
    const providedWidth = decoded.width || payload.width;
    const providedHeight = decoded.height || payload.height;
    setStage('analyzing');
    if (previousOriginalRef.current) {
      clearSmartCropCacheForImage(previousOriginalRef.current);
    }
    clearSmartCropCacheForImage(dataUrl);
    setOriginalImage(dataUrl);
    setOriginalImageDimensions(null);
    setOriginalImageSource(null);
    setUploadedImage(null);
    setCroppedImage(null);
    clearSmartCrops();
    resetPreviews();

    const dimensions = providedWidth && providedHeight
      ? { width: providedWidth, height: providedHeight }
      : await getImageDimensions(dataUrl);
    setOriginalImageDimensions(dimensions);
    const detectedOrientation = determineOrientationFromDimensions(dimensions.width, dimensions.height);
    setOrientation(detectedOrientation);
    setPendingOrientation(detectedOrientation);
    setOrientationTip(ORIENTATION_PRESETS[detectedOrientation].description);
    emitStepOne({ type: 'upload_success', value: detectedOrientation });
    trackSourceSelected('photo');

    // Note: AIAnalysisOverlay will call setStage('preview') when animation completes
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    emitStepOne({ type: 'upload_started' });
    setDragging(false);
    setStage('analyzing');
    const accessToken = getSessionAccessToken();
    const result = await readFileAsDataURL(file, {
      accessToken,
      onConversionStart: () => emitStepOne({ type: 'conversion', status: 'start' }),
      onConversionSuccess: (meta) => emitStepOne({ type: 'conversion', status: 'success', cacheHit: meta.cacheHit }),
      onConversionError: () => emitStepOne({ type: 'conversion', status: 'error' }),
    });
    await processDataUrl(result);
  };

  const handleSamplePhoto = () => {
    if (rules.hideStockLibrary) return;
    openStockLibrary();
  };

  useEffect(() => {
    if (!uploadIntentAt) return;
    if (lastHandledUploadIntentRef.current === uploadIntentAt) return;
    lastHandledUploadIntentRef.current = uploadIntentAt;
    handleSelectFile();
  }, [uploadIntentAt]);

  const finalizeCrop = async (result: SmartCropResult, source: 'auto' | 'manual') => {
    const targetOrientation = result.orientation;
    const orientationChanged = targetOrientation !== orientation;

    setSmartCropForOrientation(targetOrientation, result);
    if (originalImage) {
      cacheSmartCropResult(originalImage, targetOrientation, result);
    }
    setCroppedImage(result.dataUrl);
    setUploadedImage(result.dataUrl);

    if (originalImage) {
      try {
        const persistResult = await persistOriginalUpload({
          dataUrl: originalImage,
          width: originalImageDimensions?.width ?? result.imageDimensions.width,
          height: originalImageDimensions?.height ?? result.imageDimensions.height,
          accessToken: getSessionAccessToken(),
        });

        if (persistResult.ok) {
          setOriginalImageSource({
            storagePath: persistResult.storagePath,
            publicUrl: persistResult.publicUrl,
            signedUrl: persistResult.signedUrl,
            signedUrlExpiresAt: persistResult.signedUrlExpiresAt,
            hash: persistResult.hash,
            bytes: persistResult.bytes,
          });

          const previewLogResult = await createPreviewLog({
            storagePath: persistResult.storagePath,
            orientation: targetOrientation,
            displayUrl: persistResult.publicUrl,
            cropConfig: result.region,
            accessToken: getSessionAccessToken(),
          });

          if (previewLogResult.ok) {
            setOriginalImagePreviewLogId(previewLogResult.previewLogId);
          } else {
            console.warn('[PhotoUploader] Unable to create preview log', previewLogResult.error);
            setOriginalImagePreviewLogId(null);
          }
        } else {
          console.warn('[PhotoUploader] Persist original upload failed', persistResult.ok ? 'ok' : persistResult.error);
          setOriginalImagePreviewLogId(null);
        }
      } catch (_error) {
        console.error('[PhotoUploader] Unexpected error persisting original upload');
        setOriginalImagePreviewLogId(null);
      }
    }

    const digestPromise = computeImageDigest(result.dataUrl);

    if (orientationChanged) {
      setOrientation(targetOrientation);
    }
    setPendingOrientation(targetOrientation);

    setOrientationTip(ORIENTATION_PRESETS[targetOrientation].description);
    markCropReady();
    emitStepOne({ type: 'substep', value: source === 'auto' ? 'complete' : 'crop' });
    trackUploadComplete('photo');
    setStage('complete');

    // Populate "Original Image" style with user's cropped photo immediately
    setPreviewState('original-image', {
      status: 'ready',
      data: {
        previewUrl: result.dataUrl,
        watermarkApplied: false,
        startedAt: Date.now(),
        completedAt: Date.now(),
      },
      orientation: targetOrientation,
    });

    const imageHash = await digestPromise;
    setCurrentImageHash(imageHash);

    // Auto-preview generation (disabled during testing to save API costs)
    if (shouldAutoGeneratePreviews()) {
      if (source === 'auto' || orientationChanged) {
        resetPreviews();
        await generatePreviews(undefined, { force: true });
      } else {
        console.log('[PhotoUploader] Manual crop saved without orientation change. Existing previews remain cached until you regenerate a style.');
      }
    } else {
      console.log('[PhotoUploader] Auto-preview generation disabled (testing mode). Click styles in Studio to generate.');
    }
  };

  const handleSmartCropReady = useCallback(
    (result: SmartCropResult) => {
      setSmartCropForOrientation(result.orientation, result);
      if (originalImage) {
        cacheSmartCropResult(originalImage, result.orientation, result);
      }
    },
    [originalImage, setSmartCropForOrientation]
  );

  const handleAcceptSmartCrop = async (result: SmartCropResult) => {
    await finalizeCrop(result, 'auto');
  };

  const handleCustomizeCrop = () => {
    if (!originalImage) return;
    setCropperOpen(true);
    setStage('cropper');
  };

  const handleOpenCropper = () => {
    if (!originalImage) return;
    setCropperOpen(true);
    setStage('cropper');
  };

  const handleCropComplete = async (result: SmartCropResult) => {
    await finalizeCrop(result, 'manual');
    setCropperOpen(false);
  };

  useEffect(() => {
    if (originalImage) {
      previousOriginalRef.current = originalImage;
    }
  }, [originalImage]);

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  if (stage === 'analyzing' && originalImage) {
    return (
      <>
        {fileInput}
        <Card glass className="space-y-6 relative overflow-hidden">
          <AIAnalysisOverlay
            imageUrl={originalImage}
            onComplete={() => setStage('preview')}
          />
        </Card>
      </>
    );
  }

  if (stage === 'preview' && originalImage) {
    return (
      <>
        {fileInput}
        <Card glass className="space-y-6 relative overflow-hidden">
          <SmartCropPreview
            originalImage={originalImage}
            orientation={pendingOrientation}
            onAccept={handleAcceptSmartCrop}
            onAdjust={handleCustomizeCrop}
            onReady={handleSmartCropReady}
            onChangePhoto={handleSelectFile}
          />
        </Card>
      </>
    );
  }

  if (stage === 'cropper' && originalImage) {
    return (
      <>
        {fileInput}
        <Suspense fallback={null}>
          <CropperModal
            open={isCropperOpen}
            originalImage={originalImage}
            originalDimensions={originalImageDimensions}
            initialOrientation={orientation}
            smartCropCache={smartCrops}
            onClose={() => {
              setCropperOpen(false);
              if (croppedImage) {
                setStage('complete');
              } else {
                setStage('idle');
              }
            }}
            onComplete={handleCropComplete}
            onSmartCropReady={handleSmartCropReady}
          />
        </Suspense>
      </>
    );
  }

  return (
    <Card glass className="space-y-6 relative overflow-hidden">
      {fileInput}
      <div
        className={clsx(
          'relative rounded-[1.75rem] border-2 border-dashed transition-all duration-300 overflow-hidden',
          isDragging
            ? 'border-purple-400 bg-gradient-upload-hover shadow-glow-purple'
            : 'border-white/20 bg-gradient-upload'
        )}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="absolute inset-0 bg-dropzone-radial opacity-60 pointer-events-none" />
        <div className="relative z-10 p-8 space-y-6">
          {!croppedImage ? (
            <>
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-glow-soft animate-pulseGlow">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-poppins text-3xl font-bold text-white">
                  {surface === 'memorial'
                    ? isDragging
                      ? 'Drop the photo'
                      : 'Upload a photo of someone you lost'
                    : isDragging
                      ? 'Drop the photo'
                      : 'Upload a picture'}
                </h3>
                <p className="font-poppins text-base text-white/80 max-w-auto mx-auto">
                  {surface === 'memorial'
                    ? 'Upload a photo. Choose a style. See them again. No prompts.'
                    : 'Upload a picture. Pick a look. No prompts.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSelectFile}
                  className="flex-1 bg-gradient-cta text-white font-semibold px-6 py-4 rounded-xl shadow-glow-purple hover:shadow-glow-purple hover:scale-[1.02] transition-all duration-200"
                >
                  {surface === 'memorial' ? 'Upload a photo.' : 'Upload Your Photo'}
                </button>
                {!rules.hideStockLibrary && (
                  <button
                    onClick={handleSamplePhoto}
                    className="flex-1 border-2 border-white/30 text-white font-medium px-6 py-4 rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-200"
                  >
                    Browse Our Library
                  </button>
                )}
              </div>
              <p className="text-xs text-center text-white/50">
                JPG or PNG • Max 10MB
              </p>
            </>
          ) : (
            <div className="space-y-4 animate-scaleIn">
              <div
                className="relative mx-auto overflow-hidden border-2 border-white/20 bg-black/20 shadow-lg rounded-xl"
                style={{
                  aspectRatio: orientationMeta.ratio,
                  width: '100%',
                  ...finalizedPreviewBounds,
                }}
              >
                <img src={croppedImage} alt="Your photo" className="h-full w-full object-cover" />
                <div className="absolute top-3 right-3 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                  {orientationMeta.label}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSelectFile}
                  className="flex-1 bg-white/10 border border-white/20 text-white font-medium px-4 py-3 rounded-lg hover:bg-white/20 transition-all"
                >
                  Change Photo
                </button>
                <button
                  onClick={handleOpenCropper}
                  className="flex-1 bg-white/10 border border-white/20 text-white font-medium px-4 py-3 rounded-lg hover:bg-white/20 transition-all"
                >
                  Adjust Crop
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {orientationMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 border border-emerald-400/20 animate-fadeIn">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400">Perfect Orientation</p>
            <p className="text-xs text-white/70">{orientationMessage}</p>
          </div>
        </div>
      )}

      {croppedImage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-400/20 animate-fadeIn">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-purple-400">Smart Crop Applied</p>
            <p className="text-xs text-white/70">{cropReadyLabel}</p>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PhotoUploader;
