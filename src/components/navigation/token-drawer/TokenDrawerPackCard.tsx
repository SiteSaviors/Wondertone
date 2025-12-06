import { memo } from 'react';
import Button from '@/components/ui/Button';
import type { TokenPack } from '@/data/tokenPacks';
import { clsx } from 'clsx';

type TokenDrawerPackCardProps = {
  pack: TokenPack;
  isLoading: boolean;
  onSelect: () => void;
};

const TokenDrawerPackCardComponent = ({ pack, isLoading, onSelect }: TokenDrawerPackCardProps) => (
  <div
    className={clsx(
      'rounded-[22px] border border-white/15 bg-gradient-to-br p-5 text-white shadow-[0_25px_60px_rgba(6,10,30,0.45)]',
      pack.gradient
    )}
  >
    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-white/70">
      <span>Token Pack</span>
      <span className="rounded-full border border-white/30 bg-white/10 px-3 py-0.5 text-white/80">
        {pack.tokens} tokens
      </span>
    </div>
    <div className="mt-3 flex items-baseline gap-2">
      <p className="text-3xl font-semibold text-white">{pack.price}</p>
      {pack.badge && (
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {pack.badge}
        </span>
      )}
    </div>
    <ul className="mt-3 space-y-1.5 text-[13px] text-white/80">
      {pack.bullets.slice(0, 2).map((bullet) => (
        <li key={bullet} className="flex items-start gap-2">
          <span className="mt-1 inline-flex h-3 w-3 flex-shrink-0 rounded-full bg-white/70" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
    <Button
      className="mt-4 w-full rounded-full bg-white py-2.5 text-xs font-semibold text-slate-900 shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
      disabled={isLoading}
      onClick={onSelect}
    >
      {isLoading ? 'Preparing checkout…' : pack.ctaLabel}
    </Button>
  </div>
);

const TokenDrawerPackCard = memo(TokenDrawerPackCardComponent);

export default TokenDrawerPackCard;
