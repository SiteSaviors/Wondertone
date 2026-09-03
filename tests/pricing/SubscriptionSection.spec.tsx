import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('parked /pricing route', () => {
  it('does not render Creator/Plus/Pro or token packs as a live offer', () => {
    const pricing = readRepoFile('src/pages/PricingPage.tsx');
    expect(pricing).toContain('Memberships and token packs are not for sale.');
    expect(pricing).toContain('This route is parked');
    expect(pricing).toContain('to="/create"');
    expect(pricing).not.toContain('PREMIUM_TIERS');
    expect(pricing).not.toContain('TOKEN_PACKS');
    expect(pricing).not.toContain('createCheckoutSession');
    expect(pricing).not.toContain('useTokenPackCheckout');
    expect(pricing).not.toContain('TierCard');
    expect(pricing).not.toContain('TokenPackCard');
    expect(pricing).not.toContain('PricingModeToggle');
    expect(pricing).not.toMatch(/\$7\.99|\$19\.99|\$49\.99/);
    expect(pricing).not.toMatch(/\$\d/);
  });
});
