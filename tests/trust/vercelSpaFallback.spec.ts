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

const PROTECTED_PREFIXES = ['/api/', '/functions/', '/assets/', '/Auth-Logos/'];

const readVercelConfig = (): VercelConfig =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as VercelConfig;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sourceToRegex = (source: string): RegExp => {
  if (source.startsWith('/((?!') && source.endsWith('.*)')) {
    const lookahead = source.slice('/(('.length, source.lastIndexOf('.*)'))
      .replace(/\//g, '\\/');
    return new RegExp(`^\\/${lookahead}.*$`);
  }

  if (source.endsWith('/:path*')) {
    const prefix = escapeRegExp(source.slice(0, -'/:path*'.length));
    return new RegExp(`^${prefix}(?:\\/.*)?$`);
  }

  return new RegExp(`^${escapeRegExp(source)}$`);
};

const rewriteMatchesPath = (source: string, pathname: string): boolean =>
  sourceToRegex(source).test(pathname);

describe('Vercel SPA fallback (release gate)', () => {
  it('is valid JSON and sends client routes to index.html', () => {
    const config = readVercelConfig();
    expect(Array.isArray(config.rewrites)).toBe(true);
    expect(config.rewrites?.length).toBeGreaterThan(0);
    expect(config.rewrites?.every((rule) => rule.destination === '/index.html')).toBe(true);
  });

  it('covers the live 404 client routes without swallowing API or assets', () => {
    const config = readVercelConfig();
    const rewrites = config.rewrites ?? [];
    const sources = rewrites.map((rule) => rule.source).join('\n');

    expect(sources).toMatch(/api\//);
    expect(sources).toMatch(/functions\//);
    expect(sources).toMatch(/assets\//);
    expect(sources).toMatch(/\(\?\!/);

    for (const pathname of RELEASE_GATE_PATHS) {
      const matched = rewrites.some(
        (rule) => rule.destination === '/index.html' && rewriteMatchesPath(rule.source, pathname)
      );
      expect(matched, `${pathname} must rewrite to index.html`).toBe(true);
    }

    for (const pathname of [
      '/api/health',
      '/functions/v1/ingest-funnel-event',
      '/assets/index.js',
      '/Auth-Logos/Google-logo.svg',
    ]) {
      const matched = rewrites.some(
        (rule) => rule.destination === '/index.html' && rewriteMatchesPath(rule.source, pathname)
      );
      expect(matched, `${pathname} must not be rewritten to index.html`).toBe(false);
    }

    for (const prefix of PROTECTED_PREFIXES) {
      expect(
        rewrites.some((rule) => rule.source === prefix || rule.source === `${prefix}:path*`)
      ).toBe(false);
    }
  });
});
