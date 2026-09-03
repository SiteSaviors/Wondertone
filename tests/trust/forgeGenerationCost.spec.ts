import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTWORK_TEST_PRICE_ENV, LIVE_CHECKOUT_ENABLED } from '@/config/commerceGuards';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Forge generation cost and checkout catalog', () => {
  it('records cache_hit, provider fallback, and timings without a dollar column', () => {
    const writer = readRepoFile('supabase/functions/_shared/generationCost.ts');
    const migration = readRepoFile('supabase/migrations/20260903140000_prism_beacon_commerce.sql');
    const generate = readRepoFile('supabase/functions/generate-style-preview/index.ts');

    expect(writer).toContain('cache_hit');
    expect(writer).toContain('provider_fallback');
    expect(writer).toContain('duration_ms');
    expect(writer).toContain('provider_predict_time_s');
    expect(writer).toContain("export type GenerationCostOutcome = 'success' | 'failed' | 'cache_hit'");
    expect(writer).toContain('outcome: GenerationCostOutcome');
    expect(writer).toContain('Never invent dollar amounts');
    expect(writer).not.toMatch(/amount_usd|unit_cost|cogs_cents|price_usd|blended/i);
    expect(writer).not.toMatch(/\$\d/);

    expect(migration).toContain('generation_cost_events');
    expect(migration).toContain('cache_hit boolean not null');
    expect(migration).toContain('provider_fallback boolean not null');
    expect(migration).toContain("outcome text not null check (outcome in ('success', 'failed', 'cache_hit'))");
    expect(migration).toContain('No invented dollar amounts');
    expect(migration).not.toMatch(/numeric\(\d+,\s*2\)/);
    expect(migration).not.toMatch(/\$\d/);

    expect(generate).toContain('recordGenerationCostEvent');
    expect(generate).toContain("outcome: 'cache_hit'");
    expect(generate).toContain('provider_fallback:');
    expect(generate).toContain("provider: 'replicate_seedream'");
    expect(generate).toContain("provider: 'openai_gpt'");
  });

  it('leaves the Stripe test price unset and checkout as price_not_configured', () => {
    const checkout = readRepoFile('supabase/functions/create-artwork-checkout/index.ts');
    const guards = readRepoFile('src/config/commerceGuards.ts');
    expect(ARTWORK_TEST_PRICE_ENV).toBe('STRIPE_TEST_PRICE_REVEALED_ARTWORK');
    expect(LIVE_CHECKOUT_ENABLED).toBe(false);
    expect(guards).toContain('Do not invent one');
    expect(checkout).toContain('price_not_configured');
    expect(checkout).toContain('if (!testPriceId || !testPriceId.startsWith("price_"))');
    expect(checkout).not.toMatch(/price_[A-Za-z0-9]{10,}/);
    expect(checkout).not.toMatch(/\$\d/);
    expect(guards).not.toMatch(/price_[A-Za-z0-9]{10,}/);
  });
});
