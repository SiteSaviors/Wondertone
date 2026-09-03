import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Forge creation journey', () => {
  it('keeps generation explicit and does not auto-preview', () => {
    const store = readRepoFile('src/store/useFounderStore.ts');
    const uploader = readRepoFile('src/components/launchpad/PhotoUploader.tsx');
    const stock = readRepoFile('src/store/founder/slices/stockLibrary/selectionSlice.ts');
    expect(store).toContain('const ENABLE_AUTO_PREVIEWS = false');
    expect(uploader).toContain('shouldAutoGeneratePreviews()');
    expect(stock).toContain('downscaleDataUrlForStudio');
    expect(stock).not.toContain('generatePreviews(undefined, { force: true })');
  });

  it('selects a style without spending credits, then generates only after an explicit start', () => {
    const select = readRepoFile('src/store/founder/slices/canvas/canvasConfigSlice.ts');
    const handle = readRepoFile('src/sections/studio/hooks/useHandleStyleSelect.ts');
    const selectFn = select.slice(select.indexOf('selectStyle:'));
    expect(selectFn).toContain('set({ selectedStyleId: id })');
    expect(selectFn).not.toContain('startStylePreview');
    expect(selectFn).not.toContain('generateStylePreview');
    expect(selectFn).not.toContain('consumePreviewToken');
    expect(handle).toContain('state.selectStyle(styleId)');
    expect(handle.indexOf('state.selectStyle(styleId)')).toBeLessThan(handle.indexOf('void state.startStylePreview(style)'));
    expect(handle).toContain('if (state.pendingStyleId)');
    expect(handle).toContain('if (!gate.allowed)');
    expect(handle.indexOf('if (!gate.allowed)')).toBeLessThan(handle.indexOf('void state.startStylePreview(style)'));
  });

  it('sends an idempotency key and replays server-side without a second debit', () => {
    const client = readRepoFile('src/utils/stylePreviewApi.ts');
    const generate = readRepoFile('supabase/functions/generate-style-preview/index.ts');
    expect(client).toContain("headers['X-Idempotency-Key'] = options.idempotencyKey");
    expect(generate).toContain('idempotency_key');
    expect(generate).toContain("existingLog.outcome === 'success'");
    const replay = generate.slice(generate.indexOf("existingLog.outcome === 'success'"));
    expect(replay.indexOf('Returning cached idempotent preview result')).toBeLessThan(replay.indexOf('tokensDebit'));
    expect(generate).toContain('X-Idempotency-Key header is required');
  });

  it('keeps first-path hide flags and the entitlement lock', () => {
    const surface = readRepoFile('src/config/productSurface.ts');
    const studio = surface.slice(surface.indexOf('hideStockLibrary: false'));
    expect(studio).toMatch(/hideCanvasRail:\s*false/);
    expect(studio).toMatch(/hideTokenPacks:\s*true/);
    expect(studio).toMatch(/hideSubscriptionTiers:\s*true/);
    expect(studio).toMatch(/hideSocialProof:\s*true/);
    expect(readRepoFile('src/config/commerceGuards.ts')).toContain("FIRST_SKU = 'revealed_artwork_full_res'");
  });
});
