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

  it('registers dedicated gift, privacy, and terms routes instead of the landing wildcard', () => {
    const marketing = readRepoFile('src/routes/MarketingRoutes.tsx');
    expect(marketing).toContain("path: '/privacy'");
    expect(marketing).toContain('PrivacyPage');
    expect(marketing).toContain("path: '/terms'");
    expect(marketing).toContain('TermsPage');
    expect(marketing).toContain("path: '/gift'");
    expect(marketing).toContain('GiftPage');
    expect(marketing).toContain("path: '*'");
    expect(marketing).toContain('LandingPage');
  });

  it('keeps privacy and terms as route shells with no fabricated legal copy', () => {
    const privacy = readRepoFile('src/pages/PrivacyPage.tsx');
    const terms = readRepoFile('src/pages/TermsPage.tsx');
    const shell = readRepoFile('src/pages/LegalPlaceholderPage.tsx');
    expect(shell).toMatch(/not in force/i);
    expect(shell).toMatch(/not legal advice/i);
    expect(shell).not.toMatch(/parked|tonight|unsigned draft|privacy draft|terms draft/i);
    expect(shell).not.toContain('Privacy draft');
    expect(shell).not.toContain('Terms draft');
    expect(shell).toContain('to="/privacy"');
    expect(shell).toContain('to="/terms"');
    expect(shell).toContain('pt-36');
    expect(privacy).toMatch(/Route shell only/i);
    expect(privacy).toMatch(/not a privacy policy/i);
    expect(privacy).not.toMatch(/stays private always/i);
    expect(privacy).not.toMatch(/@wondertone\./i);
    expect(privacy).not.toMatch(/we collect/i);
    expect(terms).toMatch(/Route shell only/i);
    expect(terms).toMatch(/not a terms of service/i);
    expect(terms).not.toMatch(/by using this/i);
    expect(terms).not.toMatch(/you agree/i);
  });

  it('keeps /gift unlisted and not sold', () => {
    const gift = readRepoFile('src/pages/GiftPage.tsx');
    const nav = readRepoFile('src/components/navigation/FounderNavigation.tsx');
    expect(gift).toMatch(/not an offer/i);
    expect(nav).not.toContain("to: '/gift'");
    expect(nav).not.toContain("to: '/pricing'");
  });

  it('uses memorial copy without prices, ratings, or Living Canvas', () => {
    const memorial = readRepoFile('src/pages/MemorialPage.tsx');
    expect(memorial).toContain('Bring them back in art.');
    expect(memorial).toContain('Upload a photo. Choose a style. See them again. No prompts.');
    expect(memorial).toContain('Upload a photo.');
    expect(memorial).not.toContain('The photo you love, as art.');
    expect(memorial).not.toContain('Turn Your Memories Into Museum Quality Art');
    expect(memorial).not.toContain('One upload. One style. No prompts.');
    const uploader = readRepoFile('src/components/launchpad/PhotoUploader.tsx');
    expect(uploader).toContain('Upload a photo of someone you lost');
    expect(uploader).not.toContain('someone they lost');
    expect(memorial).not.toMatch(/\$\d/);
    expect(memorial).not.toMatch(/Living Canvas/);
    expect(memorial).not.toMatch(/★|stars|press/i);
    expect(memorial).not.toContain('InstantBreadthStrip');
    expect(memorial).not.toContain('Browse Our Library');
    expect(memorial).not.toContain('Memorial is a dedicated entrance');
    expect(memorial).not.toContain('Preview is display-only');
    expect(memorial).not.toContain('Privacy draft');
    expect(memorial).not.toContain('Terms draft');
    expect(memorial).toContain('to="/privacy"');
    expect(memorial).toContain('to="/terms"');
    expect(memorial).toContain('pt-36');
    expect(readRepoFile('src/config/productSurface.ts')).toMatch(/hideStockLibrary:\s*true/);
    expect(uploader).toContain('hideStockLibrary');
    expect(uploader.indexOf('!rules.hideStockLibrary')).toBeLessThan(uploader.indexOf('Browse Our Library'));
  });

  it('rewrites the locked client paths to the SPA on Vercel', () => {
    const vercel = readRepoFile('vercel.json');
    expect(vercel).toContain('destination');
    expect(vercel).toContain('/index.html');
    expect(vercel).toContain('"/"');
    expect(vercel).toContain('/create');
    expect(vercel).toContain('/pricing');
    expect(vercel).toContain('/memorial');
    expect(vercel).toContain('/gift');
    expect(vercel).toContain('/privacy');
    expect(vercel).toContain('/terms');
    expect(vercel).toMatch(/\(\?!api\//);
    expect(vercel).toContain('assets/');
  });
});
