import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Forge tablet creation layout', () => {
  it('keeps the 390px style rail at lg and moves the tablet chip off the center CTA', () => {
    const sidebar = readRepoFile('src/sections/studio/components/StyleSidebar.tsx');
    const rail = readRepoFile('src/sections/studio/experience/LeftRail.tsx');
    const center = readRepoFile('src/sections/studio/experience/CenterStage.tsx');
    const experience = readRepoFile('src/sections/studio/experience/StudioExperience.tsx');

    expect(sidebar).toContain('hidden lg:block lg:w-[390px]');
    expect(rail).toContain('data-studio-tablet-styles');
    expect(rail).toContain('md:bottom-auto md:left-4 md:top-24 md:translate-x-0');
    expect(rail).toContain('lg:hidden');
    expect(center).toContain('data-studio-center');
    expect(center).toContain('min-w-0 w-full');
    expect(experience).toContain('overflow-x-hidden lg:flex');
  });

  it('opens the style drawer as a side panel at tablet widths', () => {
    const drawer = readRepoFile('src/components/studio/MobileStyleDrawer.tsx');
    const css = readRepoFile('src/components/studio/MobileStyleDrawer.css');
    expect(drawer).toContain('data-studio-tablet-drawer');
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('width: min(360px, 42vw)');
    expect(css).toContain('transform: translateX(-100%)');
  });
});
