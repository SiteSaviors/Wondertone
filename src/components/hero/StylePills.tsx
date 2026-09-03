import { useState } from 'react';
import { clsx } from 'clsx';
import { useStyleCatalogActions } from '@/store/hooks/useStyleCatalogStore';

type StylePill = {
  id: string;
  name: string;
  tagline: string;
  thumbnail: string;
  previewImage: string;
  originalImage?: string;
};

type StylePillsProps = {
  pills: StylePill[];
  onStyleChange?: (styleId: string, previewImage: string, originalImage?: string) => void;
  className?: string;
};

const buildButtonClass = (isActive: boolean) =>
  clsx(
    'relative flex items-center rounded-full transition-all duration-300 transform',
    isActive
      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30 scale-105'
      : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:border-white/30 hover:text-white hover:scale-[1.02] active:scale-95'
  );

const buildAvatarClass = (isActive: boolean, base: string) =>
  clsx(
    base,
    'rounded-full overflow-hidden border-2 transition-colors flex-shrink-0',
    isActive ? 'border-white/50' : 'border-white/20'
  );

const StylePills = ({ pills, onStyleChange, className = '' }: StylePillsProps) => {
  const [activeStyleId, setActiveStyleId] = useState(pills[0]?.id || '');
  const { setPreselectedStyle } = useStyleCatalogActions();

  const handlePillClick = (pill: StylePill) => {
    setActiveStyleId(pill.id);
    setPreselectedStyle(pill.id);
    onStyleChange?.(pill.id, pill.previewImage, pill.originalImage);
  };

  const handleKeyDown = (event: React.KeyboardEvent, pill: StylePill) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePillClick(pill);
    }
  };

  const renderPill = (pill: StylePill, size: 'sm' | 'lg') => {
    const isActive = activeStyleId === pill.id;
    const avatarSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const textNameClass = size === 'sm' ? 'text-xs' : 'text-sm';
    const textTaglineClass = size === 'sm' ? 'text-[10px]' : 'text-xs';

    return (
      <button
        key={pill.id}
        type="button"
        onClick={() => handlePillClick(pill)}
        onKeyDown={(event) => handleKeyDown(event, pill)}
        className={clsx(
          buildButtonClass(isActive),
          size === 'sm' ? 'gap-2 px-3 py-2.5' : 'gap-3 px-4 py-3'
        )}
        aria-pressed={isActive}
        aria-label={`Switch to ${pill.name} style`}
      >
        <div className={buildAvatarClass(isActive, avatarSize)}>
          <img src={pill.thumbnail} alt={pill.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col items-start text-left min-w-0 flex-1">
          <span
            className={clsx(
              textNameClass,
              'font-semibold truncate w-full',
              isActive ? 'text-white' : 'text-white/90'
            )}
          >
            {pill.name}
          </span>
          <span
            className={clsx(
              textTaglineClass,
              'truncate w-full',
              isActive ? 'text-white/80' : 'text-white/60'
            )}
          >
            {pill.tagline}
          </span>
        </div>
        <span
          className={clsx(
            'absolute inset-0 rounded-full border-2 border-white/30 pointer-events-none transition-opacity duration-300',
            isActive ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        />
      </button>
    );
  };

  return (
    <div className={className}>
      {/* Mobile: Stacked Layout */}
      <div className="md:hidden flex flex-col items-center gap-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 px-4 max-w-xl mx-auto w-full">
          {pills.map((pill) => renderPill(pill, 'sm'))}
        </div>
        <div className="text-center px-4">
          <span className="text-lg font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]">
            Explore styles →
          </span>
        </div>
      </div>

      {/* Desktop: Grid with Text on Right */}
      <div className="hidden md:block px-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-4 gap-3 mb-3">
          {pills.slice(0, 4).map((pill) => renderPill(pill, 'lg'))}
        </div>
        <div className="grid grid-cols-4 gap-3 items-center">
          {pills.slice(4, 6).map((pill) => renderPill(pill, 'lg'))}
          <div className="col-span-2 flex items-center justify-center">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(168,85,247,0.5)]">
              Explore styles →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StylePills;
