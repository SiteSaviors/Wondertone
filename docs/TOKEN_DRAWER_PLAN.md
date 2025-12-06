# Token Drawer Refresh – Research & Implementation Blueprint

## Phase 1 – Audit & Alignment (Complete)
- **Token badge → drawer flow**
  - `FounderNavigation` owns the badge; both desktop and mobile buttons simply toggle `setTokenDrawerOpen(true)`.
  - `TokenBalanceDrawer` (Radix dialog) receives entitlements-derived props (`tierLabel`, `remainingTokens`, `renewAt`, `onManageMembership`, `isLoading`).
  - Drawer sections: header w/ balance + close button, tier summary card, two buttons (top-up placeholder + manage membership), `TokenHistoryMiniList`, usage CTA.
- **Pricing components available for reuse**
  - `PricingModeToggle` already handles subscription/payg states with gradient indicator & accessibility affordances.
  - `TokenPackCard` and `TierCard` now share a single-column, gradient card structure; only sizes/padding need adjusting for the drawer.
  - `handleSelectTokenPack` encapsulates telemetry, auth gating, sessionStorage fallback, and checkout orchestration—currently scoped to `PricingPage`.

## Phase 2 – Shared Data & Hooks (Complete)
- **Token Pack Data + Checkout Hook**
  - Extract `TOKEN_PACKS` into `src/data/tokenPacks.ts`. Include metadata (id, name, tokens, price, priceCents, badge, gradient, SKU/description).
  - Create `useTokenPackCheckout` hook that exposes `{ startCheckout(packId), pendingPackId, resumePendingCheckout }`. Internally reuses existing logic (sessionStorage key, telemetry via `trackTokenPackCheckoutStart`, `createOrderCheckoutSession`).
  - Hook accepts `sessionUser`, `accessToken`, and `openAuthModal` so both the Pricing page and drawer can plug in their own auth context.
- **Subscription Tier Data**
  - Move `FREE_TIER` + `PREMIUM_TIERS` into `src/data/subscriptionTiers.ts`. Export helpers like `getFreeTier()` and `getPremiumTiers()` to reuse for mini cards.
- **Shared mode state**
  - Reuse `PricingMode` union across experiences. Drawer toggle will default to `'payg'` but still uses the same enum + telemetry (`trackPricingToggle(mode)`) to keep analytics aligned.

## Phase 3 – Drawer UX Architecture (Complete)
- **Component tree**
  - `TokenBalanceDrawer`
    - `header`: existing balance/tier summary.
    - `MiniPricingToggle`: wrapper around `PricingModeToggle` with reduced `max-w`, `text-xs`, and tighter padding. Defaults to `'payg'`.
    - `TokenPackRail`: vertical stack of shrunken `TokenPackCard` components (or horizontal scroll on mobile). CTA buttons call `useTokenPackCheckout`’s `startCheckout` directly.
    - `MembershipRail`: toggled view showing horizontal cards for tiers using `TierCard` with condensed styles (smaller min-height, fewer bullets). Include current plan badge + “Manage membership” CTA.
    - `Footer`: lightweight link to `/pricing?mode=payg` (“View all packs”) plus existing “Go to usage →” link (optional if we want to keep analytics export entry).
- **Layout & interaction**
  - **Default state**: PAYG rail visible; cards stacked vertically (padding between) for easy scanning. On narrow screens, cards can be full-width with `snap-y` scroll if needed; alternative is horizontal `snap-x` row with gradient masks.
  - **Toggle behavior**: smooth fade/slide transition between rails to avoid sudden height jumps. Maintain drawer height by reserving space or animating container height. Use `aria-live` region to announce mode changes (mirrors pricing page).
  - **Error / success feedback**: use a compact inline alert above the rail. Reuse Pricing page error/success state (manually pass down via hook). After checkout start, allow button to show loading shimmer; on error, show message + “Try again” link.
- **Navigation links**
  - Keep a subtle “View full pricing →” link at the bottom so users can open `/pricing?mode=payg` for more context. When toggle = membership, change copy to “Manage plan on pricing page →”.

## Implementation Roadmap
1. **Data/Hook extraction (Phase 2 coding)**
   - Create `src/data/tokenPacks.ts` & `src/data/subscriptionTiers.ts`.
   - Implement `useTokenPackCheckout` hook sharing existing logic.
   - Update `PricingPage` to consume the new modules/hook.
P
3. **Drawer integration**
   - Replace the placeholder/button sections inside `TokenBalanceDrawer` with the new layout.
   - Wire `useTokenPackCheckout` into the drawer (loading states, errors, pending pack resume).
   - Keep “Manage membership” action accessible (either per tier card or as a footer button).
4. **Polish & QA**
   - Animations, responsive behavior, and accessibility (focus trap, keyboard navigation within rails).
   - Analytics: fire `trackPricingToggle` from the mini toggle, `trackTokenPackCheckoutStart` from drawer purchases.
   - Regression testing on `/pricing` to confirm the extracted data/hook still behave as before.
