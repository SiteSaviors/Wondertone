/**
 * Social Proof Content Configuration
 *
 * Spotlight quotes stay empty until a real, approved testimonial exists.
 * Do not invent replacements.
 */

export type ProductKind = 'digital' | 'canvas' | 'hybrid';

export type HeroStat = {
  id: string;
  value: string;
  label: string;
  description: string;
};

export type PressLogo = {
  id: string;
  name: string;
  /** Logo path relative to public/ or external URL */
  logoSrc: string;
  alt: string;
  href?: string;
};

export type SpotlightStory = {
  id: string;
  title: string;
  quote: string;
  metric?: string;
  author: string;
  product: ProductKind;
  beforeImage: string;
  afterImage: string;
};

export const HERO_STATS: ReadonlyArray<HeroStat> = [];

export type SpotlightAnalyticsPayload = {
  id: SpotlightStory['id'];
  product: SpotlightStory['product'];
  interaction: 'auto' | 'manual';
};

export const PRESS_LOGOS: ReadonlyArray<PressLogo> = [];

export const SPOTLIGHTS: ReadonlyArray<SpotlightStory> = [];
