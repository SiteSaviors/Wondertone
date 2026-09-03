import {
  normalizeFunnelProperties,
  sanitizeFunnelEvent,
  type FunnelEventRecord,
} from '@/utils/funnelAnalytics';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const INGEST_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ingest-funnel-event` : null;

const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH = 8;

const queue: FunnelEventRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let accessTokenProvider: (() => string | null | undefined) | null = null;

export const registerFunnelAccessTokenProvider = (provider: () => string | null | undefined) => {
  accessTokenProvider = provider;
};

const dispatchBrowserAnalyticsEvent = (eventName: string, payload: FunnelEventRecord) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('wondertone-analytics', {
      detail: {
        event: eventName,
        schemaVersion: payload.schemaVersion,
        release: payload.release,
      },
    })
  );
};

const scheduleFlush = () => {
  if (flushTimer || typeof window === 'undefined') return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushFunnelQueue();
  }, FLUSH_INTERVAL_MS);
};

export const flushFunnelQueue = async (): Promise<void> => {
  if (!INGEST_ENDPOINT || !SUPABASE_ANON_KEY || queue.length === 0) {
    queue.length = 0;
    return;
  }

  const batch = queue.splice(0, MAX_BATCH);
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessTokenProvider?.() || SUPABASE_ANON_KEY}`,
  };

  try {
    await fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Drop the batch rather than retrying payloads that might later include stale session state.
  }

  if (queue.length > 0) {
    scheduleFlush();
  }
};

export const sendAnalyticsEvent = (eventName: string, payload: Record<string, unknown> = {}) => {
  const sanitized = sanitizeFunnelEvent({
    eventName,
    properties: normalizeFunnelProperties(payload),
    occurredAt: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
    source: 'client',
    isMember: Boolean(accessTokenProvider?.()),
  });

  if (!sanitized) {
    if (import.meta.env.DEV) {
      console.info('[Analytics] dropped non-allowlisted event', eventName);
    }
    return;
  }

  dispatchBrowserAnalyticsEvent(eventName, sanitized);

  if (import.meta.env.DEV) {
    console.info('[Analytics]', sanitized.eventName, sanitized.release);
  }

  if (typeof window === 'undefined') {
    return;
  }

  queue.push(sanitized);
  if (queue.length >= MAX_BATCH) {
    void flushFunnelQueue();
    return;
  }
  scheduleFlush();
};
