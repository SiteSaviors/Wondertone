import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIRST_SKU, LIVE_CHECKOUT_ENABLED, SELLABLE_SUBSCRIPTION_TIERS } from '@/config/commerceGuards';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Beacon commerce primitives', () => {
  it('does not enable live checkout or subscription SKUs on this path', () => {
    expect(FIRST_SKU).toBe('revealed_artwork_full_res');
    expect(LIVE_CHECKOUT_ENABLED).toBe(false);
    expect(SELLABLE_SUBSCRIPTION_TIERS).toEqual([]);
  });

  it('sets stripe-webhook verify_jwt false in git only and keeps signature verification', () => {
    const config = readRepoFile('supabase/config.toml');
    const webhook = readRepoFile('supabase/functions/stripe-webhook/index.ts');
    expect(config).toMatch(/\[functions\.stripe-webhook\][\s\S]*verify_jwt = false/);
    expect(config).toMatch(/Do NOT apply this verify_jwt=false change to production/);
    expect(webhook).toContain('constructEvent');
    expect(webhook).toContain('stripe_event_ledger');
    expect(webhook).toContain('artwork_entitlements');
    expect(webhook).toContain('entitlement_granted');
    expect(webhook).toContain('checkout.session.completed is not conversion');
    const grantFn = webhook.slice(webhook.indexOf('const grantArtworkEntitlement'));
    expect(grantFn.indexOf('.from("artwork_entitlements")')).toBeLessThan(grantFn.indexOf('persistEntitlementGranted'));
    expect(webhook).not.toContain('upsertSubscription');
    expect(webhook).not.toContain("tier: 'creator'");
  });

  it('stops compositing logos on generate-style-preview', () => {
    const watermark = readRepoFile('supabase/functions/generate-style-preview/watermarkService.ts');
    const generate = readRepoFile('supabase/functions/generate-style-preview/index.ts');
    expect(watermark).toMatch(/never overlay logos or stamps/i);
    expect(watermark).toContain('return imageBuffer');
    expect(watermark).not.toContain('baseImage.composite');
    expect(generate).not.toContain('WatermarkService.createWatermarkedImage');
    expect(generate).toContain('createDisplayPreview');
    expect(generate).toContain('recordGenerationCostEvent');
  });
});
