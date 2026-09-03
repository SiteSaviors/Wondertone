import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Beacon/Prism entitlement lock', () => {
  it('does not show a dollar amount on the revealed_artwork_full_res control', () => {
    const actionGrid = readRepoFile('src/components/studio/ActionGrid.tsx');
    const paywall = readRepoFile('src/components/modals/DownloadUpgradeModal.tsx');
    expect(actionGrid).toContain('data-sku="revealed_artwork_full_res"');
    expect(actionGrid).toContain('Get the full-resolution file');
    expect(actionGrid).not.toMatch(/\$\d/);
    expect(paywall).toContain('data-sku="revealed_artwork_full_res"');
    expect(paywall).not.toMatch(/\$\d/);
  });

  it('does not treat checkout success or redirect as conversion or success UI', () => {
    const studio = readRepoFile('src/pages/StudioPage.tsx');
    const analytics = readRepoFile('src/utils/funnelAnalytics.ts');
    expect(studio).not.toContain('Order confirmed');
    expect(studio).not.toContain('Your Wondertone receipt is on the way');
    expect(studio).toContain('Redirect is not conversion');
    expect(analytics).toContain("Conversion is entitlement_granted");
    expect(analytics).toContain("'checkout_success'");
    expect(analytics).toContain("'entitlement_granted'");
  });

  it('requires an entitlement row before download', () => {
    const downloadApi = readRepoFile('src/utils/artworkDownload.ts');
    const edge = readRepoFile('supabase/functions/get-artwork-download/index.ts');
    const handlers = readRepoFile('src/hooks/studio/useDownloadHandlers.ts');
    expect(edge).toContain('artwork_entitlements');
    expect(edge).toContain('entitlement_required');
    expect(edge).toContain('entitled: true');
    expect(downloadApi).toContain('payload?.entitled !== true');
    expect(handlers).toContain("result.status !== 'entitled'");
    expect(handlers).toContain('triggerBrowserDownload(result.downloadUrl');
  });
});
