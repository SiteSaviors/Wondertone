import { describe, it, expect } from 'vitest';
import type { StyleOption } from '@/store/useFounderStore';
import { getNarrative, getPalette, getComplementaryStyles, getShareCaption } from '@/utils/storyLayer/copy';

const mockStyle = (overrides: Partial<StyleOption>): StyleOption => ({
  id: 'mock-style',
  name: 'Mock Style',
  description: '',
  thumbnail: '',
  preview: '',
  priceModifier: 0,
  thumbnailWebp: null,
  thumbnailAvif: null,
  previewWebp: null,
  previewAvif: null,
  tone: 'modern',
  tier: 'free',
  isPremium: false,
  defaultUnlocked: true,
  marketingCopy: null,
  badges: [],
  requiredTier: undefined,
  ...overrides,
});

describe('storyLayer copy helpers', () => {
  it('returns bespoke narrative when defined', async () => {
    const narrative = await getNarrative(
      mockStyle({ id: 'classic-oil-painting', tone: 'classic', name: 'Classic Oil Painting' })
    );
    expect(narrative.headline).toContain('Classic Oil');
  });

  it('falls back to tone narrative when bespoke missing', async () => {
    const narrative = await getNarrative(mockStyle({ tone: 'modern', name: 'Modern Edge' }));
    expect(narrative.headline).toContain('Modern Edge');
    expect(narrative.paragraph).toContain('graphic clarity');
  });

  it('returns bespoke palette when available', async () => {
    const palette = await getPalette(mockStyle({ id: 'neon-splash', tone: 'electric' }));
    expect(palette[0].label).toBe('UV Magenta');
  });

  it('falls back to tone palette when bespoke missing', async () => {
    const palette = await getPalette(mockStyle({ tone: 'stylized' }));
    expect(palette).toHaveLength(3);
    expect(palette[0].label).toBe('Storybook Fuchsia');
  });

  it('returns bespoke complementary mapping', async () => {
    const comp = await getComplementaryStyles(mockStyle({ id: 'pastel-bliss', tone: 'classic' }));
    expect(comp.premium).toBe('calm-watercolor');
    expect(comp.fallback).toBe('classic-crayon');
  });

  it('returns tone complementary when bespoke missing', async () => {
    const comp = await getComplementaryStyles(mockStyle({ tone: 'electric' }));
    expect(comp.fallback).toBe('neon-splash');
  });

  it('builds share caption with tone hook and tier tag', () => {
    const caption = getShareCaption({ tone: 'signature', styleName: 'Sanctuary Glow', tier: 'creator' });
    expect(caption).toContain('Stained-glass glow');
    expect(caption).toContain('Wondertone’s Sanctuary Glow');
    expect(caption).toContain('Creator Member');
  });

  it('falls back to classic share copy when tone missing', () => {
    const caption = getShareCaption({ tone: null, styleName: 'Mystery Style', tier: 'free' });
    expect(caption).toContain('Timeless strokes');
    expect(caption).toContain('Free Preview');
  });
});
