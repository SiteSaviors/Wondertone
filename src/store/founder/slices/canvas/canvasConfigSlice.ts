import type { StateCreator } from 'zustand';
import type { CanvasSize, Enhancement, FounderState } from '@/store/founder/storeTypes';
import { createCanvasSelectionSnapshot } from '@/utils/canvas/selectionSnapshot';
import { getCanvasSizeOption, getDefaultSizeForOrientation } from '@/utils/canvasSizes';
import { selectCurrentStyle } from '@/store/useFounderStoreHelpers';
import { isPurchaseDisabledEnhancement } from '@/config/commerceGuards';

export type CanvasConfigSlice = Pick<
  FounderState,
  | 'enhancements'
  | 'selectedStyleId'
  | 'selectedCanvasSize'
  | 'selectedFrame'
  | 'canvasSelections'
  | 'setCanvasSize'
  | 'setFrame'
  | 'toggleEnhancement'
  | 'setEnhancementEnabled'
  | 'persistCanvasSelection'
  | 'loadCanvasSelectionForStyle'
  | 'selectStyle'
  | 'clearSelectedStyle'
  | 'computedTotal'
  | 'currentStyle'
  | 'livingCanvasEnabled'
>;

const cloneEnhancements = (enhancements: Enhancement[]) =>
  enhancements.map((item) => ({ ...item }));

export const createCanvasConfigSlice = (
  initialEnhancements: Enhancement[]
): StateCreator<FounderState, [], [], CanvasConfigSlice> => (set, get) => ({
  enhancements: cloneEnhancements(initialEnhancements),
  selectedStyleId: null,
  selectedCanvasSize: null,
  selectedFrame: 'none',
  canvasSelections: {},
  setCanvasSize: (size) => {
    set({ selectedCanvasSize: size });
    get().persistCanvasSelection();
  },
  setFrame: (frame) => {
    set({ selectedFrame: frame });
    get().persistCanvasSelection();
  },
  toggleEnhancement: (id) => {
    if (isPurchaseDisabledEnhancement(id)) {
      return;
    }
    set((state) => {
      const enhancements = state.enhancements.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      );
      return {
        enhancements,
      };
    });
    get().persistCanvasSelection();
  },
  setEnhancementEnabled: (id, enabled) => {
    if (isPurchaseDisabledEnhancement(id)) {
      return;
    }
    set((state) => ({
      enhancements: state.enhancements.map((item) => (item.id === id ? { ...item, enabled } : item)),
    }));
    get().persistCanvasSelection();
  },
  persistCanvasSelection: () => {
    const state = get();
    const styleId = state.selectedStyleId;
    if (!styleId) return;
    const snapshot = createCanvasSelectionSnapshot(state);
    set({
      canvasSelections: {
        ...state.canvasSelections,
        [styleId]: {
          size: snapshot.canvasSize as CanvasSize | null,
          frame: snapshot.frame,
          enhancements: [...snapshot.enhancements],
        },
      },
    });
  },
  loadCanvasSelectionForStyle: (styleId) => {
    if (!styleId) return;
    const state = get();
    const selection = state.canvasSelections[styleId];
    const defaultSize = getDefaultSizeForOrientation(state.orientation);
    const nextSize = selection?.size ?? defaultSize;
    const nextFrame = selection?.frame ?? 'none';
    const enabledIds = new Set(
      (selection?.enhancements ?? []).filter((itemId) => !isPurchaseDisabledEnhancement(itemId))
    );

    const enhancements = state.enhancements.map((item) => ({
      ...item,
      enabled: enabledIds.has(item.id),
    }));

    const update: Partial<FounderState> = {
      selectedCanvasSize: nextSize,
      selectedFrame: nextFrame,
      enhancements,
    };

    if (!selection) {
      (update as Partial<FounderState>).canvasSelections = {
        ...state.canvasSelections,
        [styleId]: {
          size: nextSize,
          frame: nextFrame,
          enhancements: Array.from(enabledIds),
        },
      };
    }

    set(update);
  },
  selectStyle: (id) => {
    const state = get();
    if (state.selectedStyleId) {
      state.persistCanvasSelection();
    }
    if (state.canvasModalOpen) {
      state.closeCanvasModal('cancel');
    }
    set({ selectedStyleId: id });
    get().loadCanvasSelectionForStyle(id);
  },
  clearSelectedStyle: () => {
    const state = get();
    if (state.selectedStyleId) {
      state.persistCanvasSelection();
    }
    set({ selectedStyleId: null });
  },
  computedTotal: () => {
    const { enhancements, styles, selectedStyleId, selectedCanvasSize } = get();
    const styleMod = styles.find((style) => style.id === selectedStyleId)?.priceModifier ?? 0;
    const sizePrice = getCanvasSizeOption(selectedCanvasSize)?.price;
    const enhancementsTotal = enhancements.filter((item) => item.enabled).reduce((sum, item) => sum + item.price, 0);
    return (sizePrice ?? 0) + styleMod + enhancementsTotal;
  },
  currentStyle: () => {
    const state = get();
    return selectCurrentStyle(state.styles, state.selectedStyleId);
  },
  livingCanvasEnabled: () => get().enhancements.find((item) => item.id === 'living-canvas')?.enabled ?? false,
});
