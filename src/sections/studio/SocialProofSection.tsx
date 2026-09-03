import { Component, ReactNode, memo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import { useAuthModal } from '@/store/useAuthModal';
import { HERO_STATS, SPOTLIGHTS } from '@/config/socialProofContent';
import PressStrip from './components/socialProof/PressStrip';
import { trackSocialProofEvent } from '@/utils/telemetry';
import useDeferredRender from '@/hooks/useDeferredRender';

const SpotlightRailLazy = lazy(() => import('./components/SpotlightRail'));

class SocialProofErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[SocialProof] Error rendering section', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="border-t border-white/5 bg-slate-950/95 py-12 text-center text-white/60">
          <p>We&apos;re working on refreshing creator stories—check back soon.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

const SocialProofSectionInner = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const openAuthModal = useAuthModal((state) => state.openModal);

  if (!SPOTLIGHTS.length) {
    return null;
  }

  const startPreview = () => {
    trackSocialProofEvent({ type: 'social_proof_cta_click', surface: 'primary' });
    navigate('/create');
  };

  const handleSpotlightCta = (story: (typeof SPOTLIGHTS)[number]) => {
    trackSocialProofEvent({
      type: 'social_proof_cta_click',
      surface: 'spotlight',
      context: story.id,
    });
    openAuthModal('signup', { source: 'social-proof', styleId: story.id });
  };

  const handleCanvasLink = (target: 'footnote', href?: string) => {
    trackSocialProofEvent({ type: 'social_proof_canvas_link_click', target, href });
    if (!href) return;
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      className="relative border-t border-white/5 bg-slate-950/95 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_60%)] pt-0 pb-20 text-white lg:pb-24"
      data-section="social-proof"
    >
      <PressStrip prefersReducedMotion={prefersReducedMotion} />
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-16 px-6 mt-16">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
            Proof of Wonder
          </div>
          <h2 className="font-poppins text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-[52px]">
            Transform a photo into artwork.
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/70 sm:text-lg">
            Watermark-free digital exports for your feed or portfolio. Premium canvases when
            you want a gallery piece on the wall.
          </p>
        </header>

        {/* Spotlight rail */}
        <DeferredSpotlightRail
          prefersReducedMotion={prefersReducedMotion}
          onSpotlightCta={handleSpotlightCta}
        />

        {/* Stats */}
        <div className="grid w-full gap-4 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div
              key={stat.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center backdrop-blur-sm"
            >
              <div className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.3em] text-white/60">
                {stat.label}
              </div>
              <p className="mt-3 text-sm text-white/50">{stat.description}</p>
            </div>
          ))}
        </div>

        {/* CTA capsule */}
        <div className="flex flex-col items-center gap-4 text-center">
          <button
            type="button"
            onClick={startPreview}
            className="rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 px-8 py-3 text-base font-semibold text-slate-900 shadow-[0_0_25px_rgba(251,191,36,0.35)] transition hover:scale-[1.02]"
          >
            Start Free Preview
          </button>
          <p className="text-sm text-white/60">
            No card required • 60-second setup • Watermark-free when you upgrade
          </p>
          <button
            type="button"
            onClick={() => handleCanvasLink('footnote', '#canvas-quality')}
            className="text-sm font-semibold text-amber-300 transition hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            See canvas quality →
          </button>
        </div>
      </div>
    </section>
  );
};

const MemoizedInner = memo(SocialProofSectionInner);

const SocialProofSection = () => (
  <SocialProofErrorBoundary>
    <MemoizedInner />
  </SocialProofErrorBoundary>
);

export default SocialProofSection;
const SpotlightSkeleton = () => (
  <div className="grid gap-6 lg:grid-cols-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={`spotlight-skeleton-${index}`}
        className="h-[320px] rounded-3xl border border-white/10 bg-white/[0.04] animate-pulse"
      />
    ))}
  </div>
);

type DeferredSpotlightProps = {
  prefersReducedMotion: boolean;
  onSpotlightCta: (story: (typeof SPOTLIGHTS)[number]) => void;
};

const DeferredSpotlightRail = ({ prefersReducedMotion, onSpotlightCta }: DeferredSpotlightProps) => {
  const [intersectionRef, isReady] = useDeferredRender({ rootMargin: '200px 0px 0px 0px' });

  return (
    <div ref={intersectionRef} className="relative">
      {isReady ? (
        <Suspense fallback={<SpotlightSkeleton />}>
          <SpotlightRailLazy prefersReducedMotion={prefersReducedMotion} onSpotlightCta={onSpotlightCta} />
        </Suspense>
      ) : (
        <SpotlightSkeleton />
      )}
    </div>
  );
};
