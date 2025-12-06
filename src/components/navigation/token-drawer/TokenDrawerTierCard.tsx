import { memo } from 'react';
import Button from '@/components/ui/Button';
import type { SubscriptionTier, TierId } from '@/data/subscriptionTiers';
import { clsx } from 'clsx';

type TokenDrawerTierCardProps = {
  tier: SubscriptionTier;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: (tierId: TierId) => void;
};

const TokenDrawerTierCardComponent = ({ tier, isCurrent, isLoading, onSelect }: TokenDrawerTierCardProps) => (
  <div className={clsx('rounded-[22px] border border-white/15 bg-gradient-to-br p-5 text-white shadow-[0_25px_60px_rgba(6,10,30,0.45)]', tier.gradient)}>
    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-white/70">
      <span>Membership</span>
      <span className="rounded-full border border-white/30 bg-white/10 px-3 py-0.5 text-white/80">
        {tier.tokensPerMonth} tokens
      </span>
    </div>
    <div className="mt-3 flex items-baseline gap-2">
      <p className="text-2xl font-semibold text-white">{tier.name}</p>
      <span className="text-sm text-white/70">{tier.price}</span>
    </div>
    <ul className="mt-3 space-y-1.5 text-[13px] text-white/80">
      {tier.features.slice(0, 2).map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <span className="mt-1 inline-flex h-3 w-3 flex-shrink-0 rounded-full bg-white/70" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <Button
      className={clsx(
        'mt-4 w-full rounded-full py-2.5 text-xs font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition',
        'bg-white text-slate-900 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70'
      )}
      disabled={isCurrent || isLoading}
      onClick={() => onSelect(tier.id)}
    >
      {isCurrent ? 'Current plan' : 'Manage plan'}
    </Button>
  </div>
);

const TokenDrawerTierCard = memo(TokenDrawerTierCardComponent);

export default TokenDrawerTierCard;
