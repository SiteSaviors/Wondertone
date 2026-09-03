import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, type MotionStyle } from 'framer-motion';
import { ChevronDown, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import type { ToneSection as ToneSectionType } from '@/store/hooks/useToneSections';
import type { ToneGradientConfig } from '@/config/toneGradients';
import ToneStyleCard from './ToneStyleCard';
import { getToneIcon } from './toneIcons';
import {
  toneCardVariants,
  tonePanelVariants,
  toneSectionVariants,
  reducedMotionSettings,
  toneCardStagger,
} from '../motion/toneAccordionMotion';
import type { PrefetchGroupStatus } from '@/sections/studio/hooks/useStyleThumbnailPrefetch';
import { useStyleCatalogActions } from '@/store/hooks/useStyleCatalogStore';
import { usePreviewLockState } from '@/store/hooks/usePreviewStore';
import './ToneSection.css';

type ToneSectionProps = {
  section: ToneSectionType;
  toneMeta: ToneGradientConfig;
  prefersReducedMotion: boolean;
  onStyleSelect: (styleId: string, meta: { tone: string }) => void;
  isExpanded: boolean;
  onToggle: () => void;
  prefetchStatus: PrefetchGroupStatus;
};

export default function ToneSection({
  section,
  toneMeta,
  prefersReducedMotion,
  onStyleSelect,
  isExpanded,
  onToggle,
  prefetchStatus,
}: ToneSectionProps) {
  const { tone, definition, styles, locked } = section;
  const Icon = getToneIcon(tone);
  const [iconAnimated, setIconAnimated] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | 'auto'>('auto');
  const panelRef = useRef<HTMLDivElement>(null);
  const { ensureStylesLoaded } = useStyleCatalogActions();
  const { isLocked: previewLocked, lockedStyleId } = usePreviewLockState();

  useEffect(() => {
    if (isExpanded && !iconAnimated) {
      setIconAnimated(true);
    }
  }, [iconAnimated, isExpanded]);

  // Lazy load style details when accordion expands
  useEffect(() => {
    if (isExpanded && styles.length > 0) {
      const styleIds = styles.map((s) => s.option.id);
      void ensureStylesLoaded(styleIds);
    }
  }, [ensureStylesLoaded, isExpanded, styles]);

  // FLIP height measurement for smooth GPU-accelerated animation
  useEffect(() => {
    if (!panelRef.current) return;

    if (isExpanded) {
      const canAnimate =
        prefetchStatus === 'done' || prefetchStatus === 'error' || styles.length === 0;
      if (!canAnimate) {
        return;
      }
      // Measure scrollHeight before animation
      const height = panelRef.current.scrollHeight;
      setPanelHeight(height);
      setIsAnimating(true);

      // Return to auto after animation completes (prevents overflow issues)
      const timer = setTimeout(() => {
        setPanelHeight('auto');
        setIsAnimating(false);
      }, 260);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isExpanded, prefetchStatus, styles.length]);

  const panelBackground = isExpanded ? toneMeta.panel.expanded : toneMeta.panel.collapsed;
  const sectionClassName = clsx(
    'tone-section-shell rounded-2xl border border-white/10 backdrop-blur-sm transition-colors duration-300',
    isExpanded && 'expanded',
    isAnimating && 'animating'
  );
  const sectionStyle: MotionStyle & Record<'--tone-highlight', string> = {
    background: panelBackground,
    willChange: isExpanded ? 'height, opacity' : undefined,
    pointerEvents: isAnimating ? 'none' : 'auto',
    '--tone-highlight': toneMeta.highlight,
  };

  return (
    <motion.section
      initial={false}
      variants={toneSectionVariants}
      animate={isExpanded ? 'expanded' : 'collapsed'}
      className={sectionClassName}
      style={sectionStyle}
    >
      <button
        onClick={onToggle}
        className={clsx(
          'relative w-full px-6 py-4 text-left transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          'focus-visible:ring-white/70',
          !isExpanded && 'hover:bg-white/5'
        )}
        aria-expanded={isExpanded}
        aria-controls={`tone-section-${tone}`}
      >
        <div className="flex items-start gap-4">
          <span
            className={clsx(
              'mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-inner text-white',
              !prefersReducedMotion && !iconAnimated && isExpanded ? 'animate-tone-icon-reveal' : ''
            )}
            style={{
              borderColor: toneMeta.keyline,
              boxShadow: `0 0 24px ${toneMeta.highlight}`,
            }}
            aria-hidden="true"
          >
            <Icon stroke={toneMeta.iconStroke} strokeWidth={1.5} className="h-6 w-6" />
          </span>
          <div className="flex flex-1 flex-col text-left">
            <div className="flex items-center gap-3">
              <h3
                className={clsx(
                  'font-display text-[1.1rem] md:text-[1.2rem] lg:text-[1.35rem] leading-snug font-bold capitalized tracking-[0.02em] text-white drop-shadow-[0_1px_6px_rgba(8,12,28,0.45)]'
                )}
              >
                {definition.label}
              </h3>
              {locked && tone === 'signature' && (
                <Lock className="h-4 w-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" aria-hidden="true" />
              )}
            </div>
            <p className="mt-1 font-poppins text-[0.9rem] text-white/75 tracking-[0.001em] leading-snug md:leading-[1.5] md:text-[0.3 rem] md:leading-[1.0] drop-shadow-[0_1px_4px_rgba(8,12,28,0.4)]">
             {definition.description}
           </p>
          </div>
          <div className="flex flex-col items-center gap-1 self-start pt-1">
            <motion.span
              animate={isExpanded ? { rotate: 180 } : { rotate: 0 }}
              transition={prefersReducedMotion ? reducedMotionSettings : { type: 'spring', stiffness: 360, damping: 28 }}
              className="text-white/60"
              style={{
                transform: 'translateZ(0)',
                willChange: 'transform',
              }}
              aria-hidden="true"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            ref={panelRef}
            key="panel"
            id={`tone-section-${tone}`}
            role="region"
            aria-label={`${definition.label} styles`}
            variants={tonePanelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={prefersReducedMotion ? reducedMotionSettings : undefined}
            className="px-4 pb-5 pt-2"
            style={{
              '--panel-height': typeof panelHeight === 'number' ? `${panelHeight}px` : 'auto',
              contain: 'layout style',
              willChange: isExpanded ? 'height, opacity' : undefined,
            } as React.CSSProperties}
          >
            <motion.div
              className="space-y-2"
              style={{
                contain: 'layout paint',
              }}
              initial={prefersReducedMotion ? undefined : 'initial'}
              animate={prefersReducedMotion ? undefined : 'enter'}
              exit={prefersReducedMotion ? undefined : 'initial'}
              transition={prefersReducedMotion ? undefined : toneCardStagger}
            >
              {styles.map((styleEntry) => (
                <motion.div key={styleEntry.option.id} variants={toneCardVariants}>
                  <ToneStyleCard
                    styleEntry={styleEntry}
                    onSelect={() => {
                      if (previewLocked) return;
                      onStyleSelect(styleEntry.option.id, { tone });
                    }}
                    isLocked={previewLocked}
                    isLockedActive={previewLocked && styleEntry.option.id === lockedStyleId}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </motion.div>
              ))}
              {styles.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">
                  No styles in this tone yet. Check back soon.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
