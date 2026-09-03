import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProductHeroSection from '@/sections/ProductHeroSection';
import FounderNavigation from '@/components/navigation/FounderNavigation';
import { LazyMotion, domAnimation } from 'framer-motion';
import { useStyleCatalogActions, useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import InstantBreadthStrip from '@/sections/studio/InstantBreadthStrip';
import StyleInspirationSection from '@/sections/studio/StyleInspirationSection';
import SocialProofSection from '@/sections/studio/SocialProofSection';
import CanvasQualityStrip from '@/sections/studio/CanvasQualityStrip';
import { ProductSurfaceProvider, useProductSurface } from '@/providers/ProductSurfaceProvider';
import { trackVisit } from '@/utils/telemetry';

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

const FirstPathFulfillmentModules = () => {
  const { rules } = useProductSurface();
  return (
    <>
      {!rules.hideSocialProof && <SocialProofSection />}
      {!rules.hideCanvasRail && <CanvasQualityStrip />}
    </>
  );
};

const StudioPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { preselectedStyleId } = useStyleCatalogState();
  const { setPreselectedStyle } = useStyleCatalogActions();
  const [checkoutNotice, setCheckoutNotice] = useState<{ variant: 'success' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    trackVisit();
  }, []);

  useEffect(() => {
    const queryValue = searchParams.get('preselected_style');
    const stateValue = (location.state as { preselectedStyle?: string } | undefined)?.preselectedStyle;
    const candidate = (queryValue ?? stateValue ?? '').trim();
    if (!candidate) return;

    const normalized = candidate.toLowerCase();
    if (preselectedStyleId && preselectedStyleId === normalized) return;

    setPreselectedStyle(normalized);
  }, [location.state, preselectedStyleId, searchParams, setPreselectedStyle]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutStatus = params.get('checkout');

    if (checkoutStatus === 'success') {
      // Redirect is not conversion and must not unlock success UI or download.
    } else if (checkoutStatus === 'cancelled') {
      setCheckoutNotice({
        variant: 'warning',
        message: 'Checkout was cancelled. Adjust your canvas and try again whenever you’re ready.',
      });
    }

    if (checkoutStatus) {
      params.delete('checkout');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return (
    <ProductSurfaceProvider surface="studio">
      <LazyMotion features={domAnimation}>
        <div className="bg-slate-950 min-h-screen text-white">
          <FounderNavigation />
          <ProductHeroSection />
          <Suspense fallback={<LaunchflowSkeleton />}>
            <LaunchflowAccordionLazy />
          </Suspense>
          <Suspense fallback={<StudioConfiguratorSkeleton />}>
            <StudioConfiguratorLazy
              checkoutNotice={checkoutNotice}
              onDismissCheckoutNotice={() => setCheckoutNotice(null)}
            />
          </Suspense>
          <InstantBreadthStrip />
          <StyleInspirationSection />
          <FirstPathFulfillmentModules />
        </div>
      </LazyMotion>
    </ProductSurfaceProvider>
  );
};

export default StudioPage;
