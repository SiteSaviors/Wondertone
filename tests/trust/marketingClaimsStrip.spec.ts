import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const KILL_LIST = [
  /10,000\+\s+canvases delivered/i,
  /4\.9★/,
  /Living Canvas AR included/i,
  /tens of thousands of families/i,
  /30-second video on every print/i,
  /QR Ready/,
  /Sofia/,
  /TechCrunch/,
  /Wired/,
  /2,341 reviews/,
  /2\.3M\+/,
  /96% recommend/i,
  /12K canvases shipped/i,
  /stays private always/i,
  /stays private—always/i,
  /Living Canvas engine/i,
  /48h Living Canvas/i,
  /Ships in 5 days/i,
  /Ships in 3-5 days/i,
  /Ships in 3–5/i,
  /ship within 3–4/i,
  /Your photo\. A style\. Art you actually want/i,
];

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
};

describe('marketing claims strip', () => {
  it('removes the kill-list claims from live homepage, pricing, and related surfaces', () => {
    const files = collectSourceFiles(SRC_ROOT).filter((file) => {
      const relative = path.relative(SRC_ROOT, file);
      return !relative.startsWith('store/useFounderStore.ts');
    });

    const hits: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      for (const pattern of KILL_LIST) {
        if (pattern.test(contents)) {
          hits.push(`${path.relative(process.cwd(), file)} matches ${pattern}`);
        }
      }
    }

    expect(hits).toEqual([]);
  });

  it('does not advertise Living Canvas on homepage or pricing', () => {
    const landing = readFileSync(path.join(SRC_ROOT, 'pages/LandingPage.tsx'), 'utf8');
    const hero = readFileSync(path.join(SRC_ROOT, 'sections/HeroSection.tsx'), 'utf8');
    const pricing = readFileSync(path.join(SRC_ROOT, 'pages/PricingPage.tsx'), 'utf8');
    const tiers = readFileSync(path.join(SRC_ROOT, 'data/subscriptionTiers.ts'), 'utf8');
    const benefits = readFileSync(path.join(SRC_ROOT, 'components/ui/PricingBenefitsStrip.tsx'), 'utf8');

    expect(landing).not.toContain('LivingCanvasStory');
    expect(hero).not.toMatch(/Living Canvas/i);
    expect(pricing).not.toMatch(/Living Canvas/i);
    expect(tiers).not.toMatch(/Living Canvas/i);
    expect(benefits).not.toMatch(/Living Canvas/i);
  });

  it('does not ship invented spotlight quotes', () => {
    const social = readFileSync(path.join(SRC_ROOT, 'config/socialProofContent.ts'), 'utf8');
    expect(social).toMatch(/export const SPOTLIGHTS: ReadonlyArray<SpotlightStory> = \[\];/);
    expect(social).not.toContain('premium polish overnight');
    expect(social).not.toContain('Sarah M.');
    expect(social).not.toContain('We cried seeing');
  });
});
