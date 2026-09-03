import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import PhotoUploader from '@/components/launchpad/PhotoUploader';
import AuthGateModal from '@/components/modals/AuthGateModal';
import { emitStepOneEvent } from '@/utils/telemetry';
import { trackLaunchflowCompleted, trackLaunchflowEditReopen, trackLaunchflowOpened, type LaunchflowEditSource, type LaunchflowOpenSource } from '@/utils/launchflowTelemetry';
import { ORIENTATION_PRESETS } from '@/utils/smartCrop';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import { useLaunchpadActions, useLaunchpadState } from '@/store/hooks/useLaunchpadStore';

const successMessage = 'Photo ready! Explore styles below.';

const formatRelativeTime = (timestamp: number | null) => {
  if (!timestamp) return '';
  const delta = Date.now() - timestamp;
  if (delta < 5_000) return 'Just now';
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const scrollToStudio = (smooth: boolean) => {
  const studioSection = document.querySelector('[data-studio-section]');
  if (studioSection) {
    studioSection.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'start',
    });
  }
};

type SlimBarProps = {
  onEdit: () => void;
  image?: string | null;
  orientationLabel: string;
  readyLabel: string;
};

const SlimBar = ({ onEdit, image, orientationLabel, readyLabel }: SlimBarProps) => (
  <button
    type="button"
    onClick={onEdit}
    className="group flex w-full items-center gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-left transition hover:border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    aria-label="Edit uploaded photo"
  >
    <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/60">
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-slate-800/80" />
      )}
      <span className="absolute bottom-1 left-1 rounded-full bg-slate-950/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/90">
        {orientationLabel}
      </span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-emerald-100">Photo ready</p>
      <p className="text-xs text-emerald-200/80">{readyLabel}</p>
    </div>
    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
      <span className="hidden sm:inline">Edit photo</span>
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 11-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  </button>
);

type CollapsedTeaserProps = {
  onOpen: () => void;
};

const CollapsedTeaser = ({ onOpen }: CollapsedTeaserProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-left transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    aria-expanded="false"
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,255,0.12),transparent_55%)] opacity-90" />
    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Launchflow</p>
        <h3 className="text-2xl font-bold font-poppins text-white sm:text-3xl">Upload your photo to begin</h3>
        <p className="text-sm text-white/70">
          Expand the Launchflow to upload, analyze, and crop without losing sight of your studio.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white/80">
        Start upload
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 11-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </div>
  </button>
);

type SuccessToastProps = {
  show: boolean;
  onDismiss: () => void;
};

const SuccessToast = ({ show, onDismiss }: SuccessToastProps) => (
  <div
    className={clsx(
      'fixed right-6 top-28 z-40 max-w-sm rounded-2xl border border-emerald-400/30 bg-slate-950/80 px-4 py-4 shadow-2xl backdrop-blur-sm transition-all duration-300',
      show ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
    )}
    role="status"
    aria-live="polite"
  >
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
        <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-100">{successMessage}</p>
        <p className="text-xs text-emerald-200/80 mt-1">Scroll below to explore styles with your photo.</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-emerald-200/60 transition hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Dismiss upload complete message"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
);

type MobileFabProps = {
  onClick: () => void;
  hasCroppedImage: boolean;
  disabled: boolean;
};

const MobileLaunchflowFab = ({ onClick, hasCroppedImage, disabled }: MobileFabProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full px-5 py-3.5 shadow-glow-purple transition duration-150 lg:hidden',
      disabled ? 'pointer-events-none opacity-0' : 'opacity-100',
      hasCroppedImage
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white'
        : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
    )}
    style={{
      paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))',
    }}
    aria-label={hasCroppedImage ? 'Edit uploaded photo' : 'Upload your photo'}
  >
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
      <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none">
        {hasCroppedImage ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h8m-8 5h16" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M12 4v9" />
        )}
      </svg>
    </div>
    <span className="text-sm font-semibold">
      {hasCroppedImage ? 'Edit photo' : 'Upload photo'}
    </span>
  </button>
);

