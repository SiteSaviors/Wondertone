import { clsx } from 'clsx';
import StyleAccordionFallback from './StyleAccordionFallback';
import './StyleSidebar.css';

type StyleSidebarFallbackProps = {
  hasCroppedImage: boolean;
};

export default function StyleSidebarFallback({ hasCroppedImage }: StyleSidebarFallbackProps) {

  return (
    <aside
      className={clsx(
        'hidden lg:block lg:w-[418px] lg:flex-shrink-0 bg-slate-950/50 border-r border-white/10 lg:h-screen lg:sticky lg:top-[57px] overflow-y-auto transition-opacity duration-200',
        !hasCroppedImage && 'opacity-80 saturate-75'
      )}
    >
      <div className="style-sidebar-shell relative p-6 space-y-6">
        {!hasCroppedImage && (
          <div className="rounded-xl border border-white/12 bg-white/5 p-4 text-sm text-white/70">
            Upload your photo above to unlock style previews.
          </div>
        )}

        <div className="relative space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.38em] text-white/50">Studio Curations</p>
          <h3 className="text-base font-display tracking-[0.16em] uppercase text-white md:text-lg">Wondertone Styles</h3>
          <p className="text-xs text-white/75 md:text-sm">Choose your artistic tone</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="h-4 w-24 rounded-lg bg-white/10 animate-pulse" />
          <div className="mt-3 h-20 rounded-xl bg-white/5 animate-pulse" />
        </div>

        <StyleAccordionFallback />

        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm font-semibold text-white mb-2">Choose a style</p>
          <p className="text-xs text-white/70 mb-3">Style list is loading.</p>
        </div>
      </div>
    </aside>
  );
}
