import { Suspense, lazy } from 'react';
import { UploadCloud, Images, Crop, Bookmark, BookmarkCheck } from 'lucide-react';
import type { EntitlementState, StylePreviewStatus, StyleOption } from '@/store/founder/storeTypes';
// Orientation type no longer needed in this module
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import StudioEmptyState from './StudioEmptyState';
import ActionGrid from '@/components/studio/ActionGrid';
import useDeferredRender from '@/hooks/useDeferredRender';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

const CanvasInRoomPreview = lazy(() => import('@/components/studio/CanvasInRoomPreview'));
const StyleForgeOverlay = lazy(() => import('@/components/studio/StyleForgeOverlay'));
const GalleryQuickviewLazy = lazy(() => import('@/sections/studio/experience/GalleryQuickview'));
// Center-rail narrative modules removed; keep only preview + selling points

const CanvasPreviewFallback = () => (
  <div className="w-full h-[360px] rounded-[2.5rem] bg-slate-800/60 border border-white/10 animate-pulse" />
);

const GalleryQuickviewSkeleton = () => (
  <div className="flex gap-4 overflow-hidden">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={`quickview-skeleton-${index}`} className="flex w-[120px] flex-col gap-3 shrink-0 md:w-[110px] sm:w-[96px]">
        <div className="h-[98px] w-full rounded-2xl bg-white/5 animate-pulse md:h-[92px] sm:h-[84px]" />
        <div className="h-3 w-[80%] rounded-full bg-white/5 animate-pulse" />
      </div>
    ))}
  </div>
);

const LazyGalleryQuickview = () => {
  const [intersectionRef, isReady] = useDeferredRender({ rootMargin: '200px 0px 0px 0px' });

  return (
    <div ref={intersectionRef} className="w-full">
      {isReady ? (
        <Suspense fallback={<GalleryQuickviewSkeleton />}>
          <GalleryQuickviewLazy />
        </Suspense>
      ) : (
        <GalleryQuickviewSkeleton />
      )}
    </div>
  );
};

export type CanvasPreviewPanelProps = {
  overlayStyleName: string;
  overlayStatus: Exclude<StylePreviewStatus, 'idle'>;
  stylePreviewStatus: StylePreviewStatus;
  stylePreviewMessage: string | null;
  stylePreviewError: string | null;
  hasCroppedImage: boolean;
  displayPreviewUrl?: string;
  previewHasData: boolean;
  previewStateStatus?: 'idle' | 'loading' | 'ready' | 'error';
  orientation: keyof typeof ORIENTATION_PRESETS;
  orientationPreviewPending: boolean;
  orientationChanging: boolean;
  orientationMismatch: boolean;
  previewOrientationLabel: string | null;
  croppedImage: string | null;
  currentStyle?: StyleOption;
  onSaveToGallery: () => void;
  savingToGallery: boolean;
  savedToGallery: boolean;
  launchpadExpanded: boolean;
  onOpenLaunchflow: () => void;
  onRequestUpload?: () => void;
  onBrowseStyles: () => void;
  // entitlements retained in signature historically, but not used in center rail now
  entitlements?: EntitlementState;
  // Action grid props
  onDownloadClick: () => void;
  downloadingHD: boolean;
  isPremiumUser: boolean;
  onCreateCanvas: () => void;
  onChangeOrientation: () => void;
  downloadDisabled?: boolean;
  canvasLocked?: boolean;
  previewLocked?: boolean;
};

