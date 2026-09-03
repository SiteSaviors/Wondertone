import { Suspense, lazy, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { getCanvasSizeOption } from '@/utils/canvasSizes';
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import { useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import { useCanvasConfigState } from '@/store/hooks/useFounderCanvasStore';
import { useUploadState } from '@/store/hooks/useUploadStore';
import { usePreviewEntry } from '@/store/hooks/usePreviewStore';
import { useEntitlementsState } from '@/store/hooks/useEntitlementsStore';

const CanvasInRoomPreview = lazy(() => import('@/components/studio/CanvasInRoomPreview'));

const CheckoutSummary = () => {
  const { currentStyle } = useStyleCatalogState();
  const { selectedCanvasSize, enhancements } = useCanvasConfigState((state) => ({
    selectedCanvasSize: state.selectedCanvasSize,
    enhancements: state.enhancements,
  }));
  const enabledEnhancements = enhancements.filter((item) => item.enabled);
  const { orientation, croppedImage } = useUploadState();
  const { entitlements } = useEntitlementsState();
  const previewEntry = usePreviewEntry(currentStyle?.id ?? null);

  const previewUrl = useMemo(() => {
    if (previewEntry?.status === 'ready' && previewEntry.data?.previewUrl) {
      return previewEntry.data.previewUrl;
    }
    return croppedImage;
  }, [previewEntry, croppedImage]);

  const sizeOption = getCanvasSizeOption(selectedCanvasSize);
  const orientationLabel = ORIENTATION_PRESETS[orientation]?.label ?? 'Square';

  return (
    <div className="space-y-6">
      <Card glass className="overflow-hidden border border-white/10 bg-white/5">
        <div className="relative aspect-square w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
          <Suspense
            fallback={
              previewUrl ? (
                <img
                  src={previewUrl}
                  alt={currentStyle?.name ?? 'Wondertone preview'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm uppercase tracking-[0.35em] text-white/40">
                  Preview Coming Soon
                </div>
              )
            }
          >
            <CanvasInRoomPreview className="absolute inset-0" />
          </Suspense>
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 backdrop-blur">
            {orientationLabel}
          </div>
        </div>
        <div className="space-y-4 border-t border-white/10 p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {currentStyle?.name ?? 'Choose your style'}
            </h2>
            <p className="text-xs text-white/60">
              {sizeOption?.label ?? 'Select a canvas size'} · {orientationLabel}
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70">
              <span>Canvas size</span>
              <span className="font-semibold text-white">
                {sizeOption?.label ?? 'Select size'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70">
              <span>Orientation</span>
              <span className="font-semibold text-white">{orientationLabel}</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
                Enhancements
              </p>
            {enabledEnhancements.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
                  No extras selected
                </p>
              ) : (
                <div className="space-y-2">
                  {enabledEnhancements.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-sm text-white"
                    >
                      <span>{item.name}</span>
                      <span className="font-semibold">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card glass className="space-y-4 border border-white/10 bg-white/5 p-5">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
            Wondertone Promise
          </h3>
          <p className="mt-1 text-sm text-white/70">
            Hand-stretched canvas, archival inks, and concierge support from the Wondertone studio.
          </p>
        </div>
        <div className="space-y-3 text-sm text-white/70">
            <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            {entitlements.tier === 'free'
              ? 'Watermarked preview until purchase completes'
              : 'Includes clean, watermark-free download'}
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Studio concierge monitors every order for color accuracy
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
          <p>
            Need adjustments after checkout? Our artisans will reach out within 24 hours before your canvas goes to print.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default CheckoutSummary;
