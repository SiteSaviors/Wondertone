import { useState, useEffect, useMemo, useRef, lazy, Suspense, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useToneSections } from '@/store/hooks/useToneSections';
import { useHandleStyleSelect } from '@/sections/studio/hooks/useHandleStyleSelect';
import { useStudioFeedback } from '@/hooks/useStudioFeedback';
import { emitStepOneEvent } from '@/utils/telemetry';
import { useStyleThumbnailPrefetch } from '@/sections/studio/hooks/useStyleThumbnailPrefetch';
import type { PrefetchGroupStatus } from '@/sections/studio/hooks/useStyleThumbnailPrefetch';
import type { StyleTone } from '@/config/styleCatalog';
import type { GateResult } from '@/utils/entitlementGate';
import { TONE_GRADIENTS } from '@/config/toneGradients';
import './StyleAccordion.css';

const ToneSection = lazy(() => import('./ToneSection'));

type StyleAccordionProps = {
  hasCroppedImage: boolean;
};

export default function StyleAccordion({ hasCroppedImage }: StyleAccordionProps) {
  const { sections: toneSections, ensureToneEvaluated } = useToneSections();
  const { showUpgradeModal } = useStudioFeedback();
  const prefersReducedMotion = useReducedMotion();

  const mediaQueryRef = useRef<MediaQueryList | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const mq = window.matchMedia('(min-width: 1024px)');
    mediaQueryRef.current = mq;
    return mq.matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = mediaQueryRef.current ?? window.matchMedia('(min-width: 1024px)');
    mediaQueryRef.current = mq;
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener('change', handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Single active tone (mobile accordion behavior)
  const [activeTone, setActiveTone] = useState<StyleTone | null>('trending');
  // Track collapsed tones for desktop (absence means expanded)
  const [collapsedTones, setCollapsedTones] = useState<Set<StyleTone>>(new Set());

  // Track prefetched sections to prevent duplicate requests
  // Trending tooltip state for first-time users
  const [showTrendingTip, setShowTrendingTip] = useState(false);

  const prefetchGroups = useMemo(
    () =>
      toneSections.map((section) => ({
        id: section.tone,
        thumbnails: section.styles.map(({ option }) => option.thumbnail),
      })),
    [toneSections]
  );

  const { registerGroup, prefetchState, prefetchGroup } = useStyleThumbnailPrefetch({
    groups: prefetchGroups,
  });

  const prefetchGroupMap = useMemo(
    () => new Map(prefetchGroups.map((group) => [group.id, group])),
    [prefetchGroups]
  );

  // Collapse all tones except trending on initial desktop load
  useEffect(() => {
    if (!isDesktop || toneSections.length === 0) return;
    setCollapsedTones((previous) => {
      if (previous.size > 0) {
        return previous;
      }
      const next = new Set<StyleTone>();
      toneSections.forEach(({ tone }) => {
        if (tone !== 'trending') {
          next.add(tone);
        }
      });
      return next;
    });
  }, [isDesktop, toneSections]);

  useEffect(() => {
    if (isDesktop || !activeTone) return;
    ensureToneEvaluated(activeTone);
    const group = prefetchGroupMap.get(activeTone);
    if (group) {
      void prefetchGroup(group);
    }
  }, [activeTone, ensureToneEvaluated, isDesktop, prefetchGroupMap, prefetchGroup]);

  const selectedTone = useMemo(
    () =>
      toneSections.find((section) => section.styles.some((style) => style.isSelected))
        ?.tone ?? null,
    [toneSections]
  );

  useEffect(() => {
    if (!selectedTone) return;
    ensureToneEvaluated(selectedTone);
  }, [selectedTone, ensureToneEvaluated]);

  // Emit view telemetry when a new tone expands
  useEffect(() => {
    if (isDesktop || !activeTone) return;
    emitStepOneEvent({ type: 'tone_section_view', tone: activeTone });
  }, [activeTone, isDesktop]);

  // Auto-expand Trending with tooltip for first-time users
  useEffect(() => {
    if (isDesktop) return;
    const hasSeenTip = localStorage.getItem('hasSeenTrendingTip');

    if (!hasSeenTip && hasCroppedImage) {
      // Show tooltip after 300ms delay for gentle entry
      const showTimer = setTimeout(() => setShowTrendingTip(true), 300);

      // Auto-dismiss after 5s
      const dismissTimer = setTimeout(() => {
        setShowTrendingTip(false);
        localStorage.setItem('hasSeenTrendingTip', 'true');
      }, 5300); // 300ms delay + 5000ms display

      return () => {
        clearTimeout(showTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [hasCroppedImage, isDesktop]);

  const handleDismissTip = () => {
    setShowTrendingTip(false);
    localStorage.setItem('hasSeenTrendingTip', 'true');
  };

  // Handle gate denials - FIXED: Correct modal signature + analytics
  const handleGateDenied = (gate: GateResult, styleId: string, tone: string) => {
    if (gate.reason === 'quota_exceeded') {
      showUpgradeModal({
        title: 'Out of Generations',
        description: gate.message || "You've used all your generations this month. Upgrade to continue creating.",
        ctaLabel: gate.ctaText || 'Upgrade Now',
      });
    } else if (gate.reason === 'style_locked') {
      showUpgradeModal({
        title: 'Premium Style',
        description: gate.message || `"${styleId}" requires ${gate.requiredTier?.toUpperCase()} tier or higher.`,
        ctaLabel: gate.ctaText || `Upgrade to ${gate.requiredTier?.toUpperCase()}`,
      });
      emitStepOneEvent({
        type: 'tone_upgrade_prompt',
        styleId,
        tone,
        requiredTier: gate.requiredTier ?? null,
      });
    } else if (gate.reason === 'entitlements_loading') {
      // Silent - loading state
      return;
    } else {
      // Fallback for other gate reasons
      showUpgradeModal({
        title: 'Unable to Generate',
        description: gate.message || 'Please try again or upgrade your account.',
        ctaLabel: 'View Plans',
      });
    }

    // FIXED: Correct analytics event shape
    emitStepOneEvent({
      type: 'tone_style_locked',
      styleId: styleId,
      tone,
      requiredTier: gate.requiredTier ?? null,
    });
  };

  // FIXED: Use callback from useHandleStyleSelect for gate handling
  const handleStyleSelect = useHandleStyleSelect({
    onGateDenied: ({ gate, styleId, tone }) => {
      handleGateDenied(gate, styleId, tone ?? 'unknown');
    },
  });

  const toggleTone = (tone: StyleTone) => {
    if (isDesktop) {
      const isCollapsed = collapsedTones.has(tone);
      if (isCollapsed) {
        const next = new Set(collapsedTones);
        next.delete(tone);
        setCollapsedTones(next);
        ensureToneEvaluated(tone);
        const group = prefetchGroupMap.get(tone);
        if (group) {
          void prefetchGroup(group);
        }
        emitStepOneEvent({ type: 'tone_section_view', tone });
      } else {
        setCollapsedTones((prev) => {
          const next = new Set(prev);
          next.add(tone);
          return next;
        });
      }
      return;
    }

    const wasExpanded = activeTone === tone;

    ensureToneEvaluated(tone);
    setActiveTone((prev) => (prev === tone ? null : tone));

    if (!wasExpanded) {
      const group = prefetchGroupMap.get(tone);
      if (group) {
        void prefetchGroup(group);
      }
    }
  };

  useEffect(() => {
    if (!isDesktop) return;
    setCollapsedTones((prev) => {
      const valid = new Set<StyleTone>(toneSections.map((section) => section.tone));
      const next = new Set<StyleTone>();
      prev.forEach((tone) => {
        if (valid.has(tone)) {
          next.add(tone);
        }
      });
      return next;
    });
  }, [isDesktop, toneSections]);

  useEffect(() => {
    if (isDesktop) {
      setActiveTone(null);
    } else {
      setCollapsedTones(new Set());
      setActiveTone((prev) => prev ?? 'trending');
    }
  }, [isDesktop]);

  const toneAmbientStyle = useMemo(() => {
    if (isDesktop || !activeTone) return undefined;
    const ambient = TONE_GRADIENTS[activeTone]?.ambient;
    if (!ambient) return undefined;
    const style: CSSProperties = {
      '--tone-ambient-from': ambient.from,
      '--tone-ambient-via': ambient.via,
      '--tone-ambient-to': ambient.to,
    };
    return style;
  }, [activeTone, isDesktop]);

  const ambientClasses = useMemo(
    () =>
      clsx(
        'tone-ambient-container relative space-y-4',
        isDesktop || activeTone ? 'visible' : '',
        prefersReducedMotion ? 'reduced-motion' : ''
      ),
    [activeTone, isDesktop, prefersReducedMotion]
  );

  return (
    <div className={ambientClasses} style={toneAmbientStyle}>
      <AnimatePresence initial={false}>
        {toneSections.map((section) => {
          const group = prefetchGroupMap.get(section.tone);
          const prefetchStatus: PrefetchGroupStatus = prefetchState[section.tone]?.status ?? 'idle';
          const isExpanded = isDesktop
            ? !collapsedTones.has(section.tone)
            : activeTone === section.tone;
          return (
            <motion.div
              key={section.tone}
              ref={group ? registerGroup(group) : undefined}
              initial={false}
              className="relative"
            >
            {/* Trending tooltip for first-time users */}
            {section.tone === 'trending' && showTrendingTip && (
              <div
                className={clsx(
                  'absolute -top-20 left-0 right-0 z-30 px-4 animate-in fade-in-0 slide-in-from-top-2 duration-300'
                )}
              >
                <div
                  className={clsx(
                    'relative px-4 py-3 rounded-xl',
                    'bg-slate-900/95 backdrop-blur-md',
                    'border border-purple-400/30',
                    'text-sm text-white',
                    'shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
                  )}
                >
                  <button
                    onClick={handleDismissTip}
                    className="absolute top-2 right-2 text-white/60 hover:text-white transition-colors"
                    aria-label="Dismiss tooltip"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <p className="pr-6 leading-relaxed text-sm font-medium">
                    <span className="mr-2">👋</span>
                    Start here — most-loved styles this week
                  </p>

                  {/* Arrow pointing to Trending section */}
                  <div
                    className="absolute -bottom-2 left-8 w-4 h-4 bg-slate-900 border-r border-b border-purple-400/30 rotate-45 -z-10"
                  />
                </div>
              </div>
            )}

            <Suspense fallback={<div className="min-h-[72px]" aria-hidden="true" />}>
              <ToneSection
                section={section}
                toneMeta={TONE_GRADIENTS[section.tone]}
                prefersReducedMotion={prefersReducedMotion}
                onStyleSelect={(styleId, meta) => {
                  handleStyleSelect(styleId, meta);
                }}
                isExpanded={isExpanded}
                onToggle={() => toggleTone(section.tone)}
                prefetchStatus={prefetchStatus}
              />
            </Suspense>
          </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
