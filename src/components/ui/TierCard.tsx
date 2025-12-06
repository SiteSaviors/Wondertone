import { clsx } from 'clsx';
import Button from './Button';

type TierId = 'free' | 'creator' | 'plus' | 'pro';

type TierCardProps = {
  id: TierId;
  name: string;
  price: string;
  priceDetail: string;
  tokensPerMonth: number;
  tokensLabel?: string;
  features: string[];
  gradient: string;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: () => void;
  animationDelay?: number;
  size?: 'default' | 'compact';
};

// Tier-specific glow effects
const tierGlowClasses: Record<TierId, string> = {
  free: '',
  creator: 'hover:shadow-[0_25px_80px_rgba(108,61,242,0.35)]',
  plus: 'hover:shadow-[0_25px_80px_rgba(49,168,255,0.35)]',
  pro: 'hover:shadow-[0_25px_80px_rgba(255,166,46,0.35)]',
};

// Tier-specific accent colors for current badge
const tierAccentClasses: Record<TierId, string> = {
  free: 'from-slate-500/80 to-slate-600/80 border-slate-400/40',
  creator: 'from-purple-500/80 to-indigo-500/80 border-purple-400/40',
  plus: 'from-cyan-500/80 to-blue-500/80 border-cyan-400/40',
  pro: 'from-orange-500/80 to-pink-500/80 border-orange-400/40',
};

const TierCard = ({
  id,
  name,
  price,
  priceDetail,
  tokensPerMonth,
  tokensLabel = 'tokens',
  features,
  gradient,
  isCurrent,
  isLoading,
  onSelect,
  animationDelay = 0,
  size = 'default',
}: TierCardProps) => {
  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-[32px] transition-all duration-500 hover:scale-[1.02]',
        tierGlowClasses[id]
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Outer glow ring - tier specific */}
      {id !== 'free' && (
        <div
          className={clsx(
            'pointer-events-none absolute inset-0 rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100',
            id === 'creator' && 'bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-transparent blur-xl',
            id === 'plus' && 'bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-transparent blur-xl',
            id === 'pro' && 'bg-gradient-to-br from-orange-500/20 via-pink-500/20 to-transparent blur-xl'
          )}
        />
      )}

      {/* Main card container */}
      <div
        className={clsx(
          'relative h-full rounded-[32px] border border-white/10 bg-gradient-to-br p-[1px] transition-all duration-300',
          size === 'compact' && 'rounded-[24px]'
        )}
      >
        <div className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-[100%]" />

        <div
          className={clsx(
            'relative flex h-full flex-col rounded-[28px] border border-white/10 p-8 shadow-[inset_0_0_40px_rgba(15,23,42,0.45)]',
            id === 'free' ? 'bg-[#1d2035]/90' : `bg-gradient-to-br ${gradient}`,
            size === 'compact' && 'rounded-[22px] p-6 text-sm'
          )}
        >
          {isCurrent && (
            <div
              className={clsx(
                'absolute right-6 top-6 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg',
                'bg-gradient-to-r',
                tierAccentClasses[id]
              )}
            >
              Current plan
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Membership</p>
                <h3
                  className={clsx(
                    'mt-1 font-semibold leading-tight text-white',
                    size === 'compact' ? 'text-xl' : 'text-2xl md:text-3xl'
                  )}
                >
                  {name}
                </h3>
              </div>
              <div
                className={clsx(
                  'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-lg',
                  'bg-gradient-to-r',
                  id === 'creator' && 'from-purple-400/90 to-indigo-400/70 border-purple-300/50',
                  id === 'plus' && 'from-cyan-400/90 to-blue-400/70 border-cyan-300/50',
                  id === 'pro' && 'from-orange-400/90 to-pink-400/70 border-orange-300/50',
                  id === 'free' && 'from-slate-500/80 to-slate-600/70 border-slate-400/40'
                )}
              >
                {tokensPerMonth} {tokensLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className={clsx('font-bold tracking-tight text-white', size === 'compact' ? 'text-4xl' : 'text-5xl')}>
                {price}
              </span>
              <span className="text-sm text-white/60">{priceDetail}</span>
            </div>
          </div>

          <ul className={clsx('mt-6 flex-1 space-y-3 text-sm text-white/80', size === 'compact' && 'space-y-2 text-[13px]')}>
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  className={clsx(
                    'mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-white shadow-sm',
                    id === 'free'
                      ? 'border-white/20 bg-white/10'
                      : 'border-white/30 bg-gradient-to-br',
                    id === 'creator' && 'from-purple-400/30 to-indigo-400/30',
                    id === 'plus' && 'from-cyan-400/30 to-blue-400/30',
                    id === 'pro' && 'from-orange-400/30 to-pink-400/30'
                  )}
                >
                  ✓
                </span>
                <span className="leading-relaxed text-white/75">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            className={clsx(
              'relative mt-8 flex w-full items-center justify-center overflow-hidden rounded-full text-sm font-semibold shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-300',
              'bg-white text-slate-900 hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(15,23,42,0.45)]',
              'disabled:translate-y-0 disabled:opacity-70',
              size === 'compact' ? 'py-3 text-xs' : 'py-4'
            )}
            disabled={isCurrent || isLoading}
            onClick={onSelect}
          >
            {isLoading && (
              <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
            )}
            <span className="relative z-10">
              {isCurrent
                ? 'Current plan'
                : isLoading
                  ? 'Preparing checkout…'
                  : id === 'free'
                    ? 'Start creating'
                    : 'Upgrade with Wondertone'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TierCard;
