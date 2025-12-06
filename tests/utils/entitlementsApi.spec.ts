import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthenticatedEntitlements } from '@/utils/entitlementsApi';
import * as loader from '@/utils/supabaseClient.loader';

type MockEntitlementRow = {
  tier: string;
  tokens_quota: number | string | null;
  remaining_tokens: number | string | null;
  premium_tokens?: number | string | null;
  free_monthly_tokens?: number | string | null;
  has_premium_access?: boolean | string | null;
  period_end: string | null;
  dev_override: boolean | string | null;
};

const createMockClient = (row: MockEntitlementRow | null, error: { message: string } | null = null) => ({
  auth: {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: 'user-token' } } }),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: row, error, count: null })),
    })),
  })),
});

describe('fetchAuthenticatedEntitlements', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      description: 'free tier mapping',
      row: {
        tier: 'free',
        tokens_quota: 10,
        remaining_tokens: 7,
        period_end: '2024-11-01T00:00:00Z',
        dev_override: false,
      },
      expected: {
        tier: 'free',
        quota: 10,
        remainingTokens: 7,
        premiumTokens: 7,
        freeMonthlyTokens: null,
        hasPremiumAccess: false,
        renewAt: '2024-11-01T00:00:00Z',
        priority: 'normal',
        requiresWatermark: true,
        devOverride: false,
      },
    },
    {
      description: 'creator tier mapping',
      row: {
        tier: 'creator',
        tokens_quota: 50,
        remaining_tokens: 25,
        period_end: '2024-11-01T00:00:00Z',
        dev_override: false,
      },
      expected: {
        tier: 'creator',
        quota: 50,
        remainingTokens: 25,
        premiumTokens: 25,
        freeMonthlyTokens: null,
        hasPremiumAccess: true,
        renewAt: '2024-11-01T00:00:00Z',
        priority: 'priority',
        requiresWatermark: false,
        devOverride: false,
      },
    },
    {
      description: 'string payloads are coerced',
      row: {
        tier: 'plus',
        tokens_quota: '250',
        remaining_tokens: '200',
        period_end: '2024-11-01T00:00:00Z',
        dev_override: 'false',
      },
      expected: {
        tier: 'plus',
        quota: 250,
        remainingTokens: 200,
        premiumTokens: 200,
        freeMonthlyTokens: null,
        hasPremiumAccess: true,
        renewAt: '2024-11-01T00:00:00Z',
        priority: 'priority',
        requiresWatermark: false,
        devOverride: false,
      },
    },
    {
      description: 'pro tier mapping',
      row: {
        tier: 'pro',
        tokens_quota: 250,
        remaining_tokens: 240,
        period_end: '2024-11-01T00:00:00Z',
        dev_override: false,
      },
      expected: {
        tier: 'pro',
        quota: 250,
        remainingTokens: 240,
        premiumTokens: 240,
        freeMonthlyTokens: null,
        hasPremiumAccess: true,
        renewAt: '2024-11-01T00:00:00Z',
        priority: 'pro',
        requiresWatermark: false,
        devOverride: false,
      },
    },
  ])('$description', async ({ row, expected }) => {
    vi.spyOn(loader, 'getSupabaseClient').mockResolvedValue(createMockClient(row));

    const snapshot = await fetchAuthenticatedEntitlements();

    expect(snapshot).toEqual(expected);
  });

  it('promotes to dev tier when dev_override is true', async () => {
    const row = {
      tier: 'free',
      tokens_quota: 1000,
      remaining_tokens: 900,
      period_end: '2024-12-01T00:00:00Z',
      dev_override: true,
    };

    vi.spyOn(loader, 'getSupabaseClient').mockResolvedValue(createMockClient(row));

    const snapshot = await fetchAuthenticatedEntitlements();

    expect(snapshot).toEqual({
      tier: 'dev',
      quota: 1000,
      remainingTokens: 900,
      premiumTokens: 900,
      freeMonthlyTokens: null,
      hasPremiumAccess: true,
      renewAt: '2024-12-01T00:00:00Z',
      priority: 'pro',
      requiresWatermark: false,
      devOverride: true,
    });
  });

  it('throws when Supabase reports an error', async () => {
    vi.spyOn(loader, 'getSupabaseClient').mockResolvedValue(
      createMockClient(null, { message: 'boom' })
    );

    await expect(fetchAuthenticatedEntitlements()).rejects.toMatchObject({ message: 'boom' });
  });
});
