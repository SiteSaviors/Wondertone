import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEventHandler,
  type PointerEventHandler,
} from 'react';
import clsx from 'clsx';
import { useStyleCatalogState } from '@/store/hooks/useStyleCatalogStore';
import type { StyleOption } from '@/store/founder/storeTypes';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import { useFounderStore } from '@/store/useFounderStore';

const INSTANT_BREADTH_STYLE_IDS = [
  'classic-oil-painting',
  'calm-watercolor',
  'gallery-acrylic',
  'watercolor-dreams',
  'pastel-bliss',
  'artisan-charcoal',
  'classic-crayon',
  'neon-splash',
  'electric-drip',
  'retro-synthwave',
  'memphis-pop',
  'abstract-chorus',
  '3d-storybook',
  '90s-cartoon',
  'voxel-mineworld',
  'liquid-chrome',
  'the-renaissance',
  'sanctuary-glow',
] as const;

type InstantBreadthItem = Pick<
  StyleOption,
  'id' | 'name' | 'thumbnail' | 'thumbnailWebp' | 'thumbnailAvif'
>;

const selectInstantBreadthItems = (styles: StyleOption[]): InstantBreadthItem[] => {
  if (!styles.length) {
    return [];
  }

  const styleMap = new Map(styles.map((style) => [style.id, style]));
  return INSTANT_BREADTH_STYLE_IDS.map((id) => {
    const entry = styleMap.get(id);
    if (!entry) return null;
    return {
      id: entry.id,
      name: entry.name,
      thumbnail: entry.thumbnail,
      thumbnailWebp: entry.thumbnailWebp ?? null,
      thumbnailAvif: entry.thumbnailAvif ?? null,
    };
  }).filter((item): item is InstantBreadthItem => Boolean(item));
};

const MARQUEE_DURATION_MS = 40000;

const normalizeOffset = (value: number, segment: number) => {
  if (segment <= 0) return 0;
  const remainder = value % segment;
  return remainder < 0 ? remainder + segment : remainder;
};

