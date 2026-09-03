import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FounderNavigation from '@/components/navigation/FounderNavigation';
import Section from '@/components/layout/Section';
import TierCard from '@/components/ui/TierCard';
import PricingBenefitsStrip from '@/components/ui/PricingBenefitsStrip';
import FloatingOrbs from '@/components/ui/FloatingOrbs';
import PricingModeToggle, { PricingMode } from '@/components/ui/PricingModeToggle';
import TokenPackCard from '@/components/ui/TokenPackCard';
import PricingSection from '@/components/ui/PricingSection';
import { useAuthModal } from '@/store/useAuthModal';
import { useEntitlementsActions, useEntitlementsState } from '@/store/hooks/useEntitlementsStore';
import { useSessionState } from '@/store/hooks/useSessionStore';
import { createCheckoutSession } from '@/utils/checkoutApi';
import { trackPricingToggle } from '@/utils/telemetry';
import { TOKEN_PACKS } from '@/data/tokenPacks';
import { FREE_TIER, PREMIUM_TIERS, type TierId } from '@/data/subscriptionTiers';
import useTokenPackCheckout from '@/hooks/useTokenPackCheckout';

const buildCheckoutUrl = (type: 'subscription' | 'token_pack', status: 'success' | 'cancelled') => {
  if (typeof window === 'undefined') return '/pricing';
  const params = new URLSearchParams({ checkout: status });
  if (type === 'token_pack') {
    params.set('type', 'token_pack');
  }
  return `${window.location.origin}/pricing?${params.toString()}`;
};

const SubscriptionSection = ({
  isVisible,
  currentTier,
  loadingTier,
  onSelectTier,
}: {
  isVisible: boolean;
  currentTier: EntitlementTier | null;
  loadingTier: TierId | null;
  onSelectTier: (tier: TierId) => void;
}) => {
  if (!isVisible) return null;
  return (
    <PricingSection className="space-y-12">
      <div className="mx-auto grid max-w-[1400px] gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {PREMIUM_TIERS.map((tier, index) => (
          <TierCard
            key={tier.id}
            id={tier.id}
            name={tier.name}
            price={tier.price}
            priceDetail={tier.priceDetail}
            tokensPerMonth={tier.tokensPerMonth}
            tokensLabel={tier.tokensLabel}
            features={tier.features}
            gradient={tier.gradient}
            isCurrent={tier.id === currentTier}
            isLoading={loadingTier === tier.id}
            onSelect={() => onSelectTier(tier.id)}
            animationDelay={index * 100}
          />
        ))}
      </div>

      <div className="mx-auto max-w-[900px]">
        <TierCard
          key={FREE_TIER.id}
          id={FREE_TIER.id}
          name={FREE_TIER.name}
          price={FREE_TIER.price}
          priceDetail={FREE_TIER.priceDetail}
          tokensPerMonth={FREE_TIER.tokensPerMonth}
          tokensLabel={FREE_TIER.tokensLabel}
          features={FREE_TIER.features}
          gradient={FREE_TIER.gradient}
          isCurrent={FREE_TIER.id === currentTier}
          isLoading={loadingTier === FREE_TIER.id}
          onSelect={() => onSelectTier(FREE_TIER.id)}
        />
      </div>
    </PricingSection>
  );
};

const TokenPackSection = ({
  isVisible,
  loadingPackId,
  onSelectPack,
}: {
  isVisible: boolean;
  loadingPackId: string | null;
  onSelectPack: (packId: string) => void;
}) => {
  if (!isVisible) return null;
  return (
    <PricingSection className="space-y-10">
      <div className="mx-auto text-center text-white/80">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">Pay As You Go</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Token packs for instant top-ups</h2>
        <p className="mt-3 text-sm text-white/70">
          Buy premium tokens whenever you need them—no expiration, all Wondertone styles unlocked.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-2 sm:px-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {TOKEN_PACKS.map((pack, index) => (
          <div
            key={pack.id}
            className="animate-fadeIn motion-reduce:animate-none"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <TokenPackCard
              id={pack.id}
              name={pack.name}
              tokens={pack.tokens}
              price={pack.price}
              badge={pack.badge}
              bullets={pack.bullets}
              gradient={pack.gradient}
              ctaLabel={pack.ctaLabel}
              isLoading={loadingPackId === pack.id}
              onSelect={() => onSelectPack(pack.id)}
            />
          </div>
        ))}
      </div>
    </PricingSection>
  );
};

