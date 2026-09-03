import { clsx } from 'clsx';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

type StudioEmptyStateProps = {
  onUpload: () => void;
  onBrowseStyles: () => void;
  launchflowOpen: boolean;
};

const StudioEmptyState = ({ onUpload, onBrowseStyles, launchflowOpen }: StudioEmptyStateProps) => {
  const { rules, surface } = useProductSurface();
  const isMemorial = surface === 'memorial';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6">
      <div
        className={clsx(
          'relative w-full overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[0.08] text-center shadow-[0_35px_140px_rgba(20,24,48,0.55)] backdrop-blur-2xl',
          isMemorial ? 'max-w-md px-5 py-8 sm:px-8 sm:py-10' : 'max-w-[420px] sm:max-w-xl px-5 py-8 sm:px-8 sm:py-12'
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(170,130,255,0.25),transparent_60%)]" />
        <div className="relative space-y-5">
          {!isMemorial && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-poppins text-xl font-semibold leading-snug text-white sm:text-[32px]">
                Upload a photo to begin
              </h3>
              <p className="font-poppins text-sm text-white/75 sm:text-base">
                Upload a picture. Pick a look. No prompts.
              </p>
            </div>
          )}
          {isMemorial && (
            <p className="font-poppins text-sm text-white/75 sm:text-base">
              Upload a photo to start.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onUpload}
              disabled={launchflowOpen}
              className={clsx(
                'rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                launchflowOpen
                  ? 'cursor-default bg-white/15 text-white/60'
                  : 'bg-gradient-to-r from-amber-400 via-purple-400 to-blue-500 text-slate-950 shadow-[0_18px_45px_rgba(71,67,188,0.5)] hover:shadow-[0_18px_55px_rgba(71,67,188,0.6)]'
              )}
            >
              {launchflowOpen ? 'Upload open' : 'Upload a photo'}
            </button>
            {!isMemorial && !rules.hideStockLibrary && (
              <button
                type="button"
                onClick={onBrowseStyles}
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Browse Our Library
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioEmptyState;
