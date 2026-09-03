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
  });
});