const PricingPage = () => {
  const PENDING_CHECKOUT_TIER_KEY = 'wt_pending_checkout_tier';
  const { entitlements } = useEntitlementsState();
  const { sessionUser, accessToken } = useSessionState();
  const { hydrateEntitlements } = useEntitlementsActions();
  const openAuthModal = useAuthModal((state) => state.openModal);
  const location = useLocation();
  const navigate = useNavigate();

  const [pricingMode, setPricingMode] = useState<PricingMode>(() => deriveModeFromQuery(location.search));
  const [loadingTier, setLoadingTier] = useState<TierId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { startCheckout: startTokenPackCheckout, loadingPackId: loadingTokenPackId, resumePendingCheckout } =
    useTokenPackCheckout({
      sessionUser,
      accessToken,
      promptAuth: () => openAuthModal('signup', { source: 'pricing' }),
      buildCheckoutUrl,
    });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('checkout');
    const type = params.get('type');
    if (status === 'success') {
      setSuccessMessage(
        type === 'token_pack'
          ? 'Token purchase complete! We are adding credits to your studio…'
          : 'Checkout complete! We are upgrading your studio…'
      );
      void hydrateEntitlements();
    } else if (status === 'cancelled') {
      setErrorMessage(
        type === 'token_pack'
          ? 'Token checkout cancelled. Feel free to try again when you’re ready.'
          : 'Checkout cancelled. Feel free to try again when you’re ready.'
      );
    }

    if (status) {
      params.delete('checkout');
      params.delete('type');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, hydrateEntitlements]);

  const currentTier = entitlements.tier;

  const startCheckout = useCallback(async (tier: TierId) => {
    try {
      setLoadingTier(tier);
      const { url } = await createCheckoutSession({
        tier,
        accessToken,
        successUrl: buildCheckoutUrl('subscription', 'success'),
        cancelUrl: buildCheckoutUrl('subscription', 'cancelled'),
      });
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoadingTier(null);
    }
  }, [accessToken]);

  const handleSelectTier = useCallback(async (tier: TierId) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (tier === 'free') {
      navigate('/create');
      return;
    }

    if (!sessionUser) {
      try {
        window.sessionStorage.setItem(PENDING_CHECKOUT_TIER_KEY, tier);
      } catch {
        // ignore storage issues
      }
      openAuthModal('signup', { source: 'pricing' });
      return;
    }

    await startCheckout(tier);
  }, [navigate, openAuthModal, sessionUser, startCheckout]);

  useEffect(() => {
    if (!sessionUser || !accessToken) return;
    let pendingTier: TierId | null = null;
    try {
      const stored = window.sessionStorage.getItem(PENDING_CHECKOUT_TIER_KEY);
      pendingTier = stored ? (stored as TierId) : null;
    } catch {
      pendingTier = null;
    }
    if (pendingTier) {
      try {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_TIER_KEY);
      } catch {
        // ignore
      }
      void handleSelectTier(pendingTier);
    }
  }, [sessionUser, accessToken, handleSelectTier]);

  const [modeAnnouncement, setModeAnnouncement] = useState(
    'Showing subscription plans with monthly memberships.'
  );

  const handlePricingModeChange = useCallback(
    (mode: PricingMode) => {
      setPricingMode(mode);
      trackPricingToggle(mode);
      setModeAnnouncement(
        mode === 'subscription'
          ? 'Showing subscription plans with monthly memberships.'
          : 'Showing pay as you go token packs.'
      );
    },
    []
  );
  useEffect(() => {
    const nextMode = deriveModeFromQuery(location.search);
    setPricingMode((current) => (current === nextMode ? current : nextMode));
  }, [location.search]);

  const handleSelectTokenPack = useCallback(
    async (packId: string) => {
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await startTokenPackCheckout(packId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start checkout. Please try again.';
        setErrorMessage(message);
      }
    },
    [startTokenPackCheckout]
  );

  useEffect(() => {
    void resumePendingCheckout();
  }, [resumePendingCheckout]);


  return (
    <div className="noise-texture relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#0a0520_0%,#1a0d4d_35%,#0d1b3a_70%,#041628_100%)] text-white">
      {/* Base gradient overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(116,62,255,0.4),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(9,211,239,0.3),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_65%)]" />

      {/* Floating orbs background */}
      <FloatingOrbs />

      {/* Navigation */}
      <FounderNavigation />

      <main className="relative pb-24 pt-20">
        <Section className="space-y-12">
          {/* Hero section */}
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge for logged-in users */}
            {sessionUser && currentTier && currentTier !== 'free' && (
              <div className="animate-fadeIn mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-purple-200 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500"></span>
                </span>
                Current: {currentTier} tier
              </div>
            )}

            <div className="space-y-6">
              {/* Main headline with gradient */}
              <h1 className="animate-scaleIn text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-white via-purple-100 to-cyan-100 bg-clip-text text-transparent">
                  Choose the plan
                </span>
                <br />
                <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 bg-clip-text text-transparent">
                  that fits your story
                </span>
              </h1>

              {/* Subheadline */}
              <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/75 md:text-lg">
                Scale from personal keepsakes to live pop-up studios with monthly memberships or pay-as-you-go packs built
                for emotion-rich art. Every option includes Wondertone&apos;s{' '}
                <span className="font-semibold text-cyan-300">curated style library</span>.
              </p>

              <div className="flex flex-col items-center gap-2">
                <PricingModeToggle mode={pricingMode} onChange={handlePricingModeChange} />
                <p className="sr-only" aria-live="polite" role="status">
                  {modeAnnouncement}
                </p>
                <p className="text-sm text-white/60 text-center sm:text-base">
                  {pricingMode === 'subscription'
                    ? 'Subscribe & Save unlocks monthly tokens, premium previews, and concierge perks.'
                    : 'Pay As You Go lets you top up tokens anytime with one-time purchases.'}
                </p>
              </div>
            </div>

            {/* Status messages */}
            {successMessage && (
              <div className="animate-scaleIn mx-auto max-w-2xl rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✓</span>
                  <span>{successMessage}</span>
                </div>
              </div>
            )}
            {errorMessage && (
              <div className="animate-scaleIn mx-auto max-w-2xl rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-sm text-red-200 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚠</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}
          </div>

          <SubscriptionSection
            isVisible={pricingMode === 'subscription'}
            currentTier={currentTier ?? null}
            loadingTier={loadingTier}
            onSelectTier={handleSelectTier}
          />
          <TokenPackSection
            isVisible={pricingMode === 'payg'}
            loadingPackId={loadingTokenPackId}
            onSelectPack={handleSelectTokenPack}
          />

          {/* Benefits strip */}
          <PricingBenefitsStrip />
        </Section>
      </main>
    </div>
  );
};

export default PricingPage;
export { SubscriptionSection };
const deriveModeFromQuery = (search: string): PricingMode => {
  const params = new URLSearchParams(search);
  const modeParam = params.get('mode');
  if (modeParam === 'payg' || modeParam === 'subscription') {
    return modeParam;
  }
  return 'subscription';
};
