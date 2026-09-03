import { useEffect, useState } from 'react';
import Section from '@/components/layout/Section';
import { useLaunchpadActions, useLaunchpadState } from '@/store/hooks/useLaunchpadStore';
import { trackLaunchflowOpened } from '@/utils/launchflowTelemetry';
import GeneratingCanvasAnimation from '@/components/hero/GeneratingCanvasAnimation';
import StylePills from '@/components/hero/StylePills';
import CTADeck from '@/components/hero/CTADeck';
import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion';
import './ProductHeroSection.css';

const DEFAULT_ORIGINAL_IMAGE = '/art-style-hero-generations/family-original.jpg';

// Style pills data
type HeroStyleView = {
  id: string;
  name: string;
  tagline: string;
  previewImage: string;
  originalImage: string;
};

const STYLE_PILLS = [
  {
    id: 'watercolor-dreams',
    name: 'Watercolor',
    tagline: 'Soft washes & light',
    thumbnail: '/art-style-hero-generations/watercolor-origin.jpg',
    originalImage: '/art-style-hero-generations/watercolor-origin.jpg',
    previewImage: '/art-style-hero-generations/watercolor-generated.jpg',
  },
  {
    id: 'classic-oil-painting',
    name: 'Classic Oil',
    tagline: 'Traditional brushstrokes',
    thumbnail: '/art-style-hero-generations/family-classic-oil.jpg',
    originalImage: DEFAULT_ORIGINAL_IMAGE,
    previewImage: '/art-style-hero-generations/family-classic-oil.jpg',
  },
  {
    id: 'neon-splash',
    name: 'Neon Splash',
    tagline: 'Electric drip energy',
    thumbnail: '/art-style-hero-generations/family-neon-splash.jpg',
    originalImage: DEFAULT_ORIGINAL_IMAGE,
    previewImage: '/art-style-hero-generations/family-neon-splash.jpg',
  },
  {
    id: 'pop-art-burst',
    name: 'Pop Art Burst',
    tagline: 'Bold comic vibes',
    thumbnail: '/art-style-hero-generations/family-pop-art.jpg',
    originalImage: DEFAULT_ORIGINAL_IMAGE,
    previewImage: '/art-style-hero-generations/family-pop-art.jpg',
  },
  {
    id: '3d-storybook',
    name: '3D Storybook',
    tagline: 'Playful depth & charm',
    thumbnail: '/art-style-hero-generations/family-storybook.jpg',
    originalImage: DEFAULT_ORIGINAL_IMAGE,
    previewImage: '/art-style-hero-generations/family-storybook.jpg',
  },
  {
    id: 'artisan-charcoal',
    name: 'Artisan Charcoal',
    tagline: 'Raw sketch texture',
    thumbnail: '/art-style-hero-generations/family-charcoal.jpg',
    originalImage: DEFAULT_ORIGINAL_IMAGE,
    previewImage: '/art-style-hero-generations/family-charcoal.jpg',
  },
];

const INITIAL_CANVAS_STATE: HeroStyleView = {
  id: STYLE_PILLS[0].id,
  name: STYLE_PILLS[0].name,
  tagline: STYLE_PILLS[0].tagline,
  previewImage: STYLE_PILLS[0].previewImage,
  originalImage: STYLE_PILLS[0].originalImage ?? DEFAULT_ORIGINAL_IMAGE,
};

const ProductHeroSection = () => {
  const { setLaunchpadExpanded } = useLaunchpadActions();
  const { launchpadExpanded } = useLaunchpadState();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [currentCanvas, setCurrentCanvas] = useState<HeroStyleView>(INITIAL_CANVAS_STATE);
  const [previousCanvas, setPreviousCanvas] = useState<HeroStyleView | null>(null);

  const handleHeroUploadClick = () => {
    if (!launchpadExpanded) {
      trackLaunchflowOpened('hero');
    }
    setLaunchpadExpanded(true);

    const launchflowSection = document.getElementById('launchflow');
    if (launchflowSection) {
      launchflowSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStyleChange = (styleId: string, previewImage: string, originalImage?: string) => {
    const selectedStyle = STYLE_PILLS.find(pill => pill.id === styleId);
    if (!selectedStyle) {
      return;
    }
    const nextCanvas: HeroStyleView = {
      id: selectedStyle.id,
      name: selectedStyle.name,
      tagline: selectedStyle.tagline,
      previewImage,
      originalImage: originalImage ?? selectedStyle.originalImage ?? DEFAULT_ORIGINAL_IMAGE,
    };

    if (nextCanvas.id === currentCanvas.id) {
      setCurrentCanvas(nextCanvas);
      return;
    }

    if (!prefersReducedMotion) {
      setPreviousCanvas(currentCanvas);
    } else {
      setPreviousCanvas(null);
    }
    setCurrentCanvas(nextCanvas);
  };

  useEffect(() => {
    if (!previousCanvas) {
      return;
    }
    if (prefersReducedMotion) {
      setPreviousCanvas(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      setPreviousCanvas(null);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [previousCanvas, prefersReducedMotion]);

  return (
    <section
      className="relative overflow-hidden bg-gradient-hero"
      data-founder-hero
      id="founder-hero"
    >
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/nice-snow.png')]" />

      <Section className="relative pt-32 pb-20">
        <div className="mx-auto max-w-6xl space-y-6">

          <div className="text-center text-white max-w-5xl mx-auto px-4">
            <div className="space-y-4">
              <h1 className="font-poppins text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.15] tracking-[-0.04em] drop-shadow-2xl">
                Your photo. A style.{' '}
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Art you actually want.
                </span>
              </h1>
              <p className="font-poppins text-base sm:text-lg md:text-xl text-white">
                Upload a picture. Pick a look. No prompts.
              </p>
            </div>
          </div>

          {/* CTA Deck */}
          <CTADeck onUploadClick={handleHeroUploadClick} />

          {/* Hero Canvas Panel with Generation Animation */}
          <div className="max-w-4xl mx-auto">
            <div
              className="hero-canvas-stack"
              data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
              data-has-previous={!prefersReducedMotion && previousCanvas ? 'true' : 'false'}
            >
              {!prefersReducedMotion && previousCanvas ? (
                <div className="hero-canvas-layer hero-canvas-layer--previous" aria-hidden="true">
                  <GeneratingCanvasAnimation
                    key={`prev-${previousCanvas.id}`}
                    defaultStyleImage={previousCanvas.previewImage}
                    originalImage={previousCanvas.originalImage}
                    styleName={previousCanvas.name}
                    styleTagline={previousCanvas.tagline}
                    generationDuration={2500}
                  />
                </div>
              ) : null}
              <div className="hero-canvas-layer hero-canvas-layer--current">
                <GeneratingCanvasAnimation
                  key={`current-${currentCanvas.id}`}
                  defaultStyleImage={currentCanvas.previewImage}
                  originalImage={currentCanvas.originalImage}
                  styleName={currentCanvas.name}
                  styleTagline={currentCanvas.tagline}
                  generationDuration={2500}
                />
              </div>
            </div>
          </div>

          {/* Style Pills */}
          <StylePills
            pills={STYLE_PILLS}
            onStyleChange={handleStyleChange}
          />

        </div>
      </Section>
    </section>
  );
};

export default ProductHeroSection;
