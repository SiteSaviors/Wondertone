/**
 * InspirationBucket Component
 *
 * Container for a curated collection of style cards (6 cards initially, scalable to 12).
 * Orchestrates card layout, theming, and animations for each bucket.
 *
 * Performance optimizations:
 * - React.memo() prevents re-renders when sibling buckets update
 * - GPU-accelerated animations (transform, opacity)
 * - Staggered entrance timing creates elegant reveal (0.15s per bucket)
 *
 * Visual design:
 * - Frosted glass container (bg-white/[0.02] backdrop-blur-sm)
 * - Dynamic accent color theming per bucket
 * - Icon + title + description header
 * - 2×3 card grid (6 cards, wraps to 2×6 when scaling to 12)
 *
 * Animation timing:
 * - Bucket 0 (Social): Enters at T+0.0s
 * - Bucket 1 (Print): Enters at T+0.15s
 * - Bucket 2 (Fun): Enters at T+0.30s
 * - Total section animation: ~1.2s (elegant, not rushed)
 *
 * @see src/sections/studio/StyleInspirationSection.tsx (parent)
 * @see src/sections/studio/components/InspirationCard.tsx (child)
 * @see src/config/inspirationBuckets.ts (configuration)
 */

import { memo, type CSSProperties } from 'react';
import { Heart, Award, Palette } from 'lucide-react';
import InspirationCard from './InspirationCard';
import type { StyleOption } from '@/store/founder/storeTypes';

type InspirationBucketProps = {
  /** Bucket identifier */
  id: string;
  /** Bucket display title */
  title: string;
  /** Bucket description (1 sentence) */
  description: string;
  /** Icon type (heart, award, palette) */
  icon: 'heart' | 'award' | 'palette';
  /** Hex color for accent theming */
  accentColor: string;
  /** Filtered style data for this bucket */
  styles: StyleOption[];
  /** Bucket index (0-2) for stagger delay calculation */
  index: number;
  /** Disable animations if user prefers reduced motion */
  prefersReducedMotion?: boolean;
  /** Whether the parent section is ready to reveal (intersection). */
  revealReady?: boolean;
  onThumbnailUnavailable?: (styleId: string) => void;
};

/**
 * Icon component mapper
 *
 * Converts string icon name to lucide-react component.
 * Extracted as helper function to keep JSX clean.
 *
 * @param icon - Icon identifier from bucket config
 * @param className - Tailwind classes for icon sizing/styling
 * @returns JSX element for the appropriate icon
 */
const getIconComponent = (icon: string, className: string) => {
  switch (icon) {
    case 'heart':
      return <Heart className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'palette':
      return <Palette className={className} />;
    default:
      return null;
  }
};

const InspirationBucket = ({
  id,
  title,
  description,
  icon,
  accentColor,
  styles,
  index,
  prefersReducedMotion,
  revealReady = true,
  onThumbnailUnavailable,
}: InspirationBucketProps) => {
  const bucketStyle = { '--bucket-index': index } as CSSProperties;

  return (
    <div
      className="inspiration-bucket group relative rounded-3xl bg-white/[0.02] backdrop-blur-sm border border-white/10 p-6 hover:border-white/20 transition-all duration-500"
      data-reveal-ready={revealReady ? 'true' : 'false'}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-bucket-id={id}
      style={bucketStyle}
    >
      {/* Accent glow on hover (uses bucket-specific accent color) */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-3xl"
        style={{
          background: `linear-gradient(to bottom, ${accentColor}10, transparent)`,
        }}
      />

      {/* Header: Icon + Title + Description */}
      <div className="relative flex items-center gap-3 mb-6">
        {/* Icon container with accent color background */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          {getIconComponent(icon, 'w-5 h-5')}
        </div>

        {/* Title + Description */}
        <div className="min-w-0">
          <h3 className="font-semibold text-xl text-white truncate">
            {title}
          </h3>
          <p className="text-sm text-white/60 truncate">
            {description}
          </p>
        </div>
      </div>

      {/* Cards Grid (3 columns, 12 cards) */}
      <div className="relative grid grid-cols-3 gap-3">
        {styles.map((style, cardIndex) => (
          <InspirationCard
            key={style.id}
            style={style}
            cardIndex={cardIndex}
            prefersReducedMotion={prefersReducedMotion}
            revealReady={revealReady}
            onThumbnailUnavailable={onThumbnailUnavailable}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * CRITICAL: React.memo prevents unnecessary re-renders
 *
 * Without memo: When any bucket updates, all 3 buckets re-render
 * With memo: Only the changed bucket re-renders (2 avoided re-renders)
 *
 * Combined with memoized cards: Prevents cascade of 18 card re-renders
 */
export default memo(InspirationBucket);
