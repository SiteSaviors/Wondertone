/**
 * Social Proof Content Configuration
 *
 * Phase 1 provides typed placeholder data so the section can render statically
 * before real assets arrive. Content teams will replace these entries during
 * Phase 0 handoff.
 *
 * IMPORTANT: Runtime sanity checks are limited to development mode to avoid
 * crashing production builds. When adding new testimonials or modifying ratios,
 * ensure these checks continue to pass locally.
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

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="%231f2937"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="Arial" font-size="28">Wondertone Placeholder</text></svg>';

export const HERO_STATS: ReadonlyArray<HeroStat> = [];

export type SpotlightAnalyticsPayload = {
  id: SpotlightStory['id'];
  product: SpotlightStory['product'];
  interaction: 'auto' | 'manual';
};

export const PRESS_LOGOS: ReadonlyArray<PressLogo> = [];

export const SPOTLIGHTS: ReadonlyArray<SpotlightStory> = [
  {
    id: 'spotlight-creator-engagement',
    title: 'Creator Spotlight',
    quote: '“Wondertone gave my feed a premium polish overnight.”',
    metric: '+320% engagement in 30 days',
    author: 'Sarah M.',
    product: 'digital',
    beforeImage: '/Sarah-Review-Before.jpg',
    afterImage: '/Sarah-Review-After.jpg',
  },
  {
    id: 'spotlight-portfolio',
    title: 'Portfolio Ready',
    quote: '“Clients finally see my vision—every export arrives watermark-free.”',
    metric: '18 styles delivered per shoot',
    author: 'Alex T.',
    product: 'digital',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-canvas',
    title: 'From Feed to Frame',
    quote: '“We cried seeing our Watercolor Dreams Canvas! It looks exactly like the preview! LOVE IT!”',
    metric: '3 framed prints for the studio',
    author: 'Jamie L.',
    product: 'canvas',
    beforeImage: '/Canvas-Review-Before-min.jpg',
    afterImage: '/Canvas-Review-After-min.jpg',
  },
  {
    id: 'spotlight-brand-refresh',
    title: 'Brand Refresh',
    quote: '“Nine new looks in under an hour—our launch visuals stayed on brand.”',
    metric: '9 style sets approved in 48 hours',
    author: 'Lena C.',
    product: 'digital',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-reels',
    title: 'Reels Performance',
    quote: '“Motion previews exported clean—our reels views tripled overnight.”',
    metric: '3.1× average reel watch time',
    author: 'Marco G.',
    product: 'digital',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-wedding',
    title: 'Wedding Keepsake',
    quote: '“The couple cried seeing their gallery print—tone-matched to their palette.”',
    metric: '24x36 canvas',
    author: 'Aisha P.',
    product: 'canvas',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-hybrid-studio',
    title: 'Hybrid Studio',
    quote: '“Subscribers loved the digital drop, then upsold instantly to framed prints.”',
    metric: '42% digital-to-canvas upsell rate',
    author: 'Nate R.',
    product: 'hybrid',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-podcast',
    title: 'Podcast Artwork',
    quote: '“Thumbnail polish gave the show a premium edge—listeners instantly noticed.”',
    metric: '+210% click-through on episodes',
    author: 'Riley S.',
    product: 'digital',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
  {
    id: 'spotlight-gallery-drop',
    title: 'Gallery Drop',
    quote: '“Limited run canvases sold out—Wondertone handled every proof perfectly.”',
    metric: '50-piece canvas run, zero revisions',
    author: 'Dana K.',
    product: 'canvas',
    beforeImage: PLACEHOLDER_IMAGE,
    afterImage: PLACEHOLDER_IMAGE,
  },
] as const;

const isDev = import.meta.env.DEV;

if (isDev) {
  const digitalCount = SPOTLIGHTS.filter((story) => story.product === 'digital').length;
  const canvasCount = SPOTLIGHTS.filter((story) => story.product === 'canvas').length;

  if (digitalCount < 2) {
    console.warn('[SocialProof] Expected at least two digital spotlights for subscription emphasis.');
  }
  if (canvasCount < 1) {
    console.warn('[SocialProof] Expected at least one canvas spotlight to maintain dual narrative.');
  }
}
