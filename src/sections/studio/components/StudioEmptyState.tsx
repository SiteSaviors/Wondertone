import { clsx } from 'clsx';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';

type StudioEmptyStateProps = {
  onUpload: () => void;
  onBrowseStyles: () => void;
  launchflowOpen: boolean;
};

const StudioEmptyState = ({ onUpload, onBrowseStyles, launchflowOpen }: StudioEmptyStateProps) => {
  const { rules, surface } = useProductSurface();
  return (
  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6">
    <div className="relative w-full max-w-[420px] sm:max-w-xl overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/[0.08] px-5 py-8 text-center shadow-[0_35px_140px_rgba(20,24,48,0.55)] backdrop-blur-2xl sm:px-8 sm:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(170,130,255,0.25),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,215,146,0.18),transparent_65%)]" />
      <div className="relative space-y-5 sm:space-y-7">
        <div className="relative mx-auto flex h-12 sm:h-14 items-center justify-center">
          <div className="absolute inset-0 blur-3xl bg-[radial-gradient(circle,rgba(164,129,255,0.32),transparent)]" aria-hidden="true" />
          <div className="relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70 shadow-[0_18px_45px_rgba(12,14,32,0.45)]">
            Wondertone Studio
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M12 4v9" />
            </svg>
          </div>
        </div>
        <div className="space-y-3 sm:space-y-4">
          <h3 className="font-poppins text-xl font-semibold leading-snug text-white sm:text-[32px]">
            {surface === 'memorial' ? 'Bring them back in art.' : 'Upload Any Photo Into Wondertone Studio'}
          </h3>
          <p className="font-poppins text-sm text-white/75 sm:text-base">
            {surface === 'memorial'
              ? 'Upload a photo. Choose a style. See them again. No prompts.'
              : 'Choose between 50+ art styles to start your creation.'}
          </p>
        </div>
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
            {launchflowOpen ? 'Launchflow open…' : surface === 'memorial' ? 'Upload a photo.' : 'Upload photo'}
          </button>
          {!rules.hideStockLibrary && (
            <button
              type="button"
              onClick={onBrowseStyles}
              className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Browse Our Library
            </button>
          )}
        </div>
        {surface !== 'memorial' && (
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
            Your image and artwork stays private—always.
          </p>
        )}
      </div>
    </div>
  </div>
  );
};

export default StudioEmptyState;