const InstantBreadthStrip = () => {
  const { styles } = useStyleCatalogState();
  const openStockLibrary = useFounderStore((state) => state.openStockLibrary);
  const prefersReducedMotion = usePrefersReducedMotion();

  const curatedItems = useMemo(() => selectInstantBreadthItems(styles), [styles]);
  const [isInteractive, setIsInteractive] = useState(false);
  const pauseReasonsRef = useRef<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(true);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const segmentWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const manualOffsetRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const draggingRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);

  const applyTransform = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const segment = segmentWidthRef.current;
    if (segment <= 0) {
      track.style.transform = 'translateX(0px)';
      return;
    }
    const total = normalizeOffset(offsetRef.current + manualOffsetRef.current, segment);
    track.style.transform = `translateX(${-total}px)`;
  }, []);

  const recomputePaused = useCallback(() => {
    const paused = prefersReducedMotion || pauseReasonsRef.current.size > 0;
    setIsPaused(paused);
  }, [prefersReducedMotion]);

  const requestPause = useCallback(
    (reason: string) => {
      if (!pauseReasonsRef.current.has(reason)) {
        pauseReasonsRef.current.add(reason);
        recomputePaused();
      }
    },
    [recomputePaused]
  );

  const releasePause = useCallback(
    (reason: string) => {
      if (pauseReasonsRef.current.delete(reason)) {
        recomputePaused();
      }
    },
    [recomputePaused]
  );

  const handleOpenSample = () => {
    openStockLibrary();
  };

  const shouldDuplicate = isInteractive && curatedItems.length > 0;

  useEffect(() => {
    setIsInteractive(true);
  }, []);

  useEffect(() => {
    recomputePaused();
  }, [recomputePaused]);

  useEffect(() => {
    if (!shouldDuplicate) {
      offsetRef.current = 0;
      manualOffsetRef.current = 0;
      applyTransform();
    }
  }, [applyTransform, shouldDuplicate]);

  useEffect(() => {
    if (!isInteractive) {
      const track = trackRef.current;
      if (track) {
        track.style.transform = '';
        track.style.willChange = '';
      }
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    track.style.willChange = 'transform';

    const updateSegmentWidth = () => {
      const segment = shouldDuplicate ? track.scrollWidth / 2 : 0;
      segmentWidthRef.current = Number.isFinite(segment) ? segment : 0;
      applyTransform();
    };

    updateSegmentWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSegmentWidth());
      observer.observe(track);
      return () => observer.disconnect();
    }

    return undefined;
  }, [applyTransform, isInteractive, shouldDuplicate, curatedItems.length]);

  useEffect(() => {
    if (!isInteractive) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        releasePause('visibility');
      } else {
        requestPause('visibility');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInteractive, releasePause, requestPause]);

  useEffect(() => {
    if (!isInteractive || !shouldDuplicate) {
      lastTimestampRef.current = null;
      return;
    }
    if (segmentWidthRef.current <= 0) return;

    let frameId: number;
    const loop = (timestamp: number) => {
      const track = trackRef.current;
      if (!track) return;

      const previous = lastTimestampRef.current ?? timestamp;
      const delta = timestamp - previous;
      lastTimestampRef.current = timestamp;

      if (!isPaused && segmentWidthRef.current > 0) {
        const distance = (delta * segmentWidthRef.current) / MARQUEE_DURATION_MS;
        offsetRef.current = normalizeOffset(offsetRef.current + distance, segmentWidthRef.current);
        applyTransform();
      }

      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frameId);
      lastTimestampRef.current = null;
    };
  }, [applyTransform, isInteractive, isPaused, shouldDuplicate]);

  const marqueeItems = useMemo(
    () => (shouldDuplicate ? [...curatedItems, ...curatedItems] : curatedItems),
    [curatedItems, shouldDuplicate]
  );

  const handleMouseEnter = () => requestPause('hover');
  const handleMouseLeave = () => releasePause('hover');

  const handleFocusCapture = () => requestPause('focus');
  const handleBlurCapture: FocusEventHandler<HTMLDivElement> = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      releasePause('focus');
    }
  };

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!shouldDuplicate) return;
    const track = trackRef.current;
    if (!track) return;

    event.preventDefault();
    draggingRef.current = true;
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    manualOffsetRef.current = 0;
    requestPause('drag');
    track.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!draggingRef.current) return;
    manualOffsetRef.current = dragStartXRef.current - event.clientX;
    event.preventDefault();
    applyTransform();
  };

  const endDrag = useCallback(
    (pointerId?: number) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      const segment = segmentWidthRef.current;
      const base = dragStartOffsetRef.current + manualOffsetRef.current;
      offsetRef.current = normalizeOffset(base, segment);
      manualOffsetRef.current = 0;
      applyTransform();
      releasePause('drag');

      if (pointerId != null && trackRef.current?.hasPointerCapture(pointerId)) {
        trackRef.current.releasePointerCapture(pointerId);
      }
    },
    [applyTransform, releasePause]
  );

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    endDrag(event.pointerId);
  };

  const handlePointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    endDrag(event.pointerId);
  };

  if (!curatedItems.length) {
    return null;
  }

  return (
    <section
      className="border-t border-white/10 bg-slate-950/95 bg-[radial-gradient(circle_at_top,rgba(49,72,139,0.28),transparent_55%)] text-white"
      data-founder-anchor="instant-breadth"
    >
      <div className="mx-auto flex max-w-[1800px] flex-col gap-10 px-6 py-14 sm:gap-12 lg:py-16">
        <header className="relative flex flex-col items-center gap-4 pt-10 text-center">
          <span
            className="pointer-events-none absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.35),transparent_70%)] blur-[120px]"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -top-6 left-1/2 h-72 w-[420px] -translate-x-1/2 rounded-[220px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_65%)] blur-[100px] opacity-80"
            aria-hidden="true"
          />
          <h2 className="font-poppins text-[28px] font-bold tracking-tight text-white sm:text-3xl md:text-[48px]">
            One photo. Many styles. See the look first.
          </h2>
          <p className="font-poppins max-w-4xl text-base text-white/80 sm:text-lg">
            Upload a picture. Pick a look. Preview is display-only.
          </p>
          <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60 sm:text-base">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">✓</span>
              Free preview
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">✓</span>
              No card required
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">✓</span>
              No prompts
            </span>
          </p>
        </header>

        <div className="relative flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_70%)] blur-[110px] opacity-80"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_bottom,rgba(168,85,247,0.18),transparent_65%)] blur-[120px] opacity-60 animate-pulse"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={handleOpenSample}
            className={clsx(
              'inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_0_rgba(0,0,0,0)] transition',
              'hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70'
            )}
          >
            Browse Our Library →
          </button>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950/95 via-slate-950/50 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-950/95 via-slate-950/50 to-transparent z-10" />
          <div
            className={clsx(
              'px-1 py-2',
              isInteractive ? 'overflow-hidden' : 'overflow-x-auto',
              !isInteractive && 'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent'
            )}
            role="list"
            aria-label="Wondertone style highlights"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
          >
            <div
              ref={trackRef}
              className="flex select-none gap-6"
              style={{ transform: 'translateX(0px)', touchAction: 'pan-y' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              {marqueeItems.map((item, index) => {
                const isClone = shouldDuplicate && index >= curatedItems.length;
                return (
                  <article
                    key={`${item.id}-${index}`}
                    className="group flex w-[160px] flex-shrink-0 flex-col sm:w-[200px] md:w-[220px] lg:w-[240px]"
                    role="listitem"
                    aria-hidden={isClone ? 'true' : undefined}
                  >
                    {/* Gold gradient border wrapper */}
                    <div className="relative p-[2px] rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-400">
                      <div className="relative overflow-hidden rounded-3xl bg-white/5 transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.3)] group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] group-hover:scale-[1.03]">
                        <picture>
                          {item.thumbnailAvif ? (
                            <source srcSet={item.thumbnailAvif} type="image/avif" />
                          ) : null}
                          {item.thumbnailWebp ? (
                            <source srcSet={item.thumbnailWebp} type="image/webp" />
                          ) : null}
                          <img
                            src={item.thumbnail}
                            alt={`${item.name} thumbnail`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </picture>

                        {/* Frosted glass style name overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md px-3 py-2.5 border-t border-white/10">
                          <p className="text-xs font-bold text-white uppercase tracking-[0.15em] sm:text-sm">
                            {item.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default memo(InstantBreadthStrip);
