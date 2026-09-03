export type PreviewStage = 'start' | 'animating' | 'generating' | 'polling' | 'complete' | 'error';

export interface PreviewMetricEvent {
  styleId: string;
  stage: PreviewStage;
  elapsedMs: number;
  timestamp: number;
  message?: string | null;
}

export const logPreviewStage = (event: PreviewMetricEvent) => {
  const { styleId, stage, elapsedMs } = event;
  const rounded = Math.round(elapsedMs);
  if (import.meta.env.DEV) {
    console.info(`%c[PreviewAnalytics] style=${styleId} stage=${stage} elapsed=${rounded}ms`, 'color:#a855f7');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('founder-preview-analytics', { detail: event }));
  }
};
