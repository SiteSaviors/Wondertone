import { describe, expect, it } from 'vitest';
import {
  FIRST_SKU,
  LIVE_CHECKOUT_ENABLED,
  ARTWORK_TEST_PRICE_ENV,
  filterPurchasableEnhancementIds,
  isPurchaseDisabledEnhancement,
} from '@/config/commerceGuards';
import { createCanvasConfigSlice } from '@/store/founder/slices/canvas/canvasConfigSlice';
import type { Enhancement, FounderState } from '@/store/founder/storeTypes';
import { vi } from 'vitest';

const seedEnhancements: Enhancement[] = [
  { id: 'floating-frame', name: 'Floating Frame', description: '', price: 29, enabled: false },
  { id: 'living-canvas', name: 'Living Canvas', description: '', price: 59, enabled: false },
];

const createTestStore = () => {
  let state = {
    orientation: 'square',
    canvasModalOpen: false,
    closeCanvasModal: vi.fn(),
    livingCanvasModalOpen: false,
    styles: [],
  } as unknown as FounderState;

  const get = () => state;
  const set = vi.fn((partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...next };
  });

  const slice = createCanvasConfigSlice(seedEnhancements)(set, get, {} as never);
  state = { ...state, ...slice };
  return { getState: () => state };
};

describe('Living Canvas purchase guard', () => {
  it('treats living-canvas as purchase-disabled', () => {
    expect(LIVE_CHECKOUT_ENABLED).toBe(false);
    expect(FIRST_SKU).toBe('revealed_artwork_full_res');
    expect(ARTWORK_TEST_PRICE_ENV).toBe('STRIPE_TEST_PRICE_REVEALED_ARTWORK');
    expect(isPurchaseDisabledEnhancement('living-canvas')).toBe(true);
    expect(isPurchaseDisabledEnhancement('floating-frame')).toBe(false);
    expect(filterPurchasableEnhancementIds(['floating-frame', 'living-canvas', 'digital-bundle'])).toEqual([
      'floating-frame',
      'digital-bundle',
    ]);
  });

  it('refuses to enable Living Canvas from the canvas store', () => {
    const store = createTestStore();
    store.getState().setEnhancementEnabled('living-canvas', true);
    store.getState().toggleEnhancement('living-canvas');
    expect(store.getState().enhancements.find((item) => item.id === 'living-canvas')?.enabled).toBe(false);
    expect(store.getState().livingCanvasEnabled()).toBe(false);
  });

  it('does not restore Living Canvas from a saved selection', () => {
    const store = createTestStore();
    store.getState().canvasSelections['style-1'] = {
      size: '24x24',
      frame: 'none',
      enhancements: ['living-canvas', 'floating-frame'],
    };
    store.getState().loadCanvasSelectionForStyle('style-1');
    expect(store.getState().enhancements.find((item) => item.id === 'living-canvas')?.enabled).toBe(false);
    expect(store.getState().enhancements.find((item) => item.id === 'floating-frame')?.enabled).toBe(true);
  });
});
