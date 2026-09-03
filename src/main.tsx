import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles/tailwind.css';
import AppShellSkeleton from '@/components/skeletons/AppShellSkeleton';
import StudioShellSkeleton from '@/components/skeletons/StudioShellSkeleton';
import StudioProviders from '@/routes/StudioProviders';
import AuthProvider from '@/providers/AuthProvider';

const MarketingRoutes = lazy(() => import('@/routes/MarketingRoutes'));
const StudioRoutes = lazy(() => import('@/routes/StudioRoutes'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const MemorialPage = lazy(() => import('@/pages/MemorialPage'));

const MarketingContainer = () => (
  <AuthProvider>
    <Suspense fallback={<AppShellSkeleton />}>
      <MarketingRoutes />
    </Suspense>
  </AuthProvider>
);

const StudioContainer = () => (
  <StudioProviders>
    <Suspense fallback={<StudioShellSkeleton />}>
      <StudioRoutes />
    </Suspense>
  </StudioProviders>
);

const CheckoutContainer = () => (
  <StudioProviders>
    <Suspense fallback={<StudioShellSkeleton />}>
      <CheckoutPage />
    </Suspense>
  </StudioProviders>
);

const MemorialContainer = () => (
  <StudioProviders>
    <Suspense fallback={<StudioShellSkeleton />}>
      <MemorialPage />
    </Suspense>
  </StudioProviders>
);

const App = () => {
  return (
    <Routes>
      <Route path="/memorial/*" element={<MemorialContainer />} />
      <Route path="/create/*" element={<StudioContainer />} />
      <Route path="/studio/usage/*" element={<StudioContainer />} />
      <Route path="/checkout/*" element={<CheckoutContainer />} />
      <Route path="/*" element={<MarketingContainer />} />
    </Routes>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
