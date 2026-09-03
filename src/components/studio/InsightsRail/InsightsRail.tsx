import { memo, useMemo, useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { useReducedMotion } from 'framer-motion';
import type { EntitlementState, StyleOption } from '@/store/founder/storeTypes';
import StoryTeaser from './StoryTeaser';
// StoryHeader removed per request to reduce duplication in right rail
const DiscoverGridLazy = lazy(() => import('./DiscoverGrid'));
const PaletteModuleLazy = lazy(() => import('./PaletteModule'));
const CuratedStylesModuleLazy = lazy(() => import('./CuratedStylesModule'));
const ShareBadgesLazy = lazy(() => import('./ShareBadges'));
const OriginalComparisonModuleLazy = lazy(() => import('./OriginalComparisonModule'));
import { getNarrative, getPalette } from '@/utils/storyLayer/copy';
import type { Orientation } from '@/utils/imageUtils';
import type { StudioToastPayload } from '@/hooks/useStudioFeedback';
import { useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import useDeferredRender from '@/hooks/useDeferredRender';

type InsightsRailProps = {
  hasCroppedImage: boolean;
  currentStyle: StyleOption | null;
  entitlements: EntitlementState;
  previewReady: boolean;
  previewUrl?: string | null;
  orientation: Orientation;
  onRequestCanvas: (source: 'center' | 'rail') => void;
  onToast?: (toast: StudioToastPayload) => void;
  onGatePrompt?: (options: {
    title: string;
    description: string;
    ctaLabel: string;
  }) => void;
  className?: string;
};

const MobileAccordionShell = ({ children }: { children: ReactNode }) => (
  <section className="lg:hidden">
    <details
      open
      className="group rounded-3xl border border-white/12 bg-white/[0.03] p-4 text-white shadow-[0_24px_60px_rgba(9,16,29,0.35)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-white">
        <span>Wondertone Story & Insights</span>
        <svg
          className="h-5 w-5 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="mt-4 space-y-6 text-sm text-white/80">{children}</div>
    </details>
  </section>
);

const DesktopRailShell = ({ children }: { children: ReactNode }) => (
  <section className="hidden lg:block">
    <div className="space-y-8">{children}</div>
  </section>
);

const PreUploadPlaceholder = () => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-center">
    <p className="text-sm leading-relaxed text-white/70">
      Upload a photo to see this look in the canvas rail.
    </p>
  </div>
);

const InsightsSkeleton = () => (
  <div className="space-y-6">
    <div className="h-6 w-48 animate-pulse rounded-full bg-white/10" />
    <div className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    <div className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
  </div>
);

const useHighlightedStyle = (fallback: StyleOption | null) => {
  const { hoveredStyleId, selectedStyleId, styles } = useStyleCatalogState();

  const candidateId = hoveredStyleId ?? selectedStyleId ?? fallback?.id ?? null;

  return useMemo(() => {
    if (!candidateId) return fallback;
    const match = styles.find((style) => style.id === candidateId);
    return match ?? fallback;
  }, [candidateId, styles, fallback]);
};

const InsightsRail = ({
  hasCroppedImage,
  currentStyle,
  entitlements,
  previewReady,
  previewUrl,
  orientation,
  onRequestCanvas: _onRequestCanvas,
  onToast: _onToast,
  onGatePrompt,
  className,
}: InsightsRailProps) => {
  const highlightedStyle = useHighlightedStyle(currentStyle);
  const prefersReducedMotion = useReducedMotion();
  const stage: 'pre-upload' | 'post-upload' =
    hasCroppedImage && previewReady ? 'post-upload' : 'pre-upload';

  // Lazy-load story data from registry
  const [storyData, setStoryData] = useState<{ narrative: Awaited<ReturnType<typeof getNarrative>>; palette: Awaited<ReturnType<typeof getPalette>> } | null>(null);

  const [intersectionRef, isDeferredReady] = useDeferredRender({ rootMargin: '200px 0px 0px 0px' });

  useEffect(() => {
    if (!isDeferredReady || !highlightedStyle || stage !== 'post-upload') {
      setStoryData(null);
      return;
    }

    let cancelled = false;

    Promise.all([
      getNarrative(highlightedStyle),
      getPalette(highlightedStyle),
    ]).then(([narrative, palette]) => {
      if (!cancelled) {
        setStoryData({ narrative, palette });
      }
    }).catch((error) => {
      console.error('[InsightsRail] Failed to load story data:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [highlightedStyle, stage]);

  const content = (
    <>
      <DesktopRailShell>
        <StoryTeaser highlightedStyle={highlightedStyle} stage={stage} />
        <Suspense fallback={<InsightsSkeleton />}>
          <OriginalComparisonModuleLazy
            stage={stage}
            orientation={orientation}
            styledPreviewUrl={previewUrl}
            prefersReducedMotion={prefersReducedMotion}
          />
        </Suspense>
        {storyData && highlightedStyle ? (
          <Suspense fallback={<InsightsSkeleton />}>
            <DiscoverGridLazy narrative={storyData.narrative} />
            <PaletteModuleLazy styleId={highlightedStyle.id} swatches={storyData.palette} />
            <CuratedStylesModuleLazy
              currentStyle={highlightedStyle}
              entitlements={entitlements}
              onGatePrompt={onGatePrompt}
            />
            <ShareBadgesLazy previewReady={previewReady} previewUrl={previewUrl} />
          </Suspense>
        ) : (
          stage === 'pre-upload' && <PreUploadPlaceholder />
        )}
      </DesktopRailShell>
      <MobileAccordionShell>
        <StoryTeaser highlightedStyle={highlightedStyle} stage={stage} />
        {stage === 'post-upload' && storyData && highlightedStyle ? (
          <>
            <Suspense fallback={<InsightsSkeleton />}>
              <OriginalComparisonModuleLazy
                stage={stage}
                orientation={orientation}
                styledPreviewUrl={previewUrl}
                prefersReducedMotion={prefersReducedMotion}
              />
              <DiscoverGridLazy narrative={storyData.narrative} />
              <PaletteModuleLazy styleId={highlightedStyle.id} swatches={storyData.palette} />
              <CuratedStylesModuleLazy
                currentStyle={highlightedStyle}
                entitlements={entitlements}
                onGatePrompt={onGatePrompt}
              />
              <ShareBadgesLazy previewReady={previewReady} previewUrl={previewUrl} />
            </Suspense>
          </>
        ) : (
          <PreUploadPlaceholder />
        )}
      </MobileAccordionShell>
    </>
  );

  return (
    <aside
      ref={intersectionRef}
      className={clsx(
        'w-full lg:w-[400px] px-5 py-6 lg:p-6 text-white lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto',
        className
      )}
    >
      {isDeferredReady ? content : <InsightsSkeleton />}
    </aside>
  );
};

export type { InsightsRailProps };
export default memo(InsightsRail);
