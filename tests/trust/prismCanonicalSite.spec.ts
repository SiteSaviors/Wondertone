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
    expect(hero).toContain('Your photo. A style. Art you actually want.');
    expect(hero).toContain('Upload a picture. Pick a look. No prompts.');
    expect(hero).toContain('Start creating');
    expect(hero).toContain('to="/create"');
    expect(memorial).toContain('Bring them back in art.');
    expect(memorial).not.toContain('Your photo. A style. Art you actually want.');
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
    expect(surface).not.toMatch(/hideCanvasRail:\s*false/);
    expect(surface).not.toMatch(/hideTokenPacks:\s*false/);
    expect(surface).not.toMatch(/hideSubscriptionTiers:\s*false/);
    expect(surface).not.toMatch(/hideSocialProof:\s*false/);
    expect(actionGrid).toContain('revealed_artwork_full_res');
    expect(actionGrid).not.toContain('Create Canvas Art');
    expect(nav).not.toContain('OrdersPopover');
    expect(orders).not.toMatch(/Orders API coming soon/i);
    expect(breadth).not.toContain('/pricing');
    expect(breadth).not.toContain('Upgrade to Creator');
    expect(breadth).not.toContain('print on museum-quality canvas');
    expect(breadth).not.toContain('Prints ship ready to hang');
    expect(breadth).not.toContain('50+');
    const createHero = readRepoFile('src/sections/ProductHeroSection.tsx');
    expect(createHero).toContain('Your photo. A style.');
    expect(createHero).not.toContain('40+');
    expect(createHero).not.toContain('in seconds');
  });
});
