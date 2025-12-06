import PricingModeToggle, { type PricingMode } from '@/components/ui/PricingModeToggle';

type MiniPricingToggleProps = {
  mode: PricingMode;
  onChange: (mode: PricingMode) => void;
};

const MiniPricingToggle = ({ mode, onChange }: MiniPricingToggleProps) => (
  <PricingModeToggle
    mode={mode}
    onChange={onChange}
    className="max-w-xs text-xs"
    buttonClassName="px-3 py-1.5 text-[11px]"
  />
);

export default MiniPricingToggle;
