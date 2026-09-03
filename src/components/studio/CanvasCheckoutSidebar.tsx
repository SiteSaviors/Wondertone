import { RefObject } from 'react';
import CanvasFrameSelector from '@/components/studio/CanvasFrameSelector';
import CanvasSizeSelector from '@/components/studio/CanvasSizeSelector';
import CheckoutFooter from '@/components/studio/CheckoutFooter';
import CanvasOrderSummary from '@/components/studio/CanvasOrderSummary';
import StaticTestimonial from '@/components/studio/StaticTestimonial';

interface CanvasCheckoutSidebarProps {
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

const CanvasCheckoutSidebar = ({
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
}: CanvasCheckoutSidebarProps) => (
  <div className="space-y-8">
    <section className="space-y-4" data-section="frame-selection" ref={frameSectionRef}>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-white">1. Choose Your Frame</h3>
        <p className="font-poppins text-sm text-white/60">Select the finish that makes your art shine.</p>
      </div>
      <CanvasFrameSelector />
      <p className="text-xs text-white/60" />
    </section>

    <section className="space-y-6" data-section="size-selection" ref={sizeSectionRef}>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-white">2. Choose Your Size</h3>
        <p className="font-poppins text-sm text-white/60">
          Museum-quality canvas, handcrafted frame, ready to hang
        </p>
      </div>
      <CanvasSizeSelector
        floatingFrameEnabled={floatingFrameEnabled}
        onFrameShimmer={onFrameShimmer}
        hasAutoExpandedOnce={hasAutoExpandedOnce}
        onAutoExpandDrawer={onAutoExpandDrawer}
      />
    </section>

    <CheckoutFooter onPrimaryCta={onPrimaryCta}>
      <CanvasOrderSummary
        total={total}
        onEditFrame={() => scrollToSection(frameSectionRef)}
        onEditSize={() => scrollToSection(sizeSectionRef)}
        orientationPreviewPending={orientationPreviewPending}
      />
    </CheckoutFooter>

    <div className="mt-6 space-y-3">
      <StaticTestimonial
        quote="This canvas completely transformed our living room. The quality is absolutely stunning."
        author="Sarah M."
        location="Austin, TX"
        verified
        canvasImageUrl="/images/checkout/checkout-testimonial-1.webp"
        layout="horizontal"
        imagePosition="left"
      />

      <StaticTestimonial
        quote="The print arrived museum-ready. Zero nails, instant conversation starter."
        author="Avery M."
        location="Brooklyn, NY"
        verified
        canvasImageUrl="/images/checkout/checkout-testimonial-2.webp"
        layout="horizontal"
        imagePosition="right"
      />

      <StaticTestimonial
        quote="Museum-quality print. Everyone asks where we got it."
        author="James K."
        location="Seattle, WA"
        verified
        canvasImageUrl="/images/checkout/checkout-testimonial-3.jpg"
        layout="horizontal"
        imagePosition="left"
      />
    </div>

    <p className="mt-4 text-center text-[11px] leading-relaxed text-white/45">
      🛡️ 100-day guarantee
    </p>
  </div>
);

export default CanvasCheckoutSidebar;
