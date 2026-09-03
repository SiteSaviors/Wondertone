import { lazy, type ReactElement } from 'react';
import { useRoutes } from 'react-router-dom';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const GalleryPage = lazy(() => import('@/pages/GalleryPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const GiftPage = lazy(() => import('@/pages/GiftPage'));

const MarketingRoutes = (): ReactElement => {
  const element = useRoutes([
    { path: '/', element: <LandingPage /> },
    { path: '/pricing', element: <PricingPage /> },
    { path: '/studio/gallery', element: <GalleryPage /> },
    { path: '/privacy', element: <PrivacyPage /> },
    { path: '/terms', element: <TermsPage /> },
    { path: '/gift', element: <GiftPage /> },
    { path: '*', element: <LandingPage /> },
  ]);

  const content = element ?? <LandingPage />;

  return content;
};

export default MarketingRoutes;
