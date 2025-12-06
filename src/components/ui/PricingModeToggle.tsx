import { clsx } from 'clsx';

export type PricingMode = 'subscription' | 'payg';

type PricingModeToggleProps = {
  mode: PricingMode;
  onChange: (mode: PricingMode) => void;
  className?: string;
  buttonClassName?: string;
};

const LABELS: Record<PricingMode, string> = {
  subscription: 'Subscribe & Save',
  payg: 'Pay As You Go',
};

const PricingModeToggle = ({ mode, onChange, className, buttonClassName }: PricingModeToggleProps) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handleClick = (nextMode: PricingMode) => {
    if (nextMode === mode) return;
    onChange(nextMode);
  };

  const indicatorTranslate = mode === 'subscription' ? 'translate-x-0' : 'translate-x-full';
  const indicatorClasses = clsx(
    'pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-300 shadow-[0_10px_25px_rgba(192,132,252,0.35)]',
    prefersReducedMotion ? '' : 'transition-transform duration-300 ease-out',
    indicatorTranslate
  );

  return (
    <div className={clsx('inline-flex w-full max-w-md items-center justify-center', className)}>
      <div
        role="group"
        aria-label="Pricing mode"
        className="relative inline-flex w-full overflow-hidden rounded-full border border-white/15 bg-white/5 p-1 text-sm font-semibold text-white/70 shadow-[0_15px_45px_rgba(15,23,42,0.35)] backdrop-blur"
      >
        <div className={indicatorClasses} aria-hidden="true" />
        {(['subscription', 'payg'] as PricingMode[]).map((option) => (
          <button
            key={option}
            type="button"
            className={clsx(
              'relative z-10 flex-1 px-4 py-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              mode === option ? 'text-slate-950' : 'text-white/70',
              buttonClassName
            )}
            aria-pressed={mode === option}
            onClick={() => handleClick(option)}
          >
            {LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PricingModeToggle;
