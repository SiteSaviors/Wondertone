import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import { useAuthModal } from '@/store/useAuthModal';
import { useSessionState } from '@/store/hooks/useSessionStore';
import { useFounderStore } from '@/store/useFounderStore';
import { shallow } from 'zustand/shallow';

type CanvasHighlight = {
  id: string;
  label: string;
  headline: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

const HIGHLIGHTS: CanvasHighlight[] = [
  {
    id: 'craft',
    label: 'Archival Craft',
    headline: 'Matte cotton–poly weave keeps color luminous without glare.',
    description:
      'Each canvas is stretched by hand over radiata pine frames sourced from renewable forests for heirloom stability.',
    imageSrc: '/images/placeholders/canvas-detail-1.jpg',
    imageAlt: 'Close-up of Wondertone matte canvas texture',
  },
  {
    id: 'ready',
    label: 'Ready to Hang',
    headline: 'Vertical, horizontal, and square formats in curated sizes.',
    description:
      'Soft rubber corner supports protect walls and pre-installed hardware means every piece arrives gallery-ready.',
    imageSrc: '/images/placeholders/canvas-lifestyle-1.jpg',
    imageAlt: 'Wondertone canvas displayed in a modern living room',
  },
  {
    id: 'shipping',
    label: 'Shipping & Care',
    headline: 'Impact-tested packaging protects every corner in transit.',
    description:
      'Foam guards, moisture wrap, and studio handling protect the canvas in transit.',
    imageSrc: '/images/placeholders/canvas-packaging-1.jpg',
    imageAlt: 'Wondertone canvas protected inside premium packaging',
  },
];

const CanvasHighlightCard = ({
  label,
  headline,
  description,
  imageSrc,
  imageAlt,
  prefersReducedMotion,
}: CanvasHighlight & { prefersReducedMotion: boolean }) => {
  const motionClasses = prefersReducedMotion
    ? ''
    : 'motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:shadow-[0_16px_36px_rgba(12,16,32,0.35)] motion-safe:group-focus-within:-translate-y-1 motion-safe:group-focus-within:shadow-[0_16px_36px_rgba(12,16,32,0.35)]';

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.07] backdrop-blur-lg transition-all duration-500 ${motionClasses}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-white/[0.18] opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-75 motion-safe:group-focus-within:opacity-75" />
      <div className="relative flex flex-col gap-4 p-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <img src={imageSrc} alt={imageAlt} loading="lazy" className="h-36 w-full object-cover" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200/75">{label}</span>
        <h3 className="text-lg font-semibold text-white">{headline}</h3>
        <p className="text-sm leading-relaxed text-white/75">{description}</p>
      </div>
    </article>
  );
};

const CanvasQualityStrip = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const openAuthModal = useAuthModal((state) => state.openModal);
  const { sessionUser } = useSessionState();
  const { croppedImage, requestUpload, openCanvasModal } = useFounderStore(
    (state) => ({
      croppedImage: state.croppedImage,
      requestUpload: state.requestUpload,
      openCanvasModal: state.openCanvasModal,
    }),
    shallow
  );
  const [ctaBusy, setCtaBusy] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const impressionLogged = useRef(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || impressionLogged.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !impressionLogged.current) {
            impressionLogged.current = true;
            trackSocialProofEvent({ type: 'canvas_quality_impression', surface: 'studio' });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.45 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const handleSeePricing = () => {
    if (ctaBusy) return;
    setCtaBusy(true);
    trackSocialProofEvent({
      type: 'canvas_quality_cta_click',
      surface: 'pricing',
      authed: Boolean(sessionUser),
      hasUpload: Boolean(croppedImage),
    });
    navigate('/pricing', { state: { from: 'studio_canvas_quality' } });
    setCtaBusy(false);
  };

  const handleCreateCanvas = () => {
    if (ctaBusy) return;
    setCtaBusy(true);
    trackSocialProofEvent({
      type: 'canvas_quality_cta_click',
      surface: 'create_canvas',
      authed: Boolean(sessionUser),
      hasUpload: Boolean(croppedImage),
    });

    if (!sessionUser) {
      openAuthModal('signup', { source: 'canvas-quality' });
      setCtaBusy(false);
      return;
    }

    if (croppedImage) {
      openCanvasModal('canvas-quality-strip');
      setCtaBusy(false);
      return;
    }

    requestUpload();
    setCtaBusy(false);
  };

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-white/5 bg-slate-950/95 py-12 text-white lg:py-14"
      data-section="canvas-quality"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(253,220,146,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(124,90,255,0.1),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-b from-white/[0.11] via-white/[0.06] to-white/[0.09] px-6 py-10 shadow-[0_45px_120px_rgba(10,12,24,0.55)] backdrop-blur-xl sm:px-10 lg:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,231,178,0.42),transparent_52%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_center,rgba(141,103,255,0.24),transparent_60%)]" />

          <div className="relative space-y-10">
            <header className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.14] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/75">
                Canvas Quality
              </span>
              <h2 className="font-poppins text-[32px] font-semibold leading-tight text-white sm:text-[38px]">
                Digital creators get fast. Canvas lovers get forever.
              </h2>
              <p className="mx-auto max-w-3xl text-base text-white/80">
                Wondertone canvases move from preview to gallery wall without extra work—archival materials, ready-to-hang
                finishing, and careful shipping are all included.
              </p>
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              {HIGHLIGHTS.map((item) => (
                <div key={item.id} className="group">
                  <CanvasHighlightCard {...item} prefersReducedMotion={prefersReducedMotion} />
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/55">Canvas confidence</h3>
              <p className="max-w-3xl text-sm text-white/75">
                Review every detail above—or dive straight into the canvas workflow and see your art framed in minutes.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSeePricing}
                  disabled={ctaBusy}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/[0.12] px-6 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white transition hover:border-white/45 hover:bg-white/[0.18] focus:outline-none focus:ring-2 focus:ring-amber-200/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  See Canvas Pricing
                </button>
                <button
                  type="button"
                  onClick={handleCreateCanvas}
                  disabled={ctaBusy}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.35)] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-amber-200/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Create Canvas Art
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default memo(CanvasQualityStrip);
