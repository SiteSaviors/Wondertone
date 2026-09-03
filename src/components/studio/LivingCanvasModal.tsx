import { Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useCanvasConfigActions, useLivingCanvasStatus } from '@/store/hooks/useCanvasConfigStore';

const LivingCanvasModal = () => {
  const { livingCanvasModalOpen, livingCanvasEnabled } = useLivingCanvasStatus();
  const { setLivingCanvasModalOpen } = useCanvasConfigActions();
  const open = livingCanvasModalOpen && !livingCanvasEnabled;

  return (
    <Modal
      open={open}
      onOpenChange={setLivingCanvasModalOpen}
      size="xl"
      showCloseButton={false}
      overlayClassName="bg-slate-950/70 backdrop-blur-sm"
      contentClassName="text-white shadow-founder p-8 space-y-6"
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400/15 text-emerald-200 text-xs tracking-[0.3em] uppercase">
        <Sparkles className="w-4 h-4" /> Living Canvas
      </div>
      <h2 className="text-3xl font-semibold text-white">Living Canvas</h2>
      <p className="text-white/70 leading-relaxed">This add-on is not for sale.</p>
      <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[3/4]">
        <img
          src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80"
          alt="Living Canvas preview"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <Button className="flex-1" disabled>
          Coming soon — purchase disabled
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setLivingCanvasModalOpen(false)}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default LivingCanvasModal;
