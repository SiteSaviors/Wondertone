import { RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import CanvasCheckoutStepIndicator from '@/components/studio/CanvasCheckoutStepIndicator';
import CanvasCheckoutSidebar from '@/components/studio/CanvasCheckoutSidebar';

interface CanvasCheckoutCanvasStepProps {
  canvasModalOpen: boolean;
  timerSeed: number | null;
  frameSectionRef: RefObject<HTMLElement | null>;
  sizeSectionRef: RefObject<HTMLElement | null>;
  floatingFrameEnabled: boolean;
  hasAutoExpandedOnce: boolean;
  onAutoExpandDrawer: () => void;
  onFrameShimmer: () => void;
  onPrimaryCta: () => void;
  total: number;
  orientationPreviewPending: boolean;
  scrollToSection: (ref: RefObject<HTMLElement | null>) => void;
}

const CanvasCheckoutCanvasStep = ({
  canvasModalOpen,
  timerSeed,
  frameSectionRef,
  sizeSectionRef,
  floatingFrameEnabled,
  hasAutoExpandedOnce,
  onAutoExpandDrawer,
  onFrameShimmer,
  onPrimaryCta,
  total,
  orientationPreviewPending,
  scrollToSection,
}: CanvasCheckoutCanvasStepProps) => (
  <div className="space-y-8">
    <header className="space-y-3 pb-6">
      <Dialog.Title className="font-display text-[32px] font-semibold leading-tight tracking-tight text-white">
        ✨ Turn Your Memory Into a Masterpiece
      </Dialog.Title>
      <Dialog.Description className="font-poppins text-[16px] font-semibold leading-relaxed text-white/80">
        Museum-grade canvas. Arrives ready to hang.
      </Dialog.Description>
      <CanvasCheckoutStepIndicator showTimer={false} timerSeed={timerSeed} timerRunning={canvasModalOpen} />
    </header>

    <CanvasCheckoutSidebar
      frameSectionRef={frameSectionRef}
      sizeSectionRef={sizeSectionRef}
      floatingFrameEnabled={floatingFrameEnabled}
      hasAutoExpandedOnce={hasAutoExpandedOnce}
      onAutoExpandDrawer={onAutoExpandDrawer}
      onFrameShimmer={onFrameShimmer}
      onPrimaryCta={onPrimaryCta}
      total={total}
      orientationPreviewPending={orientationPreviewPending}
      scrollToSection={scrollToSection}
    />
  </div>
);

export default CanvasCheckoutCanvasStep;
