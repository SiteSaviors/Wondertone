/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import CanvasCheckoutModal from '@/components/studio/CanvasCheckoutModal';
import type { CheckoutStep, ShippingInfo } from '@/store/useCheckoutStore';

vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    SHOW_STATIC_TESTIMONIALS: true,
  };
});

vi.mock('@/components/studio/CanvasInRoomPreview', () => ({
  default: () => <div data-testid="canvas-preview" />,
}));

vi.mock('@radix-ui/react-dialog', () => {
  const Root = ({ children }: { children: React.ReactNode }) => <div data-dialog-root>{children}</div>;
type BasicProps = {
  children?: React.ReactNode;
};

type OverlayProps = BasicProps & React.HTMLAttributes<HTMLDivElement>;

const Portal = ({ children }: BasicProps) => <div data-dialog-portal>{children}</div>;
const Overlay = ({ children, ...rest }: OverlayProps) => (
  <div data-dialog-overlay {...rest}>
    {children}
  </div>
);
const Content = ({ children, ...rest }: OverlayProps) => (
  <div data-dialog-content {...rest}>
    {children}
  </div>
);
  const Title = ({ children }: { children: React.ReactNode }) => <div data-dialog-title>{children}</div>;
  const Description = ({ children }: { children: React.ReactNode }) => (
    <div data-dialog-description>{children}</div>
  );
  return { Root, Portal, Overlay, Content, Title, Description };
});

const closeCanvasModalMock = vi.fn();
const setCanvasSizeMock = vi.fn();
const setFrameMock = vi.fn();
const toggleEnhancementMock = vi.fn();
const setLivingCanvasModalOpenMock = vi.fn();
const computedTotalMock = vi.fn();
const resetCheckoutMock = vi.fn();
const setStepMock = vi.fn();
const enterModalCheckoutMock = vi.fn();
const leaveModalCheckoutMock = vi.fn();
const navigateMock = vi.fn();

const checkoutStoreMock: {
  step: CheckoutStep;
  setStep: typeof setStepMock;
  resetCheckout: typeof resetCheckoutMock;
  enterModalCheckout: typeof enterModalCheckoutMock;
  leaveModalCheckout: typeof leaveModalCheckoutMock;
  shipping: ShippingInfo;
} = {
  step: 'canvas',
  setStep: setStepMock,
  resetCheckout: resetCheckoutMock,
  enterModalCheckout: enterModalCheckoutMock,
  leaveModalCheckout: leaveModalCheckoutMock,
  shipping: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'US',
  },
};

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const canvasConfigStateMock = {
  selectedCanvasSize: '16x20',
  selectedFrame: 'none',
  enhancements: [
    { id: 'floating-frame', name: 'Floating Frame', price: 59, description: '', enabled: true },
    { id: 'living-canvas', name: 'Living Canvas', price: 49, description: '', enabled: false },
  ],
  computedTotal: () => computedTotalMock(),
};

vi.mock('@/store/hooks/useCanvasConfigStore', () => ({
  useLivingCanvasStatus: vi.fn(() => ({
    livingCanvasModalOpen: false,
    livingCanvasEnabled: false,
  })),
  useCanvasConfigActions: vi.fn(() => ({
    closeCanvasModal: closeCanvasModalMock,
    setCanvasSize: setCanvasSizeMock,
    setFrame: setFrameMock,
    toggleEnhancement: toggleEnhancementMock,
    setLivingCanvasModalOpen: setLivingCanvasModalOpenMock,
    computedTotal: computedTotalMock,
  })),
}));

const canvasModalStateMock = {
  canvasModalOpen: true,
  closeCanvasModal: closeCanvasModalMock,
};

const uploadPipelineStateMock = {
  orientationPreviewPending: false,
};

vi.mock('@/store/hooks/useFounderCanvasStore', () => ({
  useCanvasModalState: (selector: (state: typeof canvasModalStateMock) => unknown) => selector(canvasModalStateMock),
  useUploadPipelineState: (selector: (state: typeof uploadPipelineStateMock) => unknown) => selector(uploadPipelineStateMock),
  useCanvasConfigState: (selector: (state: typeof canvasConfigStateMock & { computedTotal: () => number }) => unknown) =>
    selector({
      ...canvasConfigStateMock,
      computedTotal: () => computedTotalMock(),
    }),
}));

vi.mock('@/store/hooks/useStyleCatalogStore', () => ({
  useStyleCatalogState: vi.fn(() => ({
    currentStyle: { id: 'style-1', name: 'Aurora Dreams', thumbnail: null },
  })),
}));

vi.mock('@/store/hooks/useUploadStore', () => ({
  useUploadState: vi.fn(() => ({
    orientation: 'square',
    smartCrops: {
      square: {
        imageDimensions: { width: 1024, height: 1024 },
      },
    },
    orientationPreviewPending: false,
  })),
}));

vi.mock('@/store/hooks/useEntitlementsStore', () => ({
  useEntitlementsState: vi.fn(() => ({
    userTier: 'pro',
  })),
}));

vi.mock('@/store/useCheckoutStore', () => ({
  useCheckoutStore: (selector?: (state: typeof checkoutStoreMock) => unknown) =>
    selector ? selector(checkoutStoreMock) : checkoutStoreMock,
}));

vi.mock('@/utils/telemetry', () => ({
  trackOrderStarted: vi.fn(),
  trackCheckoutStepView: vi.fn(),
  trackCheckoutExit: vi.fn(),
  trackCheckoutRecommendationShown: vi.fn(),
  trackOrderCompleted: vi.fn(),
}));

const { trackOrderStarted } = await import('@/utils/telemetry');

const findButton = (root: HTMLElement, label: string) =>
  Array.from(root.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;

describe('CanvasCheckoutModal telemetry', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    computedTotalMock.mockReturnValue(249);
    resetCheckoutMock.mockClear();
    setStepMock.mockClear();
    enterModalCheckoutMock.mockClear();
    leaveModalCheckoutMock.mockClear();
    navigateMock.mockClear();
    (trackOrderStarted as vi.Mock).mockClear();
    checkoutStoreMock.step = 'canvas';
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    closeCanvasModalMock.mockClear();
    setCanvasSizeMock.mockClear();
    setFrameMock.mockClear();
    toggleEnhancementMock.mockClear();
    setLivingCanvasModalOpenMock.mockClear();
  });

  it('advances to contact step and records telemetry on first CTA click', async () => {
    act(() => {
      root.render(<CanvasCheckoutModal />);
    });

    const cta =
      findButton(document.body, 'Continue to Contact & Shipping') ??
      findButton(document.body, 'Begin Production');
    expect(cta).toBeTruthy();

    await act(async () => {
      cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(trackOrderStarted).toHaveBeenCalledWith('pro', 249, true);
    expect(setStepMock).toHaveBeenCalledWith('contact');
    expect(resetCheckoutMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
