import type { EntitlementTier } from '@/store/founder/storeTypes';

export type TierId = EntitlementTier;

export type SubscriptionTier = {
  id: TierId;
  name: string;
  price: string;
  priceDetail: string;
  tokensPerMonth: number;
  tokensLabel?: string;
  features: string[];
  gradient: string;
};

export const FREE_TIER: SubscriptionTier = {
  id: 'free',
  name: 'Wondertone Free',
  price: '$0',
  priceDetail: 'Forever',
  tokensPerMonth: 10,
  tokensLabel: 'Tokens',
  features: [
    'Watermarked previews',
    'Living Canvas demo access',
    'Smart style recommendations',
    'Community momentum feed',
  ],
  gradient: 'from-[#1f243b] via-[#1a1f38] to-[#171a2f]',
};

export const PREMIUM_TIERS: SubscriptionTier[] = [
  {
    id: 'creator',
    name: 'Creator',
    price: '$7.99',
    priceDetail: 'per month',
    tokensPerMonth: 50,
    tokensLabel: 'Tokens',
    features: [
      '50 premium generations each month',
      'Watermark-free previews & HD downloads',
      'Living Canvas AR downloads',
      'Priority notifications from Wondertone queues',
      'Creator badge inside Studio & marketplace',
    ],
    gradient: 'from-[#6c3df2]/85 via-[#4a50ff]/85 to-[#1ca7ff]/85',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$19.99',
    priceDetail: 'per month',
    tokensPerMonth: 150,
    tokensLabel: 'Tokens',
    features: [
      '150 premium generations per month',
      'Batch clean + watermarked exports',
      'Shared brand assets & style kits',
      'Dedicated live preview operator tools',
      'Priority queue (2× speed boost)',
    ],
    gradient: 'from-[#31a8ff]/85 via-[#09d3ef]/80 to-[#26f0b9]/80',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49.99',
    priceDetail: 'per month',
    tokensPerMonth: 400,
    tokensLabel: 'Tokens',
    features: [
      '400 premium generations per month',
      'Wondertone concierge & white-label support',
      'Real-time teleprompter prompts for live events',
      'Priority queue (3× speed boost)',
      'Guaranteed Living Canvas production in 48h',
    ],
    gradient: 'from-[#ffa62e]/85 via-[#ff6b45]/85 to-[#f63b81]/85',
  },
];