type ResumeBannerProps = {
  onResume: () => void;
  onDismiss: () => void;
};

const ResumeBanner = ({ onResume, onDismiss }: ResumeBannerProps) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-[0_25px_60px_rgba(30,64,175,0.35)] backdrop-blur">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/30 via-indigo-500/30 to-blue-500/30 border border-white/15">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Resume your photo setup</p>
          <p className="text-xs text-white/70">
            We saved your upload. Jump back into cropping or continue styling in the studio.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(99,102,241,0.4)] transition hover:scale-105"
        >
          Resume upload
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss resume message"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

const LaunchflowAccordion = () => {
  const {
    launchpadExpanded,
    launchpadSlimMode,
    uploadedImage,
    croppedImage,
    originalImage,
    cropReadyAt,
    orientation,
    entitlementsStatus,
    firstPreviewCompleted,
    generationCount,
  } = useLaunchpadState();
  const { setLaunchpadExpanded, setLaunchpadSlimMode, hydrateEntitlements } = useLaunchpadActions();

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const returningUser = useMemo(() => {
    if (croppedImage) {
      return firstPreviewCompleted || generationCount > 0;
    }
    if (uploadedImage) {
      return generationCount > 0 || firstPreviewCompleted;
    }
    return false;
  }, [croppedImage, uploadedImage, firstPreviewCompleted, generationCount]);

  const showResumeBanner = useMemo(
    () => Boolean(uploadedImage && !croppedImage && returningUser && !resumeDismissed && !launchpadExpanded),
    [uploadedImage, croppedImage, returningUser, resumeDismissed, launchpadExpanded]
  );

  const previousCropRef = useRef<string | null>(null);
  const initialRenderRef = useRef(true);
  const collapseTimerRef = useRef<number>();
  const toastTimerRef = useRef<number>();
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const launchflowStartRef = useRef<number | null>(null);


  useEffect(() => {
    emitStepOneEvent({ type: 'substep', value: 'upload' });
  }, []);

  useEffect(() => {
    if (entitlementsStatus === 'idle') {
      void hydrateEntitlements();
    }
  }, [entitlementsStatus, hydrateEntitlements]);

  useEffect(() => {
    if (uploadedImage && !croppedImage) {
      setResumeDismissed(false);
    }
    if (croppedImage) {
      setResumeDismissed(true);
    }
  }, [uploadedImage, croppedImage]);

  useEffect(() => {
    if (uploadedImage && !croppedImage && !launchpadExpanded && !returningUser) {
      trackLaunchflowOpened('system');
      launchflowStartRef.current = Date.now();
      setLaunchpadExpanded(true);
    }
  }, [uploadedImage, croppedImage, launchpadExpanded, returningUser, setLaunchpadExpanded]);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      previousCropRef.current = croppedImage ?? null;
      return;
    }

    if (croppedImage && croppedImage !== previousCropRef.current) {
      setLaunchpadSlimMode(true);
      setShowSuccessToast(true);

      const startedAt = launchflowStartRef.current;
      trackLaunchflowCompleted(typeof startedAt === 'number' ? Date.now() - startedAt : undefined);
      launchflowStartRef.current = null;

      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setShowSuccessToast(false), 5000);

      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => {
        setLaunchpadExpanded(false);
        scrollToStudio(!prefersReducedMotion);
      }, prefersReducedMotion ? 0 : 240);
    }

    previousCropRef.current = croppedImage ?? null;

    return () => {
      window.clearTimeout(collapseTimerRef.current);
      window.clearTimeout(toastTimerRef.current);
    };
  }, [croppedImage, prefersReducedMotion, setLaunchpadExpanded, setLaunchpadSlimMode]);

  useEffect(() => {
    if (launchpadExpanded) {
      if (launchflowStartRef.current === null) {
        launchflowStartRef.current = Date.now();
      }

      if (document.activeElement instanceof HTMLElement) {
        lastFocusRef.current = document.activeElement;
      }
      window.setTimeout(() => {
        contentRef.current?.focus();
      }, 30);
      if (typeof document !== 'undefined' && window.innerWidth < 1024) {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = previousOverflow;
        };
      }
      return;
    }

    launchflowStartRef.current = null;

    if (!launchpadExpanded && lastFocusRef.current) {
      window.setTimeout(() => lastFocusRef.current?.focus(), 60);
      lastFocusRef.current = null;
    }
  }, [launchpadExpanded]);

  useEffect(
    () => () => {
      window.clearTimeout(collapseTimerRef.current);
      window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const orientationLabel = useMemo(
    () => ORIENTATION_PRESETS[orientation]?.label ?? 'Ready',
    [orientation]
  );
  const readyLabel = formatRelativeTime(cropReadyAt);

  const openLaunchflow = (source: LaunchflowOpenSource, isEdit = false) => {
    if (!launchpadExpanded) {
      trackLaunchflowOpened(source);
      launchflowStartRef.current = Date.now();
      setLaunchpadExpanded(true);
    }

    if (isEdit) {
      let editSource: LaunchflowEditSource = 'slim_bar';
      if (source === 'fab') editSource = 'fab';
      else if (source === 'welcome_banner') editSource = 'welcome_banner';
      else if (source === 'resume_banner') editSource = 'resume_banner';
      else if (source === 'toast') editSource = 'toast';
      trackLaunchflowEditReopen(editSource);
    }
  };

  const handleClose = () => {
    setLaunchpadExpanded(false);
    launchflowStartRef.current = null;
  };

  const handleFabClick = () => openLaunchflow('fab', Boolean(croppedImage));

  const accordionClasses = clsx(
    'overflow-hidden rounded-3xl border border-white/12 bg-slate-950/80 backdrop-blur-lg',
    prefersReducedMotion
      ? launchpadExpanded
        ? 'block'
        : 'hidden'
      : clsx(
          'transition-all duration-400 ease-out will-change-[max-height,opacity]',
          launchpadExpanded
            ? 'max-h-[3200px] opacity-100'
            : 'max-h-0 opacity-0 pointer-events-none'
        )
  );

  return (
    <section
      id="launchflow"
      className="relative border-b border-white/5 bg-[radial-gradient(circle_at_top,rgba(49,72,139,0.28),transparent_55%)] pb-20 pt-16"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6">
        <SuccessToast show={showSuccessToast} onDismiss={() => setShowSuccessToast(false)} />

        {showResumeBanner && (
          <ResumeBanner
            onResume={() => {
              openLaunchflow('resume_banner', true);
              setResumeDismissed(true);
            }}
            onDismiss={() => setResumeDismissed(true)}
          />
        )}

        {!launchpadExpanded && launchpadSlimMode && (
          <SlimBar
            onEdit={() => openLaunchflow('slim_bar', true)}
            image={originalImage}
            orientationLabel={orientationLabel}
            readyLabel={readyLabel || 'Ready to customize'}
          />
        )}

        {!launchpadExpanded && !launchpadSlimMode && (
          <CollapsedTeaser onOpen={() => openLaunchflow('teaser')} />
        )}

        <div className={accordionClasses} aria-hidden={!launchpadExpanded}>
          {launchpadExpanded && (
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/50">Launchflow</p>
                <h2 className="text-xl font-semibold text-white">Upload & refine your source photo</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:inline-flex"
              >
                Cancel
              </button>
            </div>
          )}

          <div
            ref={contentRef}
            tabIndex={-1}
            className={clsx(
              'px-6 py-6 outline-none',
              prefersReducedMotion ? '' : 'transition-opacity duration-300',
              launchpadExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            <PhotoUploader />
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:hidden"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <MobileLaunchflowFab
        onClick={handleFabClick}
        hasCroppedImage={Boolean(croppedImage)}
        disabled={launchpadExpanded}
      />

      <AuthGateModal />
    </section>
  );
};

export default LaunchflowAccordion;
