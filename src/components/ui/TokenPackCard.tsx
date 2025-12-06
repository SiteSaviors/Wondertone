import { clsx } from 'clsx';
import Button from './Button';

type TokenPackCardProps = {
  id: string;
  name: string;
  tokens: number;
  price: string;
  badge?: string;
  bullets: string[];
  gradient: string;
  ctaLabel: string;
  isLoading?: boolean;
  onSelect: () => void;
  size?: 'default' | 'compact';
};

const TokenPackCard = ({
  name,
  tokens,
  price,
  badge,
  bullets,
  gradient,
  ctaLabel,
  isLoading = false,
  onSelect,
  size = 'default',
}: TokenPackCardProps) => (
  <div
    className={clsx(
      'group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br p-[1px] transition duration-500 hover:shadow-[0_25px_80px_rgba(15,23,42,0.45)]',
      size === 'compact' && 'rounded-[24px]'
    )}
  >
    <div
      className={clsx(
        'rounded-[26px] bg-slate-900/90 p-8 flex h-full flex-col',
        `bg-gradient-to-br ${gradient}`,
        size === 'compact' ? 'min-h-[360px] p-6 text-sm' : 'min-h-[480px] sm:min-h-[520px]'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">Token Pack</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{name}</h3>
        </div>
        <div className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          {tokens} tokens
        </div>
      </div>

      <div className="mt-6 flex items-baseline gap-3">
        <span className={clsx('font-bold text-white', size === 'compact' ? 'text-4xl' : 'text-5xl')}>{price}</span>
        {badge && (
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
            {badge}
          </span>
        )}
      </div>

      <ul className={clsx('mt-6 flex-1 space-y-3 text-white/80', size === 'compact' && 'space-y-2 text-[13px]')}>
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/30 text-[11px] font-bold text-white/90">
              ✓
            </span>
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      <Button
        className={clsx(
          'mt-8 w-full rounded-full bg-white text-sm font-semibold text-slate-900 shadow-[0_20px_60px_rgba(255,255,255,0.25)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(255,255,255,0.35)] disabled:translate-y-0 disabled:opacity-70',
          size === 'compact' ? 'py-3 text-xs' : 'py-4'
        )}
        disabled={isLoading}
        onClick={onSelect}
      >
        {isLoading ? 'Preparing checkout…' : ctaLabel}
      </Button>
    </div>
  </div>
);

export default TokenPackCard;
