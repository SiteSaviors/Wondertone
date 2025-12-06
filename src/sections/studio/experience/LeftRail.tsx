import { Suspense, lazy } from 'react';
import StyleSidebarFallback from '@/sections/studio/components/StyleSidebarFallback';
import { useStudioEntitlementState } from '@/store/hooks/studio/useStudioEntitlementState';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioOverlayContext } from '@/sections/studio/experience/context';

const StyleSidebar = lazy(() => import('@/sections/studio/components/StyleSidebar'));

const LeftRail = () => {
  const { entitlements, displayRemainingTokens } = useStudioEntitlementState();
  const { currentStyle, hasCroppedImage } = useStudioPreviewState();
  const { setMobileDrawerOpen } = useStudioOverlayContext();

  return (
    <>
      {hasCroppedImage && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex items-center gap-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-5 py-3.5 text-white shadow-glow-purple transition duration-150 active:scale-95"
            aria-label="Open style picker"
            style={{
              paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {currentStyle?.thumbnail && (
              <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border-2 border-white/30 bg-slate-800">
                <img src={currentStyle.thumbnail} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Style
              </span>
              <span className="text-sm font-bold leading-tight">
                {currentStyle?.name ?? 'Select Style'}
              </span>
            </div>
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      <Suspense fallback={<StyleSidebarFallback hasCroppedImage={hasCroppedImage} />}>
        <StyleSidebar hasCroppedImage={hasCroppedImage} />
      </Suspense>
    </>
  );
};

export default LeftRail;
