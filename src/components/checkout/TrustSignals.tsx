import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { memo, useRef } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Trust signal context types
 * Each context is strategically placed near friction points in the checkout flow
 */
type TrustSignalContext = 'canvas_quality' | 'artisan_craft' | 'cta_strip' | 'sticky_guarantee';

interface TrustSignalProps {
  context: TrustSignalContext;
  className?: string;
  style?: CSSProperties;
}

interface BaseSignalProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Canvas Quality Trust Signal
 * 100-day satisfaction guarantee with scroll-reveal icon
 */
const CanvasQualitySignal: React.FC<BaseSignalProps> = memo(({ className, style }) => {
  const iconRef = useRef<HTMLSpanElement>(null);
  const isRevealed = useScrollReveal(iconRef, 0.2);

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm',
        className
      )}
      style={style}
    >
      <span
        ref={iconRef}
        className={clsx('text-lg', isRevealed && 'motion-safe:animate-scale-in')}
        role="img"
        aria-label="Shield"
        data-trust-icon
      >
        🛡️
      </span>
      <p className="text-[13px] leading-snug text-emerald-100">
        <strong className="font-semibold">100-day satisfaction guarantee</strong> — Love it or
        we'll remake it, free of charge
      </p>
    </div>
  );
});

/**
 * Artisan Craft Trust Signal
 * Craftsmanship details with scroll-reveal icon
 */
const ArtisanCraftSignal: React.FC<BaseSignalProps> = memo(({ className, style }) => {
  const iconRef = useRef<HTMLSpanElement>(null);
  const isRevealed = useScrollReveal(iconRef, 0.2);

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/70',
        className
      )}
      style={style}
    >
      <span
        ref={iconRef}
        className={clsx('text-base', isRevealed && 'motion-safe:animate-scale-in')}
        role="img"
        aria-label="Artist palette"
        data-trust-icon
      >
        🎨
      </span>
      <p className="leading-relaxed">
        Hand-stretched by artisans · Museum-grade canvas · UV-resistant inks
      </p>
    </div>
  );
});

/**
 * CTA Strip Trust Signal
 * Compact inline trust indicators
 */
const CtaStripSignal: React.FC<BaseSignalProps> = memo(({ className, style }) => {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/50',
        className
      )}
      style={style}
    >
      <span className="flex items-center gap-1">
        <span role="img" aria-label="Lock">
          🔒
        </span>{' '}
        Secure payment
      </span>
      <span className="text-white/30" aria-hidden="true">
        ·
      </span>
      <span className="flex items-center gap-1">
        <span role="img" aria-label="Truck">
          🚚
        </span>{' '}
        Insured shipping
      </span>
    </div>
  );
});

/**
 * Sticky Guarantee Trust Signal
 * Desktop-only sticky badge with money-back promise
 */
const StickyGuaranteeSignal: React.FC<BaseSignalProps> = memo(() => null);

/**
 * Trust Signal Components
 * Strategic placement of trust indicators to reduce purchase anxiety
 *
 * Contexts:
 * - canvas_quality: 100-day guarantee near size selection
 * - artisan_craft: Craftsmanship details near frame section
 * - cta_strip: Compact trust indicators above CTA
 * - sticky_guarantee: Desktop-only sticky badge with money-back promise
 */
export const TrustSignal: React.FC<TrustSignalProps> = ({ context, className, style }) => {
  switch (context) {
    case 'canvas_quality':
      return <CanvasQualitySignal className={className} style={style} />;
    case 'artisan_craft':
      return <ArtisanCraftSignal className={className} style={style} />;
    case 'cta_strip':
      return <CtaStripSignal className={className} style={style} />;
    case 'sticky_guarantee':
      return <StickyGuaranteeSignal className={className} style={style} />;
    default:
      return null;
  }
};

export default TrustSignal;
