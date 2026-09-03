import { FormEvent, memo, useEffect, useMemo, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import clsx from 'clsx';
import { useCheckoutStore } from '@/store/useCheckoutStore';
import { useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import { useCanvasConfigState } from '@/store/hooks/useFounderCanvasStore';
import { useUploadState } from '@/store/hooks/useUploadStore';
import { usePreviewEntry } from '@/store/hooks/usePreviewStore';
import { useSessionState } from '@/store/hooks/useSessionStore';
import { shallow } from 'zustand/shallow';
import { createOrderPaymentIntent } from '@/utils/checkoutApi';
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import { filterPurchasableEnhancementIds } from '@/config/commerceGuards';
import { devError } from '@/utils/devLogger';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type InnerPaymentProps = {
  onSuccess: () => void;
  onBack: () => void;
  returnUrl?: string;
};

const InnerPaymentFormComponent = ({ onSuccess, onBack, returnUrl }: InnerPaymentProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const {
    contact,
    shipping,
    paymentIntentSecret,
    paymentAmount,
    paymentCurrency,
    setPaymentIntent,
    clearPaymentIntent,
  } = useCheckoutStore(
    (state) => ({
      contact: state.contact,
      shipping: state.shipping,
      paymentIntentSecret: state.paymentIntentSecret,
      paymentAmount: state.paymentAmount,
      paymentCurrency: state.paymentCurrency,
      setPaymentIntent: state.setPaymentIntent,
      clearPaymentIntent: state.clearPaymentIntent,
    }),
    shallow
  );
  const { accessToken } = useSessionState();
  const { currentStyle } = useStyleCatalogState();
  const { selectedCanvasSize, enhancements, computedTotal } = useCanvasConfigState((state) => ({
    selectedCanvasSize: state.selectedCanvasSize,
    enhancements: state.enhancements,
    computedTotal: state.computedTotal,
  }));
  const enabledEnhancements = useMemo(
    () => enhancements.filter((item) => item.enabled),
    [enhancements]
  );
  const { orientation, croppedImage } = useUploadState();
  const previewEntry = usePreviewEntry(currentStyle?.id ?? null);
  const total = computedTotal();

  const [loadingIntent, setLoadingIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (previewEntry?.status === 'ready' && previewEntry.data?.previewUrl) {
      return previewEntry.data.previewUrl;
    }
    return croppedImage;
  }, [previewEntry, croppedImage]);

  useEffect(() => {
    if (paymentAmount !== null && Math.round(total * 100) !== paymentAmount) {
      clearPaymentIntent();
    }
  }, [total, paymentAmount, clearPaymentIntent]);

  useEffect(() => {
    if (paymentIntentSecret || loadingIntent) return;
    if (!selectedCanvasSize) return;

    const hasContact =
      contact.firstName.trim() &&
      contact.lastName.trim() &&
      contact.email.trim();
    const hasShipping =
      shipping.addressLine1.trim() &&
      shipping.city.trim() &&
      shipping.region.trim() &&
      shipping.postalCode.trim();

    if (!hasContact || !hasShipping) {
      setError('Contact and shipping details are required before payment.');
      return;
    }

    const controller = new AbortController();
    let canceled = false;

    const run = async () => {
      try {
        setLoadingIntent(true);
        setError(null);
        const response = await createOrderPaymentIntent({
          payload: {
            styleId: currentStyle?.id ?? null,
            styleName: currentStyle?.name ?? null,
            canvasSizeId: selectedCanvasSize,
            orientation,
            enhancementIds: filterPurchasableEnhancementIds(enabledEnhancements.map((item) => item.id)),
            previewUrl,
            contact,
            shipping,
            currency: 'usd',
          },
          accessToken,
          signal: controller.signal,
        });
        if (canceled) return;
        setPaymentIntent({
          id: response.paymentIntentId,
          clientSecret: response.clientSecret,
          amount: response.amount,
          currency: response.currency,
        });
      } catch (_intentError) {
        if (controller.signal.aborted || canceled) {
          return;
        }
        devError('checkout', 'failed to create payment intent');
        const message = 'Unable to prepare secure payment. Please try again.';
        setError(message);
      } finally {
        if (!canceled) {
          setLoadingIntent(false);
        }
      }
    };

    void run();

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [
    paymentIntentSecret,
    loadingIntent,
    selectedCanvasSize,
    orientation,
    enabledEnhancements,
    contact,
    shipping,
    previewUrl,
    currentStyle?.id,
    currentStyle?.name,
    accessToken,
    setPaymentIntent,
  ]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !paymentIntentSecret) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url:
          returnUrl ?? `${window.location.origin}/checkout?payment=success`,
        payment_method_data: {
          billing_details: {
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            email: contact.email,
            phone: contact.phone || undefined,
          },
        },
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSuccess();
  };

  const amountLabel = paymentAmount
    ? (paymentAmount / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: paymentCurrency.toUpperCase(),
      })
    : total.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white/60">
        <p>
          Wondertone uses Stripe with 3D Secure. We never store your card details.
        </p>
        <p className="mt-2 text-white/70">
          Canvas total: <span className="font-semibold text-white">{amountLabel}</span>
        </p>
        <p className="mt-1 text-xs text-white/50">
          Orientation: {ORIENTATION_PRESETS[orientation]?.label ?? 'Square'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {loadingIntent && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
          Preparing secure payment…
        </div>
      )}

      {paymentIntentSecret && !loadingIntent && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <PaymentElement
            options={{
              layout: 'tabs',
              business: { name: 'Wondertone Studio' },
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
          disabled={submitting}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || !paymentIntentSecret || submitting}
          className={clsx(
            'rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(99,102,241,0.45)] transition',
            submitting ? 'opacity-60' : 'hover:scale-[1.02]'
          )}
        >
          {submitting ? 'Processing…' : 'Make It Official →'}
        </button>
      </div>
    </form>
  );
};

const InnerPaymentForm = memo(InnerPaymentFormComponent);

type PaymentStepProps = {
  onSuccess: () => void;
  onBack: () => void;
  returnUrl?: string;
};

const PaymentStep = ({ onSuccess, onBack, returnUrl }: PaymentStepProps) => {
  const paymentIntentSecret = useCheckoutStore((state) => state.paymentIntentSecret);

  if (!publishableKey || !stripePromise) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        Stripe publishable key is not configured. Add <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to enable payments.
      </div>
    );
  }

  const options: StripeElementsOptions | undefined = paymentIntentSecret
    ? {
        clientSecret: paymentIntentSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#8b5cf6',
            colorBackground: '#0f172a',
            colorText: '#f8fafc',
            colorDanger: '#f87171',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      {options ? (
        <Elements stripe={stripePromise} options={options} key={paymentIntentSecret ?? 'empty'}>
          <InnerPaymentForm onSuccess={onSuccess} onBack={onBack} returnUrl={returnUrl} />
        </Elements>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
          Preparing secure payment…
        </div>
      )}
    </div>
  );
};

export default PaymentStep;
