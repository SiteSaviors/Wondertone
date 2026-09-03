import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('memorial, legal shells, and SPA routing', () => {
  it('registers /memorial as a dedicated route, not the marketing wildcard', () => {
    const main = readRepoFile('src/main.tsx');
    const marketing = readRepoFile('src/routes/MarketingRoutes.tsx');
    expect(main).toContain('path="/memorial/*"');
    expect(main).toContain('MemorialPage');
    expect(marketing).not.toContain('/memorial');
    expect(marketing).toContain("path: '*'");
    expect(marketing).toContain('LandingPage');
  });

  it('keeps privacy and terms as placeholder shells with no legal force', () => {
    const privacy = readRepoFile('src/pages/PrivacyPage.tsx');
    const terms = readRepoFile('src/pages/TermsPage.tsx');
    const shell = readRepoFile('src/pages/LegalPlaceholderPage.tsx');
    expect(shell).toMatch(/not in force/i);
    expect(shell).toMatch(/not legal advice/i);
    expect(privacy).toContain('do not sell photographs');
    expect(privacy).not.toMatch(/stays private always/i);
    expect(privacy).not.toMatch(/@wondertone\./i);
    expect(terms).toContain('revealed artwork');
    expect(terms).toContain('Checkout is not delivery');
  });

  it('keeps /gift unlisted and not sold', () => {
    const gift = readRepoFile('src/pages/GiftPage.tsx');
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    expect(gift).toMatch(/not an offer/i);
    expect(nav).not.toContain("to: '/gift'");
  });

  it('uses memorial copy without prices, ratings, or Living Canvas', () => {
    const memorial = readRepoFile('src/pages/MemorialPage.tsx');
    expect(memorial).toContain('Bring them back in art.');
    expect(memorial).toContain('Upload a photo. Choose a style. See them again. No prompts.');
    expect(memorial).toContain('Upload a photo.');
    expect(memorial).not.toMatch(/\$\d/);
    expect(memorial).not.toMatch(/Living Canvas/);
    expect(memorial).not.toMatch(/★|stars|press/i);
  });

  it('rewrites unknown paths to the SPA on Vercel', () => {
    const vercel = readRepoFile('vercel.json');
    expect(vercel).toContain('destination');
    expect(vercel).toContain('/index.html');
  });
});
