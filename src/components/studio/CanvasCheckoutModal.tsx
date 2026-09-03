import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CANVAS_SIZE_OPTIONS, getCanvasSizeOption } from '@/utils/canvasSizes';
import { type CanvasModalCloseReason } from '@/store/founder/storeTypes';
import { useCheckoutStore } from '@/store/useCheckoutStore';
import { useCanvasConfigState, useCanvasModalState, useUploadPipelineState } from '@/store/hooks/useFounderCanvasStore';
import { useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import { useUploadState } from '@/store/hooks/useUploadStore';
import { useEntitlementsState } from '@/store/hooks/useEntitlementsStore';
import {
  trackOrderStarted,
  trackOrderCompleted,
  trackCheckoutStepView,
  trackCheckoutExit,
  trackCheckoutRecommendationShown,
} from '@/utils/telemetry';
import { SHOW_STATIC_TESTIMONIALS } from '@/config/featureFlags';
import { getCanvasRecommendation } from '@/utils/canvasRecommendations';
import CanvasCheckoutPreviewColumn from '@/components/studio/CanvasCheckoutPreviewColumn';
import { CANVAS_PREVIEW_ASSETS } from '@/utils/canvasPreviewAssets';
import { shallow } from 'zustand/shallow';
import CanvasCheckoutShell from '@/components/studio/CanvasCheckoutShell';
import CanvasCheckoutCanvasStep from '@/components/studio/CanvasCheckoutCanvasStep';
import CanvasCheckoutContactStep from '@/components/studio/CanvasCheckoutContactStep';
import CanvasCheckoutShippingStep from '@/components/studio/CanvasCheckoutShippingStep';
import CanvasCheckoutPaymentStep from '@/components/studio/CanvasCheckoutPaymentStep';
import CanvasCheckoutSuccessStep from '@/components/studio/CanvasCheckoutSuccessStep';
import CanvasCheckoutMobileDrawer from '@/components/studio/CanvasCheckoutMobileDrawer';
import useMobilePreviewDrawer from '@/components/studio/hooks/useMobilePreviewDrawer';

const CanvasInRoomPreview = lazy(() => import('@/components/studio/CanvasInRoomPreview'));

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const CanvasCheckoutModal = () => {
  const closingReasonRef = useRef<CanvasModalCloseReason | null>(null);
  const { canvasModalOpen, closeCanvasModal } = useCanvasModalState((state) => ({
    canvasModalOpen: state.canvasModalOpen,
    closeCanvasModal: state.closeCanvasModal,
  }));
  const { orientationPreviewPending } = useUploadPipelineState((state) => ({
    orientationPreviewPending: state.orientationPreviewPending,
  }));
  const { selectedCanvasSize, selectedFrame, enhancements, computedTotal } = useCanvasConfigState((state) => ({
    selectedCanvasSize: state.selectedCanvasSize,
    selectedFrame: state.selectedFrame,
    enhancements: state.enhancements,
    computedTotal: state.computedTotal,
  }));
  const { orientation, smartCrops } = useUploadState();
  const { currentStyle } = useStyleCatalogState();
  const { userTier } = useEntitlementsState();

  const { step, setStep, enterModalCheckout, leaveModalCheckout, shipping } = useCheckoutStore(
    (state) => ({
      step: state.step,
      setStep: state.setStep,
      enterModalCheckout: state.enterModalCheckout,
      leaveModalCheckout: state.leaveModalCheckout,
      shipping: state.shipping,
    }),
    shallow
  );

  const floatingFrame = useMemo(
    () => enhancements.find((item) => item.id === 'floating-frame'),
    [enhancements]
  );
  const floatingFrameEnabled = Boolean(floatingFrame?.enabled);

  // Canvas size recommendation based on image resolution + orientation
  const recommendation = useMemo(() => {
    const currentCrop = smartCrops[orientation];
    return getCanvasRecommendation(
      orientation,
      currentCrop?.imageDimensions?.width,
      currentCrop?.imageDimensions?.height
    );
  }, [orientation, smartCrops]);

  const sizeOptions = CANVAS_SIZE_OPTIONS[orientation];
  const total = computedTotal();
  const selectedSizeOption = selectedCanvasSize ? getCanvasSizeOption(selectedCanvasSize) : null;
  const previewAsset = useMemo(() => {
    if (!selectedCanvasSize) return null;
    return CANVAS_PREVIEW_ASSETS[selectedCanvasSize] ?? null;
  }, [selectedCanvasSize]);
  const frameKey = selectedFrame ?? 'none';
  const previewRoomSrc = previewAsset?.roomSrc[frameKey] ?? previewAsset?.roomSrc.none;
  const previewArtRect = previewAsset?.artRectPct[frameKey] ?? previewAsset?.artRectPct.none;
  const hasEnabledEnhancements = enhancements.some((item) => item.enabled);
  const shippingCountry = shipping?.country ?? null;
  const isCanvasStep = step === 'canvas';
  const isContactStep = step === 'contact';
  const isShippingStep = step === 'shipping';
  const isPaymentStep = step === 'payment';
  const isSuccessStep = step === 'success';
  const handleContactNext = useCallback(() => setStep('shipping'), [setStep]);
  const handleShippingBack = useCallback(() => setStep('contact'), [setStep]);
  const handleShippingNext = useCallback(() => setStep('payment'), [setStep]);
  const handlePaymentBack = useCallback(() => setStep('shipping'), [setStep]);
  const handlePaymentSuccess = useCallback(() => setStep('success'), [setStep]);
  const modalReturnUrl = typeof window !== 'undefined' ? `${window.location.origin}/studio?checkout=success&surface=canvas-modal` : undefined;

  const successTimeline = [
    {
      icon: '📧',
      title: 'Confirmation sent',
      body: "We've emailed your receipt and concierge contact.",
    },
    {
      icon: '🎨',
      title: 'Canvas in production',
      body: 'Our artisans are stretching your premium print by hand.',
    },
    {
      icon: '🚚',
      title: 'Shipping in 5-7 days',
      body: 'Tracking information arrives the moment it leaves our atelier.',
    },
  ];

  const [exitPromptReason, setExitPromptReason] = useState<CanvasModalCloseReason | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [triggerFrameShimmer, setTriggerFrameShimmer] = useState(false);
  const frameSectionRef = useRef<HTMLElement | null>(null);
  const sizeSectionRef = useRef<HTMLElement | null>(null);
  const [timerSeed, setTimerSeed] = useState<number | null>(null);
  const recommendationLoggedRef = useRef<Set<string>>(new Set());
  const {
    expanded: mobilePreviewExpanded,
    hasAutoExpandedOnce,
    handleAutoExpandDrawer,
    handleDrawerPointerDown,
    handleDrawerToggle,
    collapseDrawer,
    clearDrawerPulseTimeouts,
  } = useMobilePreviewDrawer();

  const handleFrameShimmer = useCallback(() => {
    setTriggerFrameShimmer(true);
    window.setTimeout(() => {
      setTriggerFrameShimmer(false);
    }, 300);
  }, []);

  const scrollToSection = useCallback((sectionRef: RefObject<HTMLElement | null>) => {
    const modalContent = document.querySelector('[data-modal-content]');
    if (modalContent && sectionRef.current) {
      modalContent.scrollTo({ top: sectionRef.current.offsetTop - 20, behavior: 'smooth' });
    }
  }, []);

  const commitClose = useCallback(
    (reason: CanvasModalCloseReason) => {
      closingReasonRef.current = reason;
      closeCanvasModal(reason);
    },
    [closeCanvasModal]
  );

  const shouldConfirmExit = step !== 'canvas' && step !== 'success';

  const requestClose = useCallback(
    (reason: CanvasModalCloseReason) => {
      if (shouldConfirmExit) {
        setExitPromptReason(reason);
        return;
      }
      setExitPromptReason(null);
      commitClose(reason);
    },
    [commitClose, shouldConfirmExit]
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const pending = closingReasonRef.current;
      closingReasonRef.current = null;
      if (!pending) {
        requestClose('dismiss');
      }
    }
  };

  const modalSessionActiveRef = useRef(false);
  const telemetryFiredRef = useRef(false);
  const confettiTriggeredRef = useRef(false);
  const orderCompletionTrackedRef = useRef(false);
  useEffect(() => {
    if (canvasModalOpen) {
      if (!modalSessionActiveRef.current) {
        enterModalCheckout();
        telemetryFiredRef.current = false;
        modalSessionActiveRef.current = true;
      }
      return;
    }

    if (modalSessionActiveRef.current) {
      leaveModalCheckout();
      telemetryFiredRef.current = false;
      modalSessionActiveRef.current = false;
    }
  }, [canvasModalOpen, enterModalCheckout, leaveModalCheckout]);

  useEffect(() => {
    if (canvasModalOpen) {
      setTimerSeed(Date.now());
      recommendationLoggedRef.current = new Set();
      return;
    }
    collapseDrawer();
    setTimerSeed(null);
    clearDrawerPulseTimeouts();
  }, [canvasModalOpen, clearDrawerPulseTimeouts, collapseDrawer]);

  useEffect(() => {
    if (!canvasModalOpen) return undefined;
    if (!shouldConfirmExit) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [canvasModalOpen, shouldConfirmExit]);

  useEffect(() => {
    if (step === 'success') {
      if (!confettiTriggeredRef.current) {
        confettiTriggeredRef.current = true;
        void import('canvas-confetti')
          .then(({ default: confetti }) => {
            const base = {
              spread: 70,
              ticks: 120,
              colors: ['#8b5cf6', '#a855f7', '#60a5fa', '#22d3ee', '#f472b6', '#fbbf24'],
            };
            confetti({
              particleCount: 120,
              origin: { y: 0.3 },
              ...base,
            });
            confetti({
              particleCount: 80,
              angle: 60,
              origin: { x: 1, y: 0.3 },
              ...base,
            });
            confetti({
              particleCount: 80,
              angle: 120,
              origin: { x: 0, y: 0.3 },
              ...base,
            });
          })
          .catch((error) => {
            console.warn('[canvas-checkout] failed to load confetti', error);
          });
      }
      if (!orderCompletionTrackedRef.current) {
        trackOrderCompleted(userTier, total, hasEnabledEnhancements, shippingCountry);
        orderCompletionTrackedRef.current = true;
      }
    } else {
      confettiTriggeredRef.current = false;
      orderCompletionTrackedRef.current = false;
    }
  }, [step, userTier, total, hasEnabledEnhancements, shippingCountry]);

  useEffect(() => {
    if (step !== 'success' && shareFeedback) {
      setShareFeedback(null);
    }
  }, [step, shareFeedback]);

  useEffect(() => {
    trackCheckoutStepView(step, userTier);
  }, [step, userTier]);

  // Track recommendation impressions when canvas step loads
  useEffect(() => {
    if (!(canvasModalOpen && step === 'canvas')) {
      return;
    }

    sizeOptions.forEach((option) => {
      const key = `${orientation}:${option.id}`;
      if (recommendationLoggedRef.current.has(key)) {
        return;
      }
      const isRecommended = option.id === recommendation.recommendedSize;
      const isMostPopular = option.id === recommendation.mostPopularSize;
      trackCheckoutRecommendationShown(option.id, orientation, isRecommended, isMostPopular);
      recommendationLoggedRef.current.add(key);
    });
  }, [canvasModalOpen, step, sizeOptions, recommendation, orientation]);

  const handlePrimaryCta = useCallback(() => {
    if (step !== 'canvas') {
      return;
    }
    if (!telemetryFiredRef.current) {
      trackOrderStarted(userTier, total, hasEnabledEnhancements);
      telemetryFiredRef.current = true;
    }

    // Scroll to top of modal on step transition
    const modalContent = document.querySelector('[data-modal-content]') as HTMLElement | null;
    if (modalContent && typeof modalContent.scrollTo === 'function') {
      modalContent.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }

    setStep('contact');
  }, [hasEnabledEnhancements, setStep, step, total, userTier]);

  const handleExitStay = useCallback(() => {
    trackCheckoutExit('stay', step, exitPromptReason ?? 'unknown');
    setExitPromptReason(null);
  }, [exitPromptReason, step]);

  const handleExitLeave = useCallback(() => {
    const reason = exitPromptReason ?? 'cancel';
    trackCheckoutExit('leave', step, reason);
    setExitPromptReason(null);
    commitClose(reason);
  }, [exitPromptReason, step, commitClose]);

  const handleShareSuccess = async () => {
    const shareText = `I just ordered a Wondertone canvas${
      currentStyle?.name ? ` in ${currentStyle.name}` : ''
    }! Can't wait to hang it.`;
    const shareUrl = `${window.location.origin}/studio`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Wondertone Canvas',
          text: shareText,
          url: shareUrl,
        });
        setShareFeedback('Shared via native sheet ✨');
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      } catch (error) {
        console.warn('[canvas-checkout] share dismissed', error);
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        setShareFeedback('Link copied to clipboard');
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      } catch (error) {
        console.warn('[canvas-checkout] clipboard copy failed', error);
      }
    }

    setShareFeedback('Sharing is not supported on this device');
    setTimeout(() => setShareFeedback(null), 3500);
  };

  useEffect(() => {
    return () => {
      if (modalSessionActiveRef.current) {
        leaveModalCheckout();
        modalSessionActiveRef.current = false;
        telemetryFiredRef.current = false;
      }
      clearDrawerPulseTimeouts();
    };
  }, [leaveModalCheckout, clearDrawerPulseTimeouts]);

  const renderTrustSignals = () => (
    <section className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 transition hover:border-white/30 hover:bg-white/10">
      <div className="grid gap-3 text-center">
        <div className="rounded-2xl bg-white/10 px-3 py-3">
          <p className="text-lg">🛡️ Guaranteed</p>
          <p className="text-xs text-white/60">Love it or we’ll remake it</p>
        </div>
      </div>
    </section>
  );

  const renderTestimonialCard = () => (
    <section className="rounded-3xl border border-dashed border-white/12 bg-white/5 p-6 text-sm text-white/60 transition hover:border-white/40 hover:bg-white/10">
      "The print arrived museum-ready. Zero nails, instant conversation starter." — Avery M.
    </section>
  );



  const modalContent = (
          <div className="relative w-full max-w-[1200px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 shadow-[0_40px_120px_rgba(5,10,25,0.7)]">
            <div className="flex flex-col gap-10 lg:flex-row">
              <CanvasCheckoutPreviewColumn
                currentStyle={currentStyle ?? undefined}
                triggerFrameShimmer={triggerFrameShimmer}
                isSuccessStep={isSuccessStep}
                showStaticTestimonials={SHOW_STATIC_TESTIMONIALS}
                previewRoomAssetSrc={previewRoomSrc}
                previewArtRectPct={previewArtRect}
              />

              <div data-modal-content className="relative w-full max-h-[80vh] overflow-y-auto px-6 py-8 lg:w-[56%]">
                {/* Close button - positioned at true top-right corner */}
                <button
                  type="button"
                  onClick={() => requestClose('cancel')}
                  className="absolute right-6 top-6 z-10 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <CanvasCheckoutMobileDrawer
                  expanded={mobilePreviewExpanded}
                  selectedSizeLabel={selectedSizeOption?.label}
                  totalLabel={currency.format(total)}
                  triggerFrameShimmer={triggerFrameShimmer}
                  orientationPreviewPending={orientationPreviewPending}
                  isSuccessStep={isSuccessStep}
                  onToggle={handleDrawerToggle}
                  onPointerDown={handleDrawerPointerDown}
                >
                  <Suspense fallback={<div className="h-56 rounded-3xl bg-white/5" />}>
                    <CanvasInRoomPreview
                      showDimensions={false}
                      customRoomAssetSrc={previewRoomSrc}
                      customArtRectPct={previewArtRect}
                    />
                  </Suspense>
                </CanvasCheckoutMobileDrawer>
                {isCanvasStep && (
                  <CanvasCheckoutCanvasStep
                    canvasModalOpen={canvasModalOpen}
                    timerSeed={timerSeed}
                    frameSectionRef={frameSectionRef}
                    sizeSectionRef={sizeSectionRef}
                    floatingFrameEnabled={floatingFrameEnabled}
                    hasAutoExpandedOnce={hasAutoExpandedOnce}
                    onAutoExpandDrawer={handleAutoExpandDrawer}
                    onFrameShimmer={handleFrameShimmer}
                    onPrimaryCta={handlePrimaryCta}
                    total={total}
                    orientationPreviewPending={orientationPreviewPending}
                    scrollToSection={scrollToSection}
                  />
                )}
                {isContactStep && (
                  <CanvasCheckoutContactStep
                    onBack={() => setStep('canvas')}
                    onNext={handleContactNext}
                    total={total}
                    orientationPreviewPending={orientationPreviewPending}
                    frameSectionRef={frameSectionRef}
                    sizeSectionRef={sizeSectionRef}
                    scrollToSection={scrollToSection}
                    renderTrustSignals={renderTrustSignals}
                    renderTestimonialCard={renderTestimonialCard}
                  />
                )}
            {isShippingStep && (
              <CanvasCheckoutShippingStep
                onBack={handleShippingBack}
                onNext={handleShippingNext}
                total={total}
                orientationPreviewPending={orientationPreviewPending}
                frameSectionRef={frameSectionRef}
                sizeSectionRef={sizeSectionRef}
                scrollToSection={scrollToSection}
                renderTrustSignals={renderTrustSignals}
                renderTestimonialCard={renderTestimonialCard}
              />
            )}
            {isPaymentStep && (
              <CanvasCheckoutPaymentStep
                onBack={handlePaymentBack}
                onSuccess={handlePaymentSuccess}
                total={total}
                orientationPreviewPending={orientationPreviewPending}
                frameSectionRef={frameSectionRef}
                sizeSectionRef={sizeSectionRef}
                scrollToSection={scrollToSection}
                renderTrustSignals={renderTrustSignals}
                renderTestimonialCard={renderTestimonialCard}
                returnUrl={modalReturnUrl}
              />
            )}
            {isSuccessStep && (
              <CanvasCheckoutSuccessStep
                timeline={successTimeline}
                shareFeedback={shareFeedback}
                onShare={handleShareSuccess}
                onReturn={() => requestClose('purchase_complete')}
                total={total}
                orientationPreviewPending={orientationPreviewPending}
                frameSectionRef={frameSectionRef}
                sizeSectionRef={sizeSectionRef}
                scrollToSection={scrollToSection}
                renderTrustSignals={renderTrustSignals}
                renderTestimonialCard={renderTestimonialCard}
              />
            )}
          </div>
        </div>
      </div>

  );

  const exitPromptOpen = Boolean(exitPromptReason);

  return (
    <CanvasCheckoutShell
      open={canvasModalOpen}
      onOpenChange={handleOpenChange}
      onRequestClose={requestClose}
      exitPrompt={{ open: exitPromptOpen, onStay: handleExitStay, onLeave: handleExitLeave }}
    >
      {modalContent}
    </CanvasCheckoutShell>
  );

};

export default CanvasCheckoutModal;
