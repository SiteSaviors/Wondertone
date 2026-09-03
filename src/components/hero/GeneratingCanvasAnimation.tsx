import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ArrowLeftRight } from 'lucide-react';
import { clsx } from 'clsx';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import './GeneratingCanvasAnimation.css';

type GeneratingCanvasAnimationProps = {
  defaultStyleImage: string;
  originalImage?: string;
  styleName?: string;
  styleTagline?: string;
  videoSrc?: string;
  posterImage?: string;
  generationDuration?: number;
  animateGeneration?: boolean;
  className?: string;
  onGenerationComplete?: () => void;
};

const GeneratingCanvasAnimation = ({
  defaultStyleImage,
  originalImage,
  styleName = 'Classic Oil Painting',
  styleTagline = 'Traditional brush strokes',
  videoSrc,
  posterImage,
  generationDuration = 2500,
  animateGeneration = true,
  className = '',
  onGenerationComplete,
}: GeneratingCanvasAnimationProps) => {
  const [phase, setPhase] = useState<'loading' | 'generating' | 'complete'>(
    animateGeneration ? 'loading' : 'complete'
  );
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!animateGeneration || prefersReducedMotion) {
      setPhase('complete');
      setHasPlayed(true);
      return;
    }

    setPhase('loading');

    const loadingTimer = window.setTimeout(() => {
      setPhase('generating');

      if (videoRef.current && videoSrc) {
        videoRef.current.play().catch(() => {
          setPhase('complete');
        });
      }
    }, 300);

    const completeTimer = window.setTimeout(() => {
      setPhase('complete');
      setHasPlayed(true);
      onGenerationComplete?.();
    }, generationDuration + 300);

    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [animateGeneration, videoSrc, generationDuration, onGenerationComplete, prefersReducedMotion]);

  useEffect(() => {
    if (phase === 'complete' && originalImage) {
      const hintTimer = window.setTimeout(() => setShowHint(false), 4000);
      return () => window.clearTimeout(hintTimer);
    }
  }, [phase, originalImage]);

  const progressStyle = useMemo(() => {
    return {
      width: phase === 'complete' ? '100%' : phase === 'generating' ? '100%' : '20%',
      transitionDuration: `${generationDuration / 1000}s`,
    };
  }, [phase, generationDuration]);

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault();
    setShowingOriginal(true);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    setShowingOriginal(false);
  };

  const overlayVisible = phase !== 'complete';
  const reducedAttr = prefersReducedMotion ? 'true' : 'false';
  const hintKey = showHint ? 'hint' : 'ready';

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-slate-900 shadow-2xl ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <img
          src={defaultStyleImage}
          alt="AI Generated Canvas"
          className={clsx(
            'w-full h-full object-cover transition-opacity duration-300',
            showingOriginal ? 'opacity-0' : 'opacity-100'
          )}
          draggable="false"
          style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        />

        {originalImage && (
          <img
            src={originalImage}
            alt="Original Photo"
            className={clsx(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
              showingOriginal ? 'opacity-100' : 'opacity-0'
            )}
            draggable="false"
            style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          />
        )}

        {phase === 'complete' && originalImage && (
          <div
            className="absolute inset-0 w-full h-full cursor-pointer"
            style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            onMouseEnter={() => setShowingOriginal(true)}
            onMouseLeave={() => setShowingOriginal(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(event) => event.preventDefault()}
          />
        )}

        {videoSrc && phase === 'generating' && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            poster={posterImage}
            playsInline
            muted
            onEnded={() => {
              setPhase('complete');
              setHasPlayed(true);
            }}
          >
            <source src={videoSrc} type="video/mp4" />
            <source src={videoSrc.replace('.mp4', '.webm')} type="video/webm" />
          </video>
        )}

        <div
          className={clsx(
            'absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center hero-canvas-overlay'
          )}
          data-visible={overlayVisible}
          data-reduced-motion={reducedAttr}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-400 flex items-center justify-center animate-spin"
              style={{ animationDuration: '2s' }}
            >
              <Loader2 className="w-8 h-8 text-purple-400" />
            </div>

            <div
              key={phase}
              className="text-center hero-canvas-status"
              data-visible={overlayVisible}
              data-reduced-motion={reducedAttr}
            >
              <p className="text-lg font-semibold text-white mb-1">
                {phase === 'loading' ? 'Starting…' : 'Generating your look…'}
              </p>
              <p className="text-sm text-white/60">Just a moment</p>
            </div>

            <div className="relative w-48 h-1 bg-purple-500/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400/60 transition-[width] ease-in-out"
                style={prefersReducedMotion ? { width: '100%' } : progressStyle}
              />
              {!prefersReducedMotion && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-purple-200/70 to-transparent animate-progress-shimmer" />
                </div>
              )}
            </div>
          </div>
        </div>

        {phase === 'complete' && !hasPlayed && (
          <div
            className="absolute top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 hero-canvas-pop"
            data-reduced-motion={reducedAttr}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Generated!</span>
          </div>
        )}

        {phase === 'complete' && hasPlayed && originalImage && (
          <div
            className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm text-white/70 p-2 rounded-full shadow-lg hero-canvas-compare-hint"
            data-reduced-motion={reducedAttr}
            aria-label="Hover to compare with original"
          >
            <div className="animate-pulse-slow">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{styleName}</p>
            <p className="text-xs text-white/60">{styleTagline}</p>
          </div>
          {phase === 'complete' && (
            <>
              {originalImage ? (
                <div
                  key={hintKey}
                  className="text-xs font-medium hero-canvas-hint-message"
                  data-reduced-motion={reducedAttr}
                >
                  {showHint ? (
                    <>
                      <span className="hidden md:inline text-purple-300">🖱️ Hover to compare</span>
                      <span className="md:hidden text-purple-300">👆 Hold to compare</span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratingCanvasAnimation;
