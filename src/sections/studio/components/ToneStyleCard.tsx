import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Star, Sparkles, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import type { ToneSectionStyle } from '@/store/hooks/useToneSections';
import { TONE_GRADIENTS } from '@/config/toneGradients';
import { useProductSurface } from '@/providers/ProductSurfaceProvider';
import { toneCardSpring } from '../motion/toneAccordionMotion';
import './ToneStyleCard.css';

type ToneStyleCardProps = {
  styleEntry: ToneSectionStyle;
  onSelect: () => void;
  showFavorite?: boolean; // Optional: enable when favorites UI is ready
  layout?: 'default' | 'hero';
  heroDescription?: string;
  prefersReducedMotion?: boolean;
  isLocked?: boolean;
  isLockedActive?: boolean;
};

export default function ToneStyleCard({
  styleEntry,
  onSelect,
  showFavorite = false,
  layout = 'default',
  heroDescription,
  prefersReducedMotion: prefersReducedMotionProp,
  isLocked: previewLocked = false,
  isLockedActive = false,
}: ToneStyleCardProps) {
  const { option, gate, isSelected, isFavorite, metadataTone, readiness } = styleEntry;
  const { rules } = useProductSurface();
  const resolvedThumbnail = option.thumbnail || `/art-style-thumbnails/${option.id}.jpg`;
  const [thumbnailMissing, setThumbnailMissing] = useState(!resolvedThumbnail);
  const isStyleLocked = !gate.allowed;
  const [isAnimating, setIsAnimating] = useState(false);
  const isHero = layout === 'hero';
  const reduceMotionFromContext = useReducedMotion();
  const prefersReducedMotion = prefersReducedMotionProp ?? reduceMotionFromContext;
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingParallaxRef = useRef<{ x: number; y: number } | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const hasAnimatedReadyRef = useRef(false);
  const [readyVisualState, setReadyVisualState] = useState<'idle' | 'enter' | 'visible'>('idle');

  // Get tone accent color for ink ripple effect
  const toneAccentColor = TONE_GRADIENTS[metadataTone]?.accent || '#8b5cf6';
  const toneKeyline = TONE_GRADIENTS[metadataTone]?.keyline || 'rgba(147, 197, 253, 0.45)';

  const toRgba = (color: string, alpha: number): string => {
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgba')) {
      const parts = color.match(/rgba\(([^)]+)\)/)?.[1].split(',').map((part) => part.trim());
      if (parts && parts.length >= 3) {
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (color.startsWith('rgb')) {
      const parts = color.match(/rgb\(([^)]+)\)/)?.[1].split(',').map((part) => part.trim());
      if (parts && parts.length === 3) {
        const [r, g, b] = parts;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    return color;
  };

  const glowColor = toRgba(toneAccentColor, 0.35);
  const glowSoftColor = toRgba(toneAccentColor, 0.18);
  const showReadyIndicator = readiness.hasPreview;
  const readinessLabel = readiness.isOrientationPending ? 'Preview refreshing' : 'Preview ready';
  const previewSource = readiness.source ?? 'none';
  const orientationMismatch = readiness.orientationMatches ? 'false' : 'true';

  const handleSelect = () => {
    if (previewLocked) {
      return;
    }
    if (!isStyleLocked) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
    onSelect();
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (readyTimeoutRef.current !== null) {
        window.clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showReadyIndicator) {
      setReadyVisualState('idle');
      hasAnimatedReadyRef.current = false;
      if (readyTimeoutRef.current !== null) {
        window.clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
      return;
    }

    if (prefersReducedMotion) {
      setReadyVisualState('visible');
      hasAnimatedReadyRef.current = true;
      return;
    }

    if (!hasAnimatedReadyRef.current) {
      setReadyVisualState('enter');
      hasAnimatedReadyRef.current = true;
      readyTimeoutRef.current = window.setTimeout(() => {
        setReadyVisualState('visible');
        readyTimeoutRef.current = null;
      }, 240);
    } else {
      setReadyVisualState('visible');
    }
  }, [showReadyIndicator, prefersReducedMotion]);

  const scheduleParallaxUpdate = (next: { x: number; y: number }) => {
    pendingParallaxRef.current = next;
    if (rafRef.current != null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingParallaxRef.current) {
        setParallax(pendingParallaxRef.current);
      }
    });
  };

  const handlePointerMove: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    if (prefersReducedMotion || isStyleLocked || previewLocked) return;
    if (!cardRef.current) return;
    if (!rectRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect();
    }
    const rect = rectRef.current;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const intensity = isHero ? 12 : 8;
    scheduleParallaxUpdate({
      x: x * intensity,
      y: y * (isHero ? 8 : 5),
    });
  };

  const resetParallax = () => {
    if (!prefersReducedMotion) {
      pendingParallaxRef.current = { x: 0, y: 0 };
      rectRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setParallax({ x: 0, y: 0 });
    }
  };

  // Badge rendering helper
  const renderBadge = (badge: string) => {
    const badgeConfig: Record<string, { icon: ReactNode; className: string }> = {
      new: {
        icon: <Sparkles className="w-3 h-3" />,
        className: 'bg-green-500/20 text-green-300',
      },
      trending: {
        icon: <TrendingUp className="w-3 h-3" />,
        className: 'bg-purple-500/20 text-purple-300',
      },
      popular: {
        icon: <Star className="w-3 h-3 fill-current" />,
        className: 'bg-yellow-500/20 text-yellow-300',
      },
      exclusive: {
        icon: <Lock className="w-3 h-3" />,
        className: 'bg-blue-500/20 text-blue-300',
      },
    };

    const config = badgeConfig[badge.toLowerCase()];
    if (!config) return null;

    return (
      <span
        key={badge}
        className={clsx(
          'relative overflow-hidden',
          'inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded',
          config.className,
          // Shimmer effect
          'before:absolute before:inset-0 before:translate-x-[-100%]',
          'before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
          'before:animate-badge-shimmer'
        )}
      >
        {config.icon}
        {badge}
      </span>
    );
  };

  const hoverMotion = !prefersReducedMotion && !isStyleLocked && !previewLocked
    ? {
        y: isHero ? -6 : -4,
        scale: isHero ? 1.007 : 1.012,
      }
    : undefined;

  const tapMotion = !prefersReducedMotion && !isStyleLocked && !previewLocked
    ? {
        scale: 0.97,
      }
    : undefined;

  const thumbnailStyle: CSSProperties =
    !prefersReducedMotion && !isStyleLocked && !previewLocked
      ? {
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        }
      : {};

  if (thumbnailMissing) {
    return null;
  }

  const hoverEnabled = !previewLocked && !isStyleLocked && !isSelected;
  const cardClassName = clsx(
    'tone-style-card group relative w-full rounded-xl overflow-hidden transition-colors duration-200',
    isHero
      ? 'flex flex-col gap-5 bg-white/10 border border-white/15 px-5 py-5 md:flex-row md:items-center'
      : 'flex items-center gap-4 rounded-lg px-4 py-3.5 md:py-4',
    'focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:ring-offset-2 focus:ring-offset-slate-900',
    isSelected && !isStyleLocked
      ? 'bg-gradient-border-selected border-2 border-transparent shadow-lg shadow-purple-500/20'
      : isStyleLocked
      ? 'bg-slate-800/40 border border-white/5 hover:border-purple-400/50 hover:shadow-md hover:shadow-purple-500/10 cursor-pointer'
      : isHero
      ? 'border border-white/20 hover:border-white/30 hover:bg-white/10'
      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]',
    hoverEnabled && 'hover-enabled',
    isStyleLocked && 'locked',
    isSelected && 'selected',
    previewLocked && 'tone-style-card--interaction-locked',
    isLockedActive && 'tone-style-card--active-lock'
  );

  const cardStyle = {
    '--tone-glow': glowColor,
    '--tone-glow-soft': glowSoftColor,
  } as CSSProperties;

  const thumbnailClassName = clsx(
    'tone-style-card__thumbnail relative overflow-hidden flex-shrink-0 shadow-lg',
    isHero ? 'h-28 w-full rounded-2xl md:h-28 md:w-28' : 'h-16 w-16 rounded-2xl md:h-[72px] md:w-[72px]',
    showReadyIndicator && 'tone-style-card__thumbnail--ready',
    readyVisualState === 'enter' && 'tone-style-card__thumbnail--enter',
    readyVisualState === 'visible' && 'tone-style-card__thumbnail--visible'
  );

  return (
    <motion.button
      ref={cardRef}
      onClick={handleSelect}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
      onPointerDown={resetParallax}
      onPointerUp={resetParallax}
      aria-disabled={isStyleLocked || previewLocked ? 'true' : 'false'}
      aria-label={
        isStyleLocked
          ? `${option.name} - Locked - Requires ${gate.requiredTier?.toUpperCase()} tier`
          : option.name
      }
      data-preview-ready={showReadyIndicator ? 'true' : 'false'}
      data-preview-source={previewSource}
      data-orientation-mismatch={orientationMismatch}
      className={cardClassName}
      style={cardStyle}
      whileHover={hoverMotion}
      whileTap={tapMotion}
      transition={toneCardSpring}
      data-preview-locked={previewLocked ? 'true' : 'false'}
    >
      {/* Ink blot ripple effect on selection */}
      {isAnimating && !isStyleLocked && !previewLocked && (
        <div
          className="absolute inset-0 pointer-events-none z-20 animate-ink-ripple"
          style={{
            background: `radial-gradient(circle, ${toneAccentColor}40 0%, transparent 70%)`,
          }}
        />
      )}
      {/* Thumbnail */}
      <div className={thumbnailClassName} style={{ ...thumbnailStyle, aspectRatio: isHero ? 'auto' : '1' }}>
        <picture>
          {option.thumbnailAvif && (
            <source srcSet={option.thumbnailAvif} type="image/avif" />
          )}
          {option.thumbnailWebp && (
            <source srcSet={option.thumbnailWebp} type="image/webp" />
          )}
          <img
            src={resolvedThumbnail}
            alt=""
            width={isHero ? 112 : 64}
            height={isHero ? 112 : 64}
            loading="lazy"
            decoding="async"
            onError={() => setThumbnailMissing(true)}
            className={clsx(
              'h-full w-full object-cover transition-transform duration-200',
              isStyleLocked && 'opacity-60',
              !isStyleLocked && !previewLocked && 'group-hover:scale-105'
            )}
            style={{ aspectRatio: '1' }}
          />
        </picture>

        {previewLocked && isLockedActive && (
          <div
            className="tone-style-card__lock-overlay"
            role="status"
            aria-live="polite"
            aria-label="Generating preview"
          >
            <span className="tone-style-card__lock-spinner" aria-hidden="true" />
            <span className="tone-style-card__lock-text">Generating preview…</span>
          </div>
        )}

        {previewLocked && !isLockedActive && <div className="tone-style-card__lock-mask" aria-hidden="true" />}

        {showReadyIndicator && (
          <>
            <div
              className={clsx(
                'tone-style-card__thumbnail-ready-frame',
                readyVisualState === 'enter' && 'is-enter',
                readyVisualState === 'visible' && 'is-visible'
              )}
              aria-hidden="true"
            />
            <div
              className={clsx(
                'tone-style-card__ready-overlay',
                readyVisualState === 'enter' && 'is-enter',
                readyVisualState === 'visible' && 'is-visible',
                readiness.isOrientationPending && 'is-pending'
              )}
              aria-label={readinessLabel}
              data-state={readiness.isOrientationPending ? 'pending' : 'ready'}
            >
              <div className="tone-style-card__ready-badge">
                <span className="tone-style-card__ready-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" focusable="false" className="tone-style-card__ready-icon-svg">
                    <path
                      d="M7.833 13.417 4.667 10.25l1.178-1.178 1.988 1.988 6.523-6.523 1.178 1.177-7.701 7.703Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span className="tone-style-card__ready-text">
                  {readiness.isOrientationPending ? 'Refreshing' : 'Ready'}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Gold overlay removed for locked styles */}

        {/* Selected Checkmark */}
        {isSelected && !isStyleLocked && !previewLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-purple-500/40 backdrop-blur-[1px] animate-in fade-in-0 zoom-in-50 duration-200">
            <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Style Info */}
      <div
        className={clsx(
          'flex-1 min-w-0 text-left',
          isHero ? 'flex flex-col gap-2' : 'flex flex-col gap-1.5'
        )}
      >
        <div
          className={clsx(
            'flex flex-wrap items-center gap-2',
            isHero ? 'mb-1.5' : 'mb-1'
          )}
        >
          <div
            className={clsx(
              'flex w-full flex-col gap-2',
              isHero ? 'md:flex-row md:items-center md:justify-between md:gap-4' : 'sm:flex-row sm:items-center sm:gap-2'
            )}
          >
            <p
              className={clsx(
                'font-display drop-shadow-[0_1px_6px_rgba(10,15,35,0.45)]',
                isHero
                  ? 'text-xl font-bold uppercase tracking-[0.14em] md:text-xl'
                  : 'text-xl font-bold tracking-[0.01em] text-left',
                isStyleLocked ? 'text-white/55' : 'text-white'
              )}
              style={
                isHero
                  ? {
                      borderBottom: `1px solid ${toneKeyline}`,
                      paddingBottom: '0.25rem',
                      letterSpacing: '0.08em',
                    }
                  : undefined
              }
            >
              {option.name}
            </p>
            {gate.requiredTier && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.25em] text-white/80">
                {gate.requiredTier.toUpperCase()}
              </span>
            )}
          </div>
          {/* Badges */}
          {option.badges && option.badges.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {option.badges.map((badge) => renderBadge(badge))}
            </div>
          )}
        </div>
        <p
          className={clsx(
            isHero
              ? 'text-sm text-left font-medium md:text-base md:leading-snug'
              : 'mt-0.5 text-[13px] font-medium text-left leading-snug line-clamp-2',
            isStyleLocked ? 'text-white' : 'text-white/80'
          )}
          style={{
          fontFamily: '"poppins", "Inter", sans-serif',
          textShadow: '0 1px 4px rgba(8, 13, 30, 0.45)',
          }}
        >
          {isHero ? heroDescription : option.description}
        </p>
        {/* Lock Message */}
        {isStyleLocked && gate.requiredTier && !rules.hideSubscriptionTiers && (
          <span
            className={clsx(
              'inline-flex items-center gap-2 text-[10px] font-semibold text-purple-200/90',
              isHero ? 'mt-2' : 'mt-1.5'
            )}
          >
            <Lock className="w-3 h-3" />
            Unlock with {gate.requiredTier.toUpperCase()} plan
          </span>
        )}
      </div>

      {/* Optional: Favorite Icon (for Phase 4) */}
      {showFavorite && isFavorite && (
        <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0 animate-in zoom-in-50 duration-200" />
      )}
    </motion.button>
  );
}
