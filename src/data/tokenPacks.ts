export type TokenPack = {
  id: string;
  name: string;
  sku: string;
  tokens: number;
  price: string;
  priceCents: number;
  badge?: string;
  bullets: string[];
  gradient: string;
  ctaLabel: string;
};

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: 'pack-25',
    name: 'Explorer Pack',
    sku: 'token_pack_25',
    tokens: 25,
    price: '$4.99',
    priceCents: 499,
    badge: 'One-time purchase',
    bullets: [
      '25 premium tokens',
      'No expiration date',
      'Access to all Wondertone styles',
      'Full HD & 4K outputs',
      'Enhanced queue placement',
    ],
    gradient: 'from-[#9c5bff]/50 via-[#6c63ff]/60 to-[#32d6ff]/50',
    ctaLabel: 'Buy 25 Tokens',
  },
  {
    id: 'pack-50',
    name: 'Studio Pack',
    sku: 'token_pack_50',
    tokens: 50,
    price: '$9.99',
    priceCents: 999,
    badge: 'Most popular',
    bullets: [
      '50 premium tokens',
      'No expiration date',
      'Priority access to premium styles',
      'Full HD & 4K outputs',
      'Enhanced queue placement',
    ],
    gradient: 'from-[#31a8ff]/60 via-[#09d3ef]/60 to-[#26f0b9]/50',
    ctaLabel: 'Buy 50 Tokens',
  },
  {
    id: 'pack-100',
    name: 'Creator Reserve',
    sku: 'token_pack_100',
    tokens: 100,
    price: '$17.99',
    priceCents: 1799,
    badge: 'Best value',
    bullets: [
      '100 premium tokens',
      'No expiration date',
      'Access to all Wondertone styles',
      'Full HD & 4K outputs',
      'Enhanced queue placement',
    ],
    gradient: 'from-[#ffa62e]/60 via-[#ff6b45]/65 to-[#f63b81]/55',
    ctaLabel: 'Buy 100 Tokens',
  },
];
