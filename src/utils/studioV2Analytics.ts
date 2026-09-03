import type { Orientation } from '@/utils/imageUtils';

type CanvasFrameOption = 'none' | 'black' | 'white';

export type CanvasSelectionSnapshot = {
  canvasSize: string | null;
  frame: CanvasFrameOption;
  enhancements: string[];
  orientation: Orientation;
};

type StudioV2EventPayloads = {
  'v2_story_teaser_view': {
    styleId: string;
    source: 'pre-upload' | 'post-upload';
  };
  'v2_story_palette_hover': {
    styleId: string;
    swatchHex: string;
  };
  'v2_curated_style_click': {
    currentStyleId: string;
    clickedStyleId: string;
    position: 1 | 2;
    allowed: boolean;
    reason?: string | null;
  };
  'v2_canvas_cta_click': {
    styleId: string;
    orientation: Orientation;
    source: 'center' | 'rail';
  };
  'v2_canvas_modal_open': CanvasSelectionSnapshot & {
    styleId: string;
    sourceCTA: 'center' | 'rail';
  };
  'v2_canvas_modal_close': {
    styleId: string;
    reason: 'dismiss' | 'cancel' | 'esc_key' | 'backdrop' | 'purchase_complete';
    timeSpentMs: number;
    configuredItems: CanvasSelectionSnapshot;
  };
  'v2_canvas_modal_orientation': {
    styleId: string;
    orientation: Orientation;
  };
  'v2_story_share_click': {
    styleId: string;
    platform: 'twitter' | 'facebook' | 'pinterest' | 'copy';
    status: 'success' | 'fallback' | 'error';
  };
  'v2_canvas_orientation_cta': {
    styleId: string;
    orientation: Orientation;
  };
};

type StudioV2EventName = keyof StudioV2EventPayloads;

type StudioV2Event<T extends StudioV2EventName = StudioV2EventName> = {
  event: T;
  payload: StudioV2EventPayloads[T];
};

const listeners: Array<(event: StudioV2Event) => void> = [];

export const registerStudioV2AnalyticsListener = (
  listener: (event: StudioV2Event) => void
) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
};

const emitStudioV2Event = <T extends StudioV2EventName>(
  event: T,
  payload: StudioV2EventPayloads[T]
) => {
  const record: StudioV2Event<T> = { event, payload };

  if (import.meta.env.DEV) {
    console.info('[StudioV2Analytics]', event);
  }

  listeners.forEach((listener) => {
    try {
      listener(record);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[StudioV2Analytics] listener error', error);
      }
    }
  });
};

export const trackStudioV2StoryTeaserView = (
  payload: StudioV2EventPayloads['v2_story_teaser_view']
) => emitStudioV2Event('v2_story_teaser_view', payload);

export const trackStudioV2StoryPaletteHover = (
  payload: StudioV2EventPayloads['v2_story_palette_hover']
) => emitStudioV2Event('v2_story_palette_hover', payload);

export const trackStudioV2CuratedStyleClick = (
  payload: StudioV2EventPayloads['v2_curated_style_click']
) => emitStudioV2Event('v2_curated_style_click', payload);

export const trackStudioV2CanvasCtaClick = (
  payload: StudioV2EventPayloads['v2_canvas_cta_click']
) => emitStudioV2Event('v2_canvas_cta_click', payload);

export const trackStudioV2CanvasModalOpen = (
  payload: StudioV2EventPayloads['v2_canvas_modal_open']
) => emitStudioV2Event('v2_canvas_modal_open', payload);

export const trackStudioV2CanvasModalClose = (
  payload: StudioV2EventPayloads['v2_canvas_modal_close']
) => emitStudioV2Event('v2_canvas_modal_close', payload);

export const trackStudioV2CanvasModalOrientation = (
  payload: StudioV2EventPayloads['v2_canvas_modal_orientation']
) => emitStudioV2Event('v2_canvas_modal_orientation', payload);

export const trackStudioV2StoryShareClick = (
  payload: StudioV2EventPayloads['v2_story_share_click']
) => emitStudioV2Event('v2_story_share_click', payload);

export const trackStudioV2OrientationCta = (
  payload: StudioV2EventPayloads['v2_canvas_orientation_cta']
) => emitStudioV2Event('v2_canvas_orientation_cta', payload);

export type { StudioV2Event, StudioV2EventName, StudioV2EventPayloads };
