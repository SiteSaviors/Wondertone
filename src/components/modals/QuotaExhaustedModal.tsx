import { useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Zap, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { type EntitlementTier } from '@/store/founder/storeTypes';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import { clsx } from 'clsx';
import './QuotaExhaustedModal.css';

type QuotaExhaustedModalProps = {
  open: boolean;
  onClose: () => void;
  currentTier: EntitlementTier;
  remainingTokens: number | null;
  quota: number | null;
  renewAt: string | null;
};

type TierInfo = {
  name: string;
  quota: number;
  price: string;
  features: string[];
  gradient: string;
};

const TIER_DATA: Record<string, TierInfo> = {
  creator: {
    name: 'Creator',
    quota: 50,
    price: '$7.99/month',
    features: ['50 watermark-free tokens', 'Priority queue', 'Creator badge'],
    gradient: 'from-purple-500/20 via-indigo-500/20 to-blue-500/20',
  },
  plus: {
    name: 'Plus',
    quota: 150,
    price: '$19.99/month',
    features: ['150 premium tokens', 'Batch exports', 'Priority queue (2× speed)', 'Shared brand assets'],
    gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
  },
  pro: {
    name: 'Pro',
    quota: 400,
    price: '$49.99/month',
    features: ['400 premium tokens', 'Wondertone concierge', 'Priority queue (3× speed)'],
    gradient: 'from-orange-500/20 via-pink-500/20 to-red-500/20',
  },
};

const QuotaExhaustedModal = ({
  open,
  onClose,
  currentTier,
  remainingTokens: _remainingTokens,
  quota: _quota,
  renewAt,
}: QuotaExhaustedModalProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = usePrefersReducedMotion();

  const tierMessage = useMemo(() => {
    switch (currentTier) {
      case 'free':
        return {
          title: "You've Used All 10 Tokens This Month",
          subtitle: 'Upgrade to Creator for 50 watermark-free tokens and unlimited creativity!',
          showUpgrade: true,
          recommendedTier: 'creator',
        };
      case 'creator':
        return {
          title: "You've Used All 50 Tokens",
          subtitle: 'Scale up with Plus for 150 tokens/month and batch download capabilities!',
          showUpgrade: true,
          recommendedTier: 'plus',
        };
      case 'plus':
        return {
          title: "You've Reached Your 150 Token Limit",
          subtitle: 'Unlock Pro tier for 400 tokens/month and white-glove concierge support!',
          showUpgrade: true,
          recommendedTier: 'pro',
        };
      case 'pro':
        return {
          title: "You've Used All 400 Tokens",
          subtitle: 'Contact our team for enterprise solutions with custom token packages',
          showUpgrade: false,
          showContact: true,
        };
      case 'dev':
        return {
          title: 'Developer tier active',
          subtitle: 'Unlimited tokens enabled for diagnostics.',
          showUpgrade: false,
        };
      default:
        return {
          title: 'Token Limit Reached',
          subtitle: 'Upgrade to continue creating amazing art',
          showUpgrade: true,
          recommendedTier: 'creator',
        };
    }
  }, [currentTier]);

  const recommendedTierInfo = tierMessage.recommendedTier ? TIER_DATA[tierMessage.recommendedTier] : null;

  const daysUntilRenew = useMemo(() => {
    if (!renewAt) return null;
    const now = new Date();
    const renewDate = new Date(renewAt);
    const diffTime = renewDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  }, [renewAt]);

  const handleUpgrade = () => {
    if (tierMessage.recommendedTier) {
      navigate(`/pricing?tier=${tierMessage.recommendedTier}`);
    } else {
      navigate('/pricing');
    }
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={clsx(
            'quota-modal__overlay',
            prefersReducedMotion && 'quota-modal__overlay--reduced'
          )}
        />
        <Dialog.Content
          className={clsx(
            'quota-modal__content-wrapper',
            prefersReducedMotion && 'quota-modal__content-wrapper--reduced'
          )}
        >
          <div className="quota-modal">
            {/* Background glow effects */}
            <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-6 top-6 z-10 rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 px-12 py-10">
              {/* Icon + Title */}
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/40 shadow-[0_20px_60px_rgba(139,92,246,0.4)]">
                  <Zap className="h-10 w-10 text-purple-300" />
                </div>

                <div className="space-y-3">
                  <Dialog.Title className="text-3xl font-bold text-white">{tierMessage.title}</Dialog.Title>
                  <Dialog.Description className="text-base text-white/70">
                    {tierMessage.subtitle}
                  </Dialog.Description>
                </div>
              </div>

              {/* Token reset info (for time-gated tiers) */}
              {daysUntilRenew !== null && currentTier !== 'dev' && (
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Clock className="h-4 w-4 text-white/50" />
                  <span className="text-sm text-white/70">
                    Your tokens refresh in{' '}
                    <span className="font-semibold text-purple-300">{daysUntilRenew} days</span>
                  </span>
                </div>
              )}

              {/* Recommended Tier Card */}
              {recommendedTierInfo && (
                <div className="mt-8">
                  <div className="mb-4 text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
                      <TrendingUp className="h-3 w-3" />
                      Recommended for You
                    </span>
                  </div>

                  <div
                    className={`overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br ${recommendedTierInfo.gradient} p-6`}
                  >
                    <div className="space-y-4">
                      {/* Tier name + price */}
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-2xl font-bold text-white">{recommendedTierInfo.name}</h3>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{recommendedTierInfo.price}</p>
                          <p className="text-xs text-white/60">{recommendedTierInfo.quota} tokens/month</p>
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="space-y-2.5">
                        {recommendedTierInfo.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-3 text-sm text-white/80">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                              ✓
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3">
                {tierMessage.showUpgrade ? (
                  <>
                    <Button
                      onClick={handleUpgrade}
                      className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 py-4 text-base font-semibold text-white shadow-[0_20px_60px_rgba(139,92,246,0.5)] transition-all hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(139,92,246,0.6)]"
                    >
                      Upgrade to {recommendedTierInfo?.name}
                    </Button>
                    <button
                      onClick={() => {
                        navigate('/pricing');
                        onClose();
                      }}
                      className="rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      View All Plans
                    </button>
                  </>
                ) : tierMessage.showContact ? (
                  <Button
                    onClick={() => window.open('mailto:support@wondertone.com?subject=Enterprise%20Solutions', '_blank')}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 py-4 text-base font-semibold text-white"
                  >
                    Contact Sales
                  </Button>
                ) : (
                  <Button
                    onClick={onClose}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 py-4 text-base font-semibold text-white"
                  >
                    Back to Studio
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default QuotaExhaustedModal;
