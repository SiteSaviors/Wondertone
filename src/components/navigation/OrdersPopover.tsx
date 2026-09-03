import { memo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ClipboardList, Sparkles } from 'lucide-react';

type OrdersPopoverProps = {
  cartCount: number;
  onNavigateToCheckout: () => void;
};

const OrdersPopoverComponent = ({ cartCount, onNavigateToCheckout }: OrdersPopoverProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-200 hover:scale-105 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80"
          aria-label="View canvas orders"
          title="View canvas orders"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2l1.68 9.02c.12.66.7 1.15 1.37 1.15h8.9c.66 0 1.24-.47 1.37-1.13L19 7H6" />
            <circle cx="9" cy="19" r="1.2" />
            <circle cx="16" cy="19" r="1.2" />
          </svg>
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 px-1.5 text-[10px] font-semibold text-black shadow-[0_0_15px_rgba(249,115,22,0.45)]">
            {cartCount}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={12}
          align="end"
          className="z-[9999] w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-[0_25px_80px_rgba(76,29,149,0.45)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 text-white">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
              <ClipboardList className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <p className="text-sm font-semibold">No active canvas orders yet</p>
              <p className="text-xs text-white/60">Your next masterpiece is one click away.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNavigateToCheckout();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/40 bg-purple-500/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500/40"
          >
            <Sparkles className="h-4 w-4" />
            Resume canvas checkout
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const OrdersPopover = memo(OrdersPopoverComponent);

export default OrdersPopover;