const CanvasPreviewPanel = ({
  overlayStyleName,
  overlayStatus,
  stylePreviewStatus,
  stylePreviewMessage,
  stylePreviewError,
  hasCroppedImage,
  displayPreviewUrl,
  previewHasData,
  previewStateStatus,
  orientation,
  orientationPreviewPending,
  orientationChanging,
  orientationMismatch,
  previewOrientationLabel,
  croppedImage,
  currentStyle,
  onSaveToGallery,
  savingToGallery,
  savedToGallery,
  launchpadExpanded,
  onOpenLaunchflow,
  onBrowseStyles,
  onRequestUpload,
  // entitlements not used
  _entitlements,
  onDownloadClick,
  downloadingHD,
  isPremiumUser,
  onCreateCanvas,
  onChangeOrientation,
  downloadDisabled = false,
  canvasLocked = false,
  previewLocked = false,
}: CanvasPreviewPanelProps) => {
  const { rules, surface } = useProductSurface();
  const orientationMeta = ORIENTATION_PRESETS[orientation];
  const orientationActionDisabled =
    !hasCroppedImage || orientationPreviewPending || orientationChanging || previewLocked;
  const orientationDisabledReason = previewLocked
    ? 'Preview in progress – orientation controls will unlock once rendering completes.'
    : orientationPreviewPending || orientationChanging
    ? 'Orientation update already in progress'
    : !hasCroppedImage
    ? 'Upload & crop a photo first'
    : undefined;

  const showPreStyleCtas = Boolean(
    croppedImage && !previewLocked && (previewStateStatus !== 'ready' || !previewHasData || !currentStyle)
  );
  const showSecondaryActions = Boolean(croppedImage && !previewLocked);
  const orientationSubtitle = `${orientationMeta.label} • Adjust crop`;

  return (
    <main
      className={
        hasCroppedImage
          ? 'w-full lg:flex-1 lg:min-w-0 px-4 py-6 lg:px-6 lg:py-8 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto flex flex-col items-center justify-start'
          : 'w-full lg:flex-1 lg:min-w-0 px-4 py-6 lg:px-6 lg:py-8 flex flex-col items-center justify-start'
      }
    >
      <div className="w-full max-w-[720px] mx-auto">
        {previewLocked && (
          <div
            className="mb-4 w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            Wondertone is rendering your preview…
          </div>
        )}
        <div
          className="relative rounded-3xl overflow-hidden border-2 border-white/20 bg-gradient-preview-bg shadow-2xl transition-colors mx-auto"
          style={{
            aspectRatio: orientationMeta.ratio,
            maxHeight: orientation === 'vertical' ? '85vh' : undefined,
          }}
        >
          {hasCroppedImage ? (
            <>
              {stylePreviewStatus !== 'idle' && (
                <Suspense fallback={<div className="absolute inset-0" />}>
                  <StyleForgeOverlay
                    status={overlayStatus}
                    styleName={overlayStyleName}
                    message={stylePreviewMessage}
                    isError={stylePreviewStatus === 'error'}
                    errorMessage={stylePreviewError}
                  />
                </Suspense>
              )}

              {displayPreviewUrl ? (
                <img
                  src={displayPreviewUrl}
                  alt={currentStyle?.name ?? 'Preview'}
                  className="h-full w-full object-cover select-none"
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/40 text-center p-8">
                  <div>
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Select a style from the left to see your transformed image</p>
                  </div>
                </div>
              )}

              <div className="absolute top-3 left-3 lg:top-6 lg:left-6 px-2 py-1 lg:px-4 lg:py-2 rounded-full bg-white/10 text-[10px] lg:text-xs font-semibold uppercase tracking-[0.2em] lg:tracking-[0.3em] text-white/80 backdrop-blur">
                {orientationMeta.label}
              </div>

              {stylePreviewStatus === 'ready' && currentStyle && currentStyle.id !== 'original-image' && !orientationPreviewPending && !orientationMismatch && (
                <div className="absolute top-3 right-3 lg:top-6 lg:right-6 px-2 py-1 lg:px-4 lg:py-2 rounded-full bg-purple-500/95 text-white text-xs lg:text-sm font-semibold shadow-glow-soft backdrop-blur-sm animate-scaleIn">
                  <span className="flex items-center gap-1 lg:gap-2">
                    <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="hidden sm:inline">{surface === 'memorial' ? 'See them again' : 'Ready to print'}</span>
                    <span className="sm:hidden">Ready</span>
                  </span>
                </div>
              )}

              {orientationPreviewPending && (
                <div className="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-white/15 text-white text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur animate-pulse">
                  Adapting to {orientationMeta.label}
                </div>
              )}

              {!orientationPreviewPending && orientationMismatch && previewOrientationLabel && (
                <div className="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-amber-500/90 text-slate-900 text-xs font-semibold shadow-glow-soft backdrop-blur-sm">
                  {`Preview uses ${previewOrientationLabel} crop • Refresh to update`}
                </div>
              )}

              {!previewHasData && croppedImage && (
                <div className="pointer-events-none absolute bottom-6 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-full border border-white/20 bg-slate-950/70 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Choose a style to transform your photo
                </div>
              )}
            </>
          ) : (
            <StudioEmptyState
              onUpload={onOpenLaunchflow}
              onBrowseStyles={onBrowseStyles}
              launchflowOpen={launchpadExpanded}
            />
          )}
        </div>

        {showPreStyleCtas && (
          <div className="mt-6 w-full max-w-[720px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={onRequestUpload ?? onOpenLaunchflow}
                className="inline-flex flex-1 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(129,69,255,0.35)] transition hover:shadow-[0_20px_45px_rgba(129,69,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-label="Upload a new photo"
              >
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
                <span>Upload New Photo</span>
              </button>
              {!rules.hideStockLibrary && (
                <button
                  type="button"
                  onClick={onBrowseStyles}
                  className="inline-flex flex-1 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(129,69,255,0.35)] transition hover:shadow-[0_18px_45px_rgba(129,69,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  aria-label="Browse our stock image library"
                >
                  <Images className="h-5 w-5" aria-hidden="true" />
                  <span>Browse Library</span>
                </button>
              )}
            </div>
          </div>
        )}

        {previewStateStatus === 'ready' && currentStyle && (
          <div className="mt-6 w-full max-w-[720px]">
            <ActionGrid
              onDownload={onDownloadClick}
              onCreateCanvas={onCreateCanvas}
              downloading={downloadingHD}
              downloadDisabled={downloadDisabled}
              createCanvasDisabled={canvasLocked}
              isPremiumUser={isPremiumUser}
            />
          </div>
        )}

        {showSecondaryActions && (
          <div className="mt-4 w-full max-w-[720px]">
            <SecondaryActionRow
              orientationSubtitle={orientationSubtitle}
              onChangeOrientation={onChangeOrientation}
              orientationDisabled={orientationActionDisabled}
              orientationDisabledReason={orientationDisabledReason}
              onSaveToGallery={onSaveToGallery}
              savingToGallery={savingToGallery}
              savedToGallery={savedToGallery}
            />
          </div>
        )}

        {!rules.hideSocialProof && <LazyGalleryQuickview />}
      </div>

      {!rules.hideCanvasRail && (
        <div className="hidden lg:block w-full max-w-[720px] mt-8">
          <div className="mb-6 text-center space-y-3">
            <span className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.08] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/60">
              Canvas Preview
            </span>
            <h3 className="font-poppins text-[28px] font-semibold text-white sm:text-[32px]">
              See it in your space
            </h3>
            <p className="font-poppins text-sm text-white/70 max-w-md mx-auto sm:text-base">
              Visualize your artwork in a curated living room setting.
            </p>
          </div>
          <Suspense fallback={<CanvasPreviewFallback />}>
            <CanvasInRoomPreview enableHoverEffect showDimensions={false} />
          </Suspense>
        </div>
      )}

      {/* Canvas purchase stays off. The right rail and in-room preview are display-only. */}

      {/* Center-rail story/narrative modules intentionally omitted */}
    </main>
  );
};

