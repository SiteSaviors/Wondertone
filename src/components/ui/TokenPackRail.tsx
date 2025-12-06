import type { TokenPack } from '@/data/tokenPacks';
import TokenDrawerPackCard from '@/components/navigation/token-drawer/TokenDrawerPackCard';
import { clsx } from 'clsx';

type TokenPackRailProps = {
  packs: TokenPack[];
  loadingPackId: string | null;
  onSelectPack: (packId: string) => void;
};

const TokenPackRail = ({ packs, loadingPackId, onSelectPack }: TokenPackRailProps) => (
  <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-2">
    {packs.map((pack) => (
      <TokenDrawerPackCard
        key={pack.id}
        pack={pack}
        isLoading={loadingPackId === pack.id}
        onSelect={() => onSelectPack(pack.id)}
      />
    ))}
  </div>
);

export default TokenPackRail;
