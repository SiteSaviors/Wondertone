import { trackVisit } from '@/utils/telemetry';
import { useFounderStore } from '@/store/useFounderStore';

export type LaunchflowOpenSource =
  | 'hero'
  | 'teaser'
  | 'fab'
  | 'slim_bar'
  | 'empty_state'
  | 'style_card'
  | 'system'
  | 'welcome_banner'
  | 'resume_banner';
export type LaunchflowEditSource = 'slim_bar' | 'fab' | 'toast' | 'welcome_banner' | 'resume_banner';
export type LaunchflowEmptyStateAction = 'open_launchflow' | 'browse_styles';

type LaunchflowHealthEvent = 'open' | 'complete';

type LaunchflowEventPayload = Record<string, unknown>;

const launchflowOpenTimestamps: number[] = [];
const launchflowCompleteTimestamps: number[] = [];
const HEALTH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes rolling window
const HEALTH_THRESHOLD = 5;
let lastHealthAlertAt = 0;

const logLaunchflowEvent = (label: string, payload: LaunchflowEventPayload) => {
  if (import.meta.env.DEV) {
    console.info(`[Launchflow] ${label}`, payload);
  }
};

const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
  if (typeof window === 'undefined') return 'unknown';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

const getLaunchflowContext = () => {
  const state = useFounderStore.getState();
  if (typeof state.prefetchAuthClient === 'function') {
    state.prefetchAuthClient();
  }
  const tier = state.entitlements?.tier ?? 'free';
  const isAuthenticated = state.isAuthenticated || Boolean(state.sessionUser);
  const returning =
    state.firstPreviewCompleted ||
    state.generationCount > 0 ||
    Boolean(state.croppedImage) ||
    Boolean(state.uploadedImage);

  return {
    tier,
    authenticated: isAuthenticated ? 'authenticated' : 'guest',
    returningStatus: returning ? 'returning' : 'first-time',
    deviceType: getDeviceType(),
    sessionHydrated: state.sessionHydrated,
  };
};

const recordHealthSignal = (event: LaunchflowHealthEvent, shared: LaunchflowEventPayload) => {
  const now = Date.now();
  const prune = (timestamps: number[]) => {
    while (timestamps.length > 0 && timestamps[0] < now - HEALTH_WINDOW_MS) {
      timestamps.shift();
    }
  };

  if (event === 'open') {
    launchflowOpenTimestamps.push(now);
  } else {
    launchflowCompleteTimestamps.push(now);
  }

  prune(launchflowOpenTimestamps);
  prune(launchflowCompleteTimestamps);

  const deficit = launchflowOpenTimestamps.length - launchflowCompleteTimestamps.length;
  if (deficit >= HEALTH_THRESHOLD && now - lastHealthAlertAt > HEALTH_WINDOW_MS / 2) {
    lastHealthAlertAt = now;
    const payload = {
      ...shared,
      openCount: launchflowOpenTimestamps.length,
      completionCount: launchflowCompleteTimestamps.length,
      deficit,
      windowMs: HEALTH_WINDOW_MS,
    };
    // Health warnings are operational, not Prism persist events.
    logLaunchflowEvent('health_warning', payload);
  }
};

export const trackLaunchflowOpened = (source: LaunchflowOpenSource) => {
  const context = {
    ...getLaunchflowContext(),
    source,
  };
  logLaunchflowEvent('open', context);
  trackVisit();
  recordHealthSignal('open', context);
};

export const trackLaunchflowCompleted = (elapsedMs?: number) => {
  const context = {
    ...getLaunchflowContext(),
    elapsedMs: typeof elapsedMs === 'number' ? Math.max(0, Math.round(elapsedMs)) : undefined,
  };
  logLaunchflowEvent('complete', context);
  // Launchflow complete is not a Prism persist event.
  recordHealthSignal('complete', context);
};

export const trackLaunchflowEditReopen = (source: LaunchflowEditSource) => {
  const context = {
    ...getLaunchflowContext(),
    source,
  };
  logLaunchflowEvent('edit_reopen', context);
  // Edit reopen is not a Prism persist event.
};

export const trackLaunchflowEmptyStateInteraction = (action: LaunchflowEmptyStateAction) => {
  const context = {
    ...getLaunchflowContext(),
    action,
  };
  logLaunchflowEvent('empty_state_interaction', context);
  // Empty-state interactions are not Prism persist events.
};
