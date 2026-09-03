import type {
  StyleRegistryEntry,
  StyleTone,
  StyleTier,
  StyleToneDefinition,
  StyleStoryContent,
} from './styles/types';

// Lazy-loading facade for async operations
import {
  loadStyleById as loadRegistryStyleById,
  loadToneStyles as loadRegistryToneStyles,
  STYLE_CORE_METADATA,
  type ToneKey,
} from './styles/registryLazy';

export type { StyleRegistryEntry, StyleTone, StyleTier } from './styles/types';

/**
 * @deprecated STYLE_REGISTRY, STYLE_REGISTRY_BY_ID, and STYLE_REGISTRY_BY_NUMERIC_ID
 * have been removed to reduce bundle size. Use lazy loading functions instead:
 * - loadStyleById() for single style lookup
 * - loadToneStyles() for loading all styles in a tone
 * - STYLE_CORE_METADATA for basic metadata (id, name, tone, tier)
 */

export type StyleCatalogEntry = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  thumbnailWebp?: string | null;
  thumbnailAvif?: string | null;
  preview: string;
  previewWebp?: string | null;
  previewAvif?: string | null;
  priceModifier: number;
  tone: StyleTone;
  tier: StyleTier;
  isPremium: boolean;
  badges?: string[];
  defaultUnlocked: boolean;
  marketingCopy?: string | null;
  requiredTier?: 'creator' | 'plus' | 'pro';
  story?: StyleStoryContent;
};

export type StyleOptionSnapshot = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  thumbnailWebp?: string | null;
  thumbnailAvif?: string | null;
  preview: string;
  previewWebp?: string | null;
  previewAvif?: string | null;
  priceModifier: number;
};

const FALLBACK_TONE_FOR_ORIGINAL: StyleTone = 'classic';

const toCatalogEntry = (style: StyleRegistryEntry): StyleCatalogEntry => {
  const badges = style.badges.length > 0 ? style.badges : undefined;
  return {
    id: style.id,
    name: style.name,
    description: style.description,
    thumbnail: style.assets.thumbnail,
    thumbnailWebp: style.assets.thumbnailWebp ?? null,
    thumbnailAvif: style.assets.thumbnailAvif ?? null,
    preview: style.assets.preview,
    previewWebp: style.assets.previewWebp ?? null,
    previewAvif: style.assets.previewAvif ?? null,
    priceModifier: style.priceModifier,
    tone: style.tone ?? FALLBACK_TONE_FOR_ORIGINAL,
    tier: style.tier,
    isPremium: style.isPremium,
    badges,
    defaultUnlocked: style.defaultUnlocked,
    marketingCopy: style.marketingCopy ?? null,
    requiredTier: style.requiredTier,
    story: style.story ?? null,
  };
};

/**
 * @deprecated STYLE_CATALOG has been removed to reduce bundle size.
 * Use lazy loading functions instead:
 * - loadStyleCatalogEntry() for single style
 * - loadToneCatalog() for all styles in a tone
 * - STYLE_CORE_METADATA for basic metadata
 */

/**
 * @deprecated Use loadInitialStylesLazy() for lazy loading.
 * This function loads the full 60 KB registry eagerly.
 * Kept for backward compatibility during migration.
 *
 * Will be removed in v2.0.
 */
// Function removed - use loadInitialStylesLazy() instead

export const STYLE_TONE_DEFINITIONS: Record<StyleTone, StyleToneDefinition> = {
  trending: {
    id: 'trending',
    label: 'Trending Styles',
    description: 'A starting set of styles.',
    icon: '📈',
    sortOrder: 10,
  },
  classic: {
    id: 'classic',
    label: 'Classic Styles',
    description: 'Timeless treatments that never go out of style.',
    icon: '🎨',
    sortOrder: 20,
  },
  modern: {
    id: 'modern',
    label: 'Modern Styles',
    description: 'Fresh looks for contemporary art lovers.',
    icon: '✨',
    sortOrder: 30,
  },
  stylized: {
    id: 'stylized',
    label: 'Stylized Art',
    description: 'Statement-making looks for bold storytellers.',
    icon: '🎭',
    sortOrder: 40,
  },
  abstract: {
    id: 'abstract',
    label: 'Abstract Styles',
    description: 'Geometry, pattern, and non-literal color.',
    icon: '🔷',
    sortOrder: 45,
  },
  electric: {
    id: 'electric',
    label: 'Neon Glitch Styles',
    description: 'High-voltage and glitch-inspired treatments.',
    icon: '⚡',
    sortOrder: 50,
  },
  signature: {
    id: 'signature',
    label: 'Signature Styles',
    description: 'Premium exclusives from the Wondertone Studio.',
    icon: '⭐',
    sortOrder: 60,
    requiredTier: 'creator',
  },
  experimental: {
    id: 'experimental',
    label: 'Experimental Labs',
    description: 'Total transformations created by Wondertone AI.',
    icon: '🧪',
    sortOrder: 70,
    requiredTier: 'creator',
  },
};

