import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import MiniPricingToggle from '@/components/ui/MiniPricingToggle';
import TokenPackRail from '@/components/ui/TokenPackRail';
import MiniTierRail from '@/components/ui/MiniTierRail';
import { TOKEN_PACKS } from '@/data/tokenPacks';
import { PREMIUM_TIERS, type TierId } from '@/data/subscriptionTiers';
import type { PricingMode } from '@/components/ui/PricingModeToggle';
import useTokenPackCheckout from '@/hooks/useTokenPackCheckout';

type TokenBalanceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierLabel: string;
  remainingTokens: number | null;
  renewAt: string | null;
  onManageMembership: () => void;
  isLoading: boolean;
  sessionUser: unknown;
  accessToken: string | null;
  onRequireAuth: () => void;
  currentTierId: TierId | null;
};

const formatRenewalDate = (renewAt: string | null) => {
  if (!renewAt) return 'Auto-renews monthly';
  const date = new Date(renewAt);
  if (Number.isNaN(date.getTime())) return 'Auto-renews monthly';
  return `Renews ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

const TokenBalanceDrawerComponent = ({
  open,
  onOpenChange,
  tierLabel,
  remainingTokens,
  renewAt,
  onManageMembership,
  isLoading,
  sessionUser,
  accessToken,
  onRequireAuth,
  currentTierId,
}: TokenBalanceDrawerProps) => {
  const tokenDisplay = isLoading ? '—' : remainingTokens == null ? '∞' : Math.max(0, remainingTokens).toString();
  const [drawerMode, setDrawerMode] = useState<PricingMode>('payg');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buildCheckoutUrl = useCallback((type: 'token_pack', status: 'success' | 'cancelled') => {
    if (typeof window === 'undefined') return '/pricing';
    const params = new URLSearchParams({ checkout: status, type });
    return `${window.location.origin}/pricing?${params.toString()}`;
  }, []);
  const { startCheckout, loadingPackId, resumePendingCheckout } = useTokenPackCheckout({
    sessionUser,
    accessToken,
    promptAuth: onRequireAuth,
    buildCheckoutUrl,
  });

  useEffect(() => {
    if (!open) return;
    void resumePendingCheckout();
  }, [open, resumePendingCheckout]);

  const handlePackSelect = async (packId: string) => {
    setErrorMessage(null);
    try {
      await startCheckout(packId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start checkout. Please try again.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content
          className={clsx(
            'fixed inset-y-0 right-0 z-50 w-full max-w-md',
            'border-l border-white/10 bg-gradient-to-b from-[#5B35F0]/95 via-[#4431C4]/95 to-[#1A1F33]/95',
            'shadow-[0_25px_80px_rgba(28,4,84,0.65)]'
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                Token Balance
              </Dialog.Title>
              <p className={clsx('text-2xl font-semibold text-white', isLoading && 'animate-pulse text-white/40')}>{tokenDisplay} {isLoading ? '' : 'tokens'}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
              aria-label="Close token drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 overflow-y-auto px-6 py-6 text-white">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Tier</span>
                <span className={clsx('rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/90', isLoading && 'animate-pulse text-transparent')}>{isLoading ? '•••' : tierLabel}</span>
              </div>
              <div className={clsx('mt-4 text-sm text-white/60', isLoading && 'animate-pulse text-transparent')}>{isLoading ? '•••' : formatRenewalDate(renewAt)}</div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4">
              <MiniPricingToggle mode={drawerMode} onChange={setDrawerMode} />
  {errorMessage && (
    <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
      {errorMessage}
    </div>
  )}
              {drawerMode === 'payg' ? (
                <TokenPackRail packs={TOKEN_PACKS} loadingPackId={loadingPackId} onSelectPack={handlePackSelect} />
              ) : (
                <MiniTierRail
                  tiers={PREMIUM_TIERS}
                  currentTier={currentTierId}
                  loadingTier={null}
                  onSelectTier={(_tierId) => {
                    onOpenChange(false);
                    onManageMembership();
                  }}
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10"
                onClick={() => {
                  onOpenChange(false);
                  onManageMembership();
                }}
              >
                Manage membership
              </button>
              <Link
                to="/pricing?mode=payg"
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                View full pricing →
              </Link>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
              <p className="font-semibold text-white">Need the full breakdown?</p>
              <p className="mt-1 text-white/70">View your complete token history, analytics, and CSV exports.</p>
              <Link
                to="/studio/usage"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-purple-200"
                onClick={() => onOpenChange(false)}
              >
                Go to usage →
              </Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const TokenBalanceDrawer = memo(TokenBalanceDrawerComponent);

export default TokenBalanceDrawer;
