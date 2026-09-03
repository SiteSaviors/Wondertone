import { Download } from 'lucide-react';
import { trackDownloadCTAClick } from '@/utils/telemetry';
import { useEntitlementsState } from '@/store/hooks/useEntitlementsStore';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

type ActionGridProps = {
  onDownload: () => void;
  onCreateCanvas?: () => void;
  downloading: boolean;
  downloadDisabled: boolean;
  createCanvasDisabled?: boolean;
  isPremiumUser: boolean;
};

const gradientButton =
  'rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 text-white shadow-[0_15px_40px_rgba(129,69,255,0.35)] transition hover:shadow-[0_18px_45px_rgba(129,69,255,0.45)] disabled:opacity-50 disabled:cursor-not-allowed';

export function ActionGrid({
  onDownload,
  downloading,
  downloadDisabled,
  isPremiumUser,
}: ActionGridProps) {
  const { userTier } = useEntitlementsState();
  const { surface } = useProductSurface();

  const handleDownload = () => {
    trackDownloadCTAClick(userTier, isPremiumUser);
    onDownload();
  };

  const fullResLabel = surface === 'memorial' ? 'Get the full-resolution file.' : 'Get the full-resolution artwork';

  return (
    <div className="w-full">
      <div className="grid gap-3 sm:grid-cols-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || downloadDisabled}
          className={`${gradientButton} flex items-center justify-between gap-3 px-6 py-4`}
          data-sku="revealed_artwork_full_res"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 shadow-glow-soft">
            <Download className="h-4 w-4" />
          </div>
          <div className="flex flex-1 flex-col text-left">
            <span className="text-sm font-semibold leading-tight">{fullResLabel}</span>
            <span className="text-xs text-white/70">Preview is display-only</span>
          </div>
        </button>
      </div>
    </div>
  );
}

export default ActionGrid;