export const STYLE_TONES_IN_ORDER: StyleTone[] = Object.values(STYLE_TONE_DEFINITIONS)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((definition) => definition.id);

// ============================================================================
// NEW: Lazy-Loading API (Phase 3)
// ============================================================================

/**
 * Load initial styles with minimal data for store initialization.
 * Uses core metadata only (~1 KB) instead of full registry (~60 KB).
 *
 * This is the NEW recommended approach for store initialization.
 * Full style details are loaded on-demand via loadStyleCatalogEntry().
 *
 * @returns Array of style options with IDs and names only
 *
 * @example
 * ```typescript
 * // In store initialization
 * const initialStyles = loadInitialStylesLazy();
 * // Styles have IDs/names, full details loaded on-demand
 * ```
 */
export const loadInitialStylesLazy = (): StyleOptionSnapshot[] => {
  return STYLE_CORE_METADATA.map(meta => ({
    id: meta.id,
    name: meta.name,
    description: meta.description, // Loaded from core metadata for initial render
    thumbnail: meta.thumbnail, // Loaded from core metadata for initial render
    thumbnailWebp: meta.thumbnailWebp,
    thumbnailAvif: meta.thumbnailAvif,
    preview: '', // Loaded on-demand via loadStyleCatalogEntry
    previewWebp: null,
    previewAvif: null,
    priceModifier: 0, // Loaded on-demand
  }));
};

/**
 * Load a single style catalog entry on-demand.
 * Automatically detects tone and loads from appropriate tone file.
 *
 * This is the NEW recommended approach for loading full style details.
 * Use this when you need complete style data (thumbnails, descriptions, etc.).
 *
 * @param styleId - The style ID
 * @returns Promise resolving to catalog entry or undefined
 *
 * @example
 * ```typescript
 * // When style is selected or needs to be displayed
 * const style = await loadStyleCatalogEntry('classic-oil-painting');
 * if (style) {
 *   console.log(style.name, style.description, style.thumbnail);
 * }
 * ```
 */
export async function loadStyleCatalogEntry(
  styleId: string
): Promise<StyleCatalogEntry | undefined> {
  const registryEntry = await loadRegistryStyleById(styleId);
  if (!registryEntry) {
    return undefined;
  }
  return toCatalogEntry(registryEntry);
}

/**
 * Load all catalog entries for a specific tone.
 * Used when a tone accordion expands and you need all styles in that tone.
 *
 * @param tone - The tone to load
 * @returns Promise resolving to array of catalog entries
 *
 * @example
 * ```typescript
 * // When Classic tone accordion expands
 * const classicStyles = await loadToneCatalog('classic');
 * // All 6 classic styles now have full details
 * ```
 */
export async function loadToneCatalog(
  tone: ToneKey
): Promise<StyleCatalogEntry[]> {
  const registryEntries = await loadRegistryToneStyles(tone);
  return registryEntries.map(toCatalogEntry);
}

/**
 * Convert a StyleOptionSnapshot (minimal data) to a full StyleCatalogEntry.
 * Helper function for store migrations.
 *
 * @param snapshot - Minimal style snapshot
 * @param fullEntry - Full catalog entry from lazy load
 * @returns Merged style option with full details
 */
export function mergeStyleSnapshot(
  snapshot: StyleOptionSnapshot,
  fullEntry: StyleCatalogEntry
): StyleOptionSnapshot {
  return {
    id: snapshot.id,
    name: fullEntry.name,
    description: fullEntry.description,
    thumbnail: fullEntry.thumbnail,
    thumbnailWebp: fullEntry.thumbnailWebp,
    thumbnailAvif: fullEntry.thumbnailAvif,
    preview: fullEntry.preview,
    previewWebp: fullEntry.previewWebp,
    previewAvif: fullEntry.previewAvif,
    priceModifier: fullEntry.priceModifier,
  };
}
