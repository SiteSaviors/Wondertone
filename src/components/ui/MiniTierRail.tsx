import type { SubscriptionTier, TierId } from '@/data/subscriptionTiers';
import TokenDrawerTierCard from '@/components/navigation/token-drawer/TokenDrawerTierCard';

type MiniTierRailProps = {
  tiers: SubscriptionTier[];
  currentTier: TierId | null;
  loadingTier: TierId | null;
  onSelectTier: (tierId: TierId) => void;
};

const MiniTierRail = ({ tiers, currentTier, loadingTier, onSelectTier }: MiniTierRailProps) => (
  <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-2">
    {tiers.map((tier) => (
      <TokenDrawerTierCard
        key={tier.id}
        tier={tier}
        isCurrent={tier.id === currentTier}
        isLoading={loadingTier === tier.id}
        onSelect={onSelectTier}
      />
    ))}
  </div>
);

export default MiniTierRail;