export default CanvasPreviewPanel;

type SecondaryActionRowProps = {
  orientationSubtitle: string;
  onChangeOrientation: () => void;
  orientationDisabled: boolean;
  orientationDisabledReason?: string;
  onSaveToGallery: () => void;
  savingToGallery: boolean;
  savedToGallery: boolean;
};

const outlineButtonClasses =
  'inline-flex flex-1 items-center justify-between gap-3 rounded-full border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white/85 backdrop-blur transition hover:border-white/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

const SecondaryActionRow = ({
  orientationSubtitle,
  onChangeOrientation,
  orientationDisabled,
  orientationDisabledReason,
  onSaveToGallery,
  savingToGallery,
  savedToGallery,
}: SecondaryActionRowProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
    <button
      type="button"
      onClick={onChangeOrientation}
      disabled={orientationDisabled}
      title={
        orientationDisabled
          ? orientationDisabledReason ?? 'Complete crop adjustments to change orientation'
          : 'Adjust crop & layout'
      }
      className={outlineButtonClasses}
      aria-disabled={orientationDisabled ? 'true' : 'false'}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60">
        <Crop className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col text-left">
        <span className="text-sm font-semibold leading-tight">Change Orientation</span>
        <span className="text-xs text-white/60">{orientationSubtitle}</span>
      </div>
    </button>

    <button
      type="button"
      onClick={onSaveToGallery}
      disabled={savingToGallery}
      title={savedToGallery ? 'Already saved to your gallery' : 'Save this artwork'}
      className={outlineButtonClasses}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60">
        {savedToGallery ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </div>
      <div className="flex flex-1 flex-col text-left">
        <span className="text-sm font-semibold leading-tight">
          {savedToGallery ? 'Saved to Art Gallery' : savingToGallery ? 'Saving…' : 'Save to Art Gallery'}
        </span>
        <span className="text-xs text-white/60">
          {savedToGallery ? 'Ready to revisit anytime' : 'Keep this photo handy'}
        </span>
      </div>
    </button>
  </div>
);
