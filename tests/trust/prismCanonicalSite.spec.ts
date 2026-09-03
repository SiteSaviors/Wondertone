import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Prism canonical site completeness', () => {
  it('keeps / as an honest creator home, not memorial', () => {
    const landing = readRepoFile('src/pages/LandingPage.tsx');
    const hero = readRepoFile('src/sections/HeroSection.tsx');
    const memorial = readRepoFile('src/pages/MemorialPage.tsx');

    expect(landing).toContain('HeroSection');
    expect(landing).not.toContain('MemorialPage');
    expect(landing).not.toContain('Bring them back in art.');
    expect(hero).toContain('Turn Your Memories Into Museum Quality Art');
    expect(hero).toContain('text-white');
    expect(hero).not.toContain('bg-clip-text text-transparent');
    expect(hero).toContain('One upload. One style. No prompts.');
    expect(hero).toContain('Upload a photo.');
    expect(hero).toContain('to="/create"');
    expect(hero).not.toContain('Your photo. A style. Art you actually want.');
    expect(hero).not.toContain('Start creating');
    expect(memorial).toContain('Bring them back in art.');
    expect(memorial).not.toContain('Your photo. A style. Art you actually want.');
    expect(memorial).not.toContain('The photo you love, as art.');
    expect(memorial).not.toContain('Turn Your Memories Into Museum Quality Art');
  });

  it('sends homepage style cards into /create with that style selected', () => {
    const showcase = readRepoFile('src/sections/StyleShowcase.tsx');
    expect(showcase).toContain('preselected_style=');
    expect(showcase).toContain('preselectedStyle');
    expect(showcase).toContain('watercolor-dreams');
    expect(showcase).toContain('neon-splash');
    expect(showcase).toContain('classic-oil-painting');
    expect(showcase).not.toContain('<button className="mt-auto');
  });

  it('documents how it works without inventing numbers', () => {
    const steps = readRepoFile('src/sections/StepsJourney.tsx');
    expect(steps).toContain('Upload → Choose a style → See it → Get the file.');
    expect(steps).not.toMatch(/\$\d/);
    expect(steps).not.toMatch(/10,000|4\.9|2\.3M/);
  });

  it('links privacy and terms from the homepage footer and keeps gift unlisted', () => {
    const footer = readRepoFile('src/sections/FooterCTA.tsx');
    const gift = readRepoFile('src/pages/GiftPage.tsx');
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    expect(footer).toContain('to="/privacy"');
    expect(footer).toContain('to="/terms"');
    expect(footer).not.toContain('/pricing');
    expect(gift).toContain('to="/privacy"');
    expect(gift).toContain('to="/terms"');
    expect(nav).not.toContain("to: '/pricing'");
    expect(nav).not.toContain("to: '/gift'");
    const title = readRepoFile('index.html');
    expect(title).toContain('Wondertone | Turn Your Memories Into Museum Quality Art');
    expect(title).not.toContain('Your photo. A style. Art you actually want.');
    expect(title).not.toMatch(/Transform Your Memories|AI-Powered Canvas|Living Canvas/i);
    expect(title).not.toMatch(/\$\d|4\.9|10,000/);
    const pricing = readRepoFile('src/pages/PricingPage.tsx');
    expect(pricing).toContain('Memberships and token packs are not for sale.');
    expect(pricing).toContain('to="/create"');
    expect(pricing).not.toMatch(/parked|tonight/i);
    expect(pricing).toContain('pt-36');
    expect(pricing).not.toMatch(/\$7\.99|\$19\.99|\$49\.99/);
    const account = readRepoFile('src/components/navigation/AccountDropdown.tsx');
    expect(account).toContain('hideSubscriptionTiers');
    expect(account.indexOf('!rules.hideSubscriptionTiers')).toBeLessThan(account.indexOf('Explore plans'));
  });

  it('does not sell canvas in cancelled-checkout copy on /create', () => {
    const studioPage = readRepoFile('src/pages/StudioPage.tsx');
    const cancelledBlock = studioPage.slice(studioPage.indexOf("checkoutStatus === 'cancelled'"));
    expect(cancelledBlock).toContain('Checkout was cancelled.');
    expect(cancelledBlock).toContain('You can try again whenever you’re ready.');
    expect(cancelledBlock.toLowerCase()).not.toContain('canvas');
    expect(cancelledBlock).not.toMatch(/\$\d/);
    expect(studioPage).not.toContain('Adjust your canvas');
  });

  it('hides SUPPORT until a real support inbox exists', () => {
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    const footer = readRepoFile('src/sections/FooterCTA.tsx');
    const steps = readRepoFile('src/sections/StepsJourney.tsx');
    const memorial = readRepoFile('src/pages/MemorialPage.tsx');
    const gift = readRepoFile('src/pages/GiftPage.tsx');

    expect(nav).not.toContain("label: 'SUPPORT'");
    expect(nav).not.toContain('/#support');
    expect(nav).not.toMatch(/mailto:/i);
    expect(footer).not.toMatch(/SUPPORT/i);
    expect(footer).not.toContain('/#support');
    expect(footer).not.toMatch(/mailto:/i);
    expect(steps).not.toContain('id="support"');
    expect(steps).not.toContain('data-founder-anchor="support"');
    expect(memorial).not.toMatch(/SUPPORT/i);
    expect(memorial).not.toContain('/#support');
    expect(gift).not.toMatch(/SUPPORT/i);
    expect(gift).not.toContain('/#support');
  });

  it('makes Alt+T a no-op when token packs are hidden', () => {
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    const handler = nav.slice(nav.indexOf('const handleKeydown'));
    const hideGuard = handler.slice(handler.indexOf('if (rules.hideTokenPacks)'));
    expect(handler).toContain("event.key.toLowerCase() === 't'");
    expect(hideGuard).toMatch(/if \(rules\.hideTokenPacks\) \{\s*return;/);
    expect(hideGuard.indexOf('return;')).toBeLessThan(hideGuard.indexOf('setTokenDrawerOpen(true)'));
    expect(hideGuard.indexOf('preventDefault')).toBeGreaterThan(hideGuard.indexOf('return;'));
  });

  it('hides Living Canvas and Orders API coming soon on the first path', () => {
    const surface = readRepoFile('src/config/productSurface.ts');
    const actionGrid = readRepoFile('src/components/studio/ActionGrid.tsx');
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    const orders = readRepoFile('src/components/navigation/OrdersPopover.tsx');
    const breadth = readRepoFile('src/sections/studio/InstantBreadthStrip.tsx');

    expect(surface).toMatch(/hideLivingCanvas:\s*true/);
    expect(surface).toMatch(/hideCanvasRail:\s*false/);
    expect(surface).not.toMatch(/hideTokenPacks:\s*false/);
    expect(surface).not.toMatch(/hideSubscriptionTiers:\s*false/);
    expect(surface).not.toMatch(/hideSocialProof:\s*false/);
    expect(actionGrid).toContain('revealed_artwork_full_res');
    expect(actionGrid).not.toContain('Create Canvas Art');
    const overlays = readRepoFile('src/sections/studio/experience/StudioOverlays.tsx');
    const studioPage = readRepoFile('src/pages/StudioPage.tsx');
    const experience = readRepoFile('src/sections/studio/experience/StudioExperience.tsx');
    expect(experience).toContain('RightRail');
    expect(experience).toContain('!rules.hideCanvasRail');
    expect(overlays).not.toContain('CanvasCheckoutModal');
    expect(overlays).not.toContain('CanvasUpsellToast');
    expect(studioPage).not.toContain('CanvasQualityStrip');
    expect(nav).not.toContain('OrdersPopover');
    expect(orders).not.toMatch(/Orders API coming soon/i);
    expect(breadth).not.toContain('/pricing');
    expect(breadth).not.toContain('from-amber-400 via-yellow-500 to-amber-400');
    expect(breadth).toContain('onUnavailable');
    expect(breadth).not.toContain('Preview is display-only');
    expect(breadth).not.toContain('Upgrade to Creator');
    expect(breadth).not.toContain('print on museum-quality canvas');
    expect(breadth).not.toContain('Prints ship ready to hang');
    expect(breadth).not.toContain('50+');
    const createHero = readRepoFile('src/sections/ProductHeroSection.tsx');
    expect(createHero).toContain('Turn Your Memories Into Museum Quality Art');
    expect(createHero).not.toContain('bg-clip-text text-transparent');
    expect(createHero).toContain('animateGeneration={false}');
    expect(createHero).not.toContain('Your photo. A style.');
    expect(createHero).not.toContain('Art you actually want.');
    expect(createHero).not.toContain('40+');
    expect(createHero).not.toContain('in seconds');
    expect(createHero).not.toContain('AnimatedTransformBadge');
    expect(createHero).not.toContain('Create Your Masterpiece');
  });

  it('removes empty-studio stats, masterpiece CTAs, and style-rail sales copy', () => {
    const cta = readRepoFile('src/components/hero/CTADeck.tsx');
    const animation = readRepoFile('src/components/hero/GeneratingCanvasAnimation.tsx');
    const uploader = readRepoFile('src/components/launchpad/PhotoUploader.tsx');
    const launchpad = readRepoFile('src/sections/LaunchpadLayout.tsx');
    const tones = readRepoFile('src/config/styleCatalog.ts');
    const toneSection = readRepoFile('src/sections/studio/components/ToneSection.tsx');
    const styleCard = readRepoFile('src/sections/studio/components/ToneStyleCard.tsx');
    const empty = readRepoFile('src/sections/studio/components/StudioEmptyState.tsx');
    const preview = readRepoFile('src/sections/studio/components/CanvasPreviewPanel.tsx');

    expect(cta).toContain('Upload a photo.');
    expect(cta).not.toContain('Create Your Masterpiece');
    expect(cta).not.toContain('Watch 60s demo');
    expect(animation).not.toContain('2.3s');
    expect(animation).not.toContain('Ready in');
    expect(uploader).not.toContain('Start Your Masterpiece');
    expect(uploader).not.toContain('in seconds');
    expect(uploader).not.toContain('Instant previews');
    expect(launchpad).not.toContain('studio assistants');
    expect(launchpad).not.toContain('two minutes');
    expect(tones).not.toContain('Most-loved styles from our Community');
    expect(toneSection).not.toMatch(/>Hot</);
    expect(styleCard).toContain('hideSubscriptionTiers');
    expect(styleCard.indexOf('!rules.hideSubscriptionTiers')).toBeLessThan(
      styleCard.indexOf('Unlock with {gate.requiredTier.toUpperCase()} plan')
    );
    expect(empty).toContain('hideStockLibrary');
    expect(empty).not.toContain('Bring them back in art.');
    expect(empty).not.toContain('Upload Any Photo Into Wondertone Studio');
    expect(launchpad).toContain('Boolean(croppedImage)');
    expect(styleCard).toContain('onError={() => setThumbnailMissing(true)}');
    expect(preview).toContain("previewStateStatus === 'ready' && currentStyle");
    expect(preview.indexOf("previewStateStatus === 'ready' && currentStyle")).toBeLessThan(
      preview.indexOf('<ActionGrid')
    );
  });
});
