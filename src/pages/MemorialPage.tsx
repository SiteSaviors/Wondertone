import { Suspense, lazy, useEffect } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';
import FounderNavigation from '@/components/navigation/FounderNavigation';
import { ProductSurfaceProvider } from '@/providers/ProductSurfaceProvider';
import { trackVisit } from '@/utils/telemetry';
import { Link } from 'react-router-dom';

const LaunchflowAccordionLazy = lazy(() => import('@/sections/LaunchpadLayout'));
const StudioConfiguratorLazy = lazy(() => import('@/sections/StudioConfigurator'));

const LaunchflowSkeleton = () => (
  <section className="border-b border-white/10 bg-slate-950/60 py-16">
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6">
      <div className="h-16 rounded-3xl bg-white/5 animate-pulse" />
    </div>
  </section>
);

const StudioConfiguratorSkeleton = () => (
  <section className="bg-slate-900 py-16">
    <div className="mx-auto flex max-w-[1800px] flex-col gap-6 px-6">
      <div className="h-10 w-48 rounded-full bg-white/5 animate-pulse" />
      <div className="h-[360px] rounded-[2.5rem] bg-white/5 animate-pulse" />
    </div>
  </section>
);

const MemorialHero = () => (
  <section className="border-b border-white/10 bg-slate-950 px-6 pt-36 pb-16 sm:pt-40 sm:pb-20">
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Bring them back in art.
      </h1>
      <p className="text-lg text-white/75 sm:text-xl">
        Upload a photo. Choose a style. See them again. No prompts.
      </p>
      <a
        href="#launchflow"
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-8 py-3 text-sm font-semibold text-white shadow-glow-purple"
      >
        Upload a photo.
      </a>
    </div>
  </section>
);

const MemorialPage = () => {
  useEffect(() => {
    trackVisit();
  }, []);

  return (
    <ProductSurfaceProvider surface="memorial">
      <LazyMotion features={domAnimation}>
        <div className="min-h-screen bg-slate-950 text-white">
          <FounderNavigation />
          <MemorialHero />
          <Suspense fallback={<LaunchflowSkeleton />}>
            <LaunchflowAccordionLazy />
          </Suspense>
          <Suspense fallback={<StudioConfiguratorSkeleton />}>
            <StudioConfiguratorLazy />
          </Suspense>
          <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/45">
            <p>
              <Link to="/privacy" className="underline underline-offset-4">
                Privacy
              </Link>
              {' · '}
              <Link to="/terms" className="underline underline-offset-4">
                Terms
              </Link>
            </p>
          </footer>
        </div>
      </LazyMotion>
    </ProductSurfaceProvider>
  );
};

export default MemorialPage;
