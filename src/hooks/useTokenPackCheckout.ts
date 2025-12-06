import { useCallback, useState } from 'react';
import { TOKEN_PACKS } from '@/data/tokenPacks';
import { createOrderCheckoutSession } from '@/utils/checkoutApi';
import { trackTokenPackCheckoutStart } from '@/utils/telemetry';

type CheckoutUrlBuilder = (type: 'token_pack', status: 'success' | 'cancelled') => string;

type UseTokenPackCheckoutOptions = {
  sessionUser: unknown;
  accessToken: string | null;
  promptAuth: () => void;
  buildCheckoutUrl: CheckoutUrlBuilder;
};

type UseTokenPackCheckoutResult = {
  startCheckout: (packId: string) => Promise<void>;
  loadingPackId: string | null;
  resumePendingCheckout: () => Promise<void>;
};

const PENDING_TOKEN_PACK_KEY = 'wt_pending_token_pack';

const useTokenPackCheckout = ({
  sessionUser,
  accessToken,
  promptAuth,
  buildCheckoutUrl,
}: UseTokenPackCheckoutOptions): UseTokenPackCheckoutResult => {
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);

  const startCheckout = useCallback(
    async (packId: string) => {
      const pack = TOKEN_PACKS.find((tokenPack) => tokenPack.id === packId);
      if (!pack) {
        throw new Error('Selected token pack is unavailable.');
      }

      trackTokenPackCheckoutStart({
        packId: pack.id,
        tokens: pack.tokens,
        priceCents: pack.priceCents,
      });

      if (!sessionUser) {
        try {
          window.sessionStorage.setItem(PENDING_TOKEN_PACK_KEY, packId);
        } catch {
          // ignore storage failures
        }
        promptAuth();
        return;
      }

      if (!accessToken) {
        throw new Error('Access token unavailable. Please sign in again.');
      }

      setLoadingPackId(packId);
      try {
        const { url } = await createOrderCheckoutSession({
          items: [
            {
              name: pack.name,
              description: `${pack.tokens} Wondertone tokens`,
              amount: pack.priceCents,
              quantity: 1,
            },
          ],
          accessToken,
          metadata: {
            purchaseType: 'token_pack',
            sku: pack.sku,
          },
          successUrl: buildCheckoutUrl('token_pack', 'success'),
          cancelUrl: buildCheckoutUrl('token_pack', 'cancelled'),
        });
        window.location.href = url;
      } catch (error) {
        throw error instanceof Error ? error : new Error('Unable to start checkout. Please try again.');
      } finally {
        setLoadingPackId((current) => (current === packId ? null : current));
      }
    },
    [accessToken, buildCheckoutUrl, promptAuth, sessionUser]
  );

  const resumePendingCheckout = useCallback(async () => {
    if (!sessionUser || !accessToken) return;
    let pendingPackId: string | null = null;
    try {
      pendingPackId = window.sessionStorage.getItem(PENDING_TOKEN_PACK_KEY);
    } catch {
      pendingPackId = null;
    }
    if (!pendingPackId) return;

    try {
      window.sessionStorage.removeItem(PENDING_TOKEN_PACK_KEY);
    } catch {
      // ignore
    }
    await startCheckout(pendingPackId);
  }, [accessToken, sessionUser, startCheckout]);

  return {
    startCheckout,
    loadingPackId,
    resumePendingCheckout,
  };
};

export { PENDING_TOKEN_PACK_KEY };
export default useTokenPackCheckout;
