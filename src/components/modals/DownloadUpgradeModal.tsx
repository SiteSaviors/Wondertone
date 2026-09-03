import { useState } from 'react';
import { X } from 'lucide-react';
import { LIVE_CHECKOUT_ENABLED } from '@/config/commerceGuards';
import { trackCheckoutStarted } from '@/utils/telemetry';
import { createArtworkCheckoutSession } from '@/utils/artworkCheckout';
import { useStudioPreviewState } from '@/store/hooks/studio/useStudioPreviewState';
import { useStudioUserState } from '@/store/hooks/studio/useStudioUserState';

interface DownloadUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadUpgradeModal({ isOpen, onClose }: DownloadUpgradeModalProps) {
  const { preview } = useStudioPreviewState();
  const { sessionAccessToken } = useStudioUserState();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckoutIntent = async () => {
    if (LIVE_CHECKOUT_ENABLED) {
      setMessage('Live payments are not enabled.');
      return;
    }

    setPending(true);
    setMessage(null);
    trackCheckoutStarted();

    const result = await createArtworkCheckoutSession({
      previewLogId: preview?.data?.previewLogId,
      accessToken: sessionAccessToken,
    });

    if (result.status === 'redirect') {
      window.location.assign(result.url);
      return;
    }

    setPending(false);
    if (result.status === 'not_configured' || result.status === 'live_disabled') {
      setMessage('Checkout is not enabled.');
      return;
    }
    setMessage(result.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-white mb-3" data-sku="revealed_artwork_full_res">
            Get the full-resolution file.
          </h2>
          <p className="text-center text-white/70 mb-8">
            The preview is display-only. The product is the full-resolution file of the revealed
            artwork after entitlement.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                void handleCheckoutIntent();
              }}
              disabled={pending || LIVE_CHECKOUT_ENABLED}
              className="w-full py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-brand-indigo to-purple-600 text-white transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LIVE_CHECKOUT_ENABLED ? 'Checkout is not enabled' : pending ? 'Starting checkout' : 'Continue'}
            </button>
            {message ? <p className="text-center text-sm text-white/65">{message}</p> : null}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-6 rounded-xl font-semibold bg-white/10 hover:bg-white/15 text-white transition-all border border-white/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
