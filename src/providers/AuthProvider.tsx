import { useEffect, type ReactNode } from 'react';
import AuthModal from '@/components/modals/AuthModal';
import TokenDecrementToast from '@/components/ui/TokenDecrementToast';
import QuotaExhaustedModal from '@/components/modals/QuotaExhaustedModal';
import { devError, devLog, devWarn } from '@/utils/devLogger';
import { getSupabaseClient, prefetchSupabaseClient } from '@/utils/supabaseClient.loader';
import { useSessionActions } from '@/store/hooks/useSessionStore';
import { useEntitlementsActions, useEntitlementsState } from '@/store/hooks/useEntitlementsStore';
import { syncUserProfile, extractFullName, extractAvatarUrl } from '@/utils/syncUserProfile';
import { registerFunnelAccessTokenProvider } from '@/utils/analyticsClient';
import { useFounderStore } from '@/store/useFounderStore';

type AuthProviderProps = {
  children: ReactNode;
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  const { setSession } = useSessionActions();
  const { entitlements, showTokenToast, showQuotaModal, displayRemainingTokens } = useEntitlementsState();
  const { setShowTokenToast, setShowQuotaModal, hydrateEntitlements } = useEntitlementsActions();

  useEffect(() => {
    registerFunnelAccessTokenProvider(() => useFounderStore.getState().accessToken);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const bootstrap = async () => {
      if (typeof window !== 'undefined') {
        prefetchSupabaseClient();
      }
      const supabaseClient = await getSupabaseClient();
      if (!supabaseClient) {
        if (isMounted) {
          setSession(null, null);
        }
        return;
      }

      // Process magic link callback tokens from URL hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash;
        devLog('AuthProvider', 'URL hash detected', {
          hasHash: hash.length > 0,
          containsAccessToken: hash.includes('access_token'),
        });

        if (hash.includes('access_token')) {
          devLog('AuthProvider', 'Magic link callback detected - processing tokens');
          try {
            // Extract tokens from URL hash
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            devLog('AuthProvider', 'Token extraction summary', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
            });

            if (accessToken && refreshToken) {
              // Establish session from magic link tokens
              devLog('AuthProvider', 'Calling setSession with extracted tokens');
              const { data: sessionData, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                devError('AuthProvider', 'Failed to set session from magic link');
              } else {
                devLog('AuthProvider', 'Session established successfully', {
                  hasUser: Boolean(sessionData.session?.user?.id),
                });
              }

              // Clean URL to remove tokens from browser history
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } else {
              devWarn('AuthProvider', 'Missing tokens in URL hash - cannot establish session');
            }
          } catch {
            devError('AuthProvider', 'Error processing magic link callback');
          }
        } else {
          devLog('AuthProvider', 'Hash present but no access_token found');
        }
      } else {
        devLog('AuthProvider', 'No URL hash detected - checking for existing session');
      }

      const { data } = await supabaseClient.auth.getSession();
      if (!isMounted) return;
      const session = data.session;

      devLog('AuthProvider', 'getSession result', {
        hasSession: !!session,
        hasUser: Boolean(session?.user?.id),
        hasAccessToken: Boolean(session?.access_token),
      });

      if (session?.user) {
        void syncUserProfile(session.user);
      }

      setSession(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              fullName: extractFullName(session.user),
              avatarUrl: extractAvatarUrl(session.user),
            }
          : null,
        session?.access_token ?? null
      );

      const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user) {
          void syncUserProfile(nextSession.user);
        }
        setSession(
          nextSession?.user
            ? {
                id: nextSession.user.id,
                email: nextSession.user.email ?? null,
                fullName: extractFullName(nextSession.user),
                avatarUrl: extractAvatarUrl(nextSession.user),
              }
            : null,
          nextSession?.access_token ?? null
        );
      });

      unsubscribe = () => listener?.subscription.unsubscribe();
    };

    void bootstrap();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [setSession]);

  useEffect(() => {
    const handleFocus = () => {
      void hydrateEntitlements();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus, { passive: true });
      // Refresh once on mount in case the page was backgrounded before hydration
      void hydrateEntitlements();
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [hydrateEntitlements]);

  return (
    <>
      {children}
      <AuthModal />
      <TokenDecrementToast
        visible={showTokenToast}
        remaining={displayRemainingTokens}
        onClose={() => setShowTokenToast(false)}
      />
      <QuotaExhaustedModal
        open={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        currentTier={entitlements.tier}
        remainingTokens={displayRemainingTokens ?? entitlements.remainingTokens}
        quota={entitlements.quota}
        renewAt={entitlements.renewAt}
      />
    </>
  );
};

export default AuthProvider;
