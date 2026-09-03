import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelRewrite = {
  source: string;
  destination: string;
};

type VercelConfig = {
  rewrites?: VercelRewrite[];
};

const RELEASE_GATE_PATHS = [
  '/create',
  '/create/studio',
  '/pricing',
  '/gift',
  '/memorial',
  '/privacy',
  '/terms',
];

const EXCLUDED_PREFIXES = ['api/', 'functions/', 'assets/', 'Auth-Logos/'];

const readVercelConfig = (): VercelConfig =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as VercelConfig;

const matchesExplicitSource = (source: string, pathname: string): boolean => {
  if (source === pathname) return true;
  if (source.endsWith('/:path*')) {
    const prefix = source.slice(0, -'/:path*'.length);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return false;
};

describe('Vercel SPA fallback (release gate)', () => {
  it('is valid JSON and sends client routes to index.html', () => {
    const config = readVercelConfig();
    expect(Array.isArray(config.rewrites)).toBe(true);
    expect(config.rewrites?.length).toBeGreaterThan(0);
    expect(config.rewrites?.every((rule) => rule.destination === '/index.html')).toBe(true);
  });

  it('covers the live 404 client routes without swallowing API or assets', () => {
    const rewrites = readVercelConfig().rewrites ?? [];
    const catchAll = rewrites.find((rule) => rule.source.includes('(?!'));

    expect(catchAll, 'catch-all rewrite with a negative lookahead is required').toBeDefined();
    expect(catchAll?.destination).toBe('/index.html');
    for (const prefix of EXCLUDED_PREFIXES) {
      expect(catchAll?.source).toContain(prefix);
    }

    for (const pathname of RELEASE_GATE_PATHS) {
      const matched = rewrites.some(
        (rule) =>
          rule.destination === '/index.html' &&
          (matchesExplicitSource(rule.source, pathname) || Boolean(catchAll && rule.source === catchAll.source))
      );
      expect(matched, `${pathname} must rewrite to index.html`).toBe(true);
    }

    for (const pathname of [
      '/api/health',
      '/functions/v1/ingest-funnel-event',
      '/assets/index.js',
      '/Auth-Logos/Google-logo.svg',
    ]) {
      const matchedExplicit = rewrites.some(
        (rule) => rule.destination === '/index.html' && matchesExplicitSource(rule.source, pathname)
      );
      expect(matchedExplicit, `${pathname} must not have an explicit SPA rewrite`).toBe(false);
      const rest = pathname.replace(/^\//, '');
      const excludedByLookahead = EXCLUDED_PREFIXES.some((prefix) => rest.startsWith(prefix));
      expect(excludedByLookahead, `${pathname} must be excluded by the catch-all lookahead`).toBe(true);
    }
  });
});
