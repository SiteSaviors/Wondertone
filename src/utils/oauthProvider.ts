import { getSupabaseClient } from '@/utils/supabaseClient.loader';
import { useAuthModal } from '@/store/useAuthModal';
import { getEnabledProviders, OAUTH_PROVIDERS } from '@/config/oauthProviders';
import type { AuthProviderMethod } from '@/utils/telemetry';
import type { WondertoneAuthClient } from '@/utils/wondertoneAuthClient';

type SignInResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

type HandleProviderSignInOptions = {
  completeGateIntent?: boolean;
  supabaseClient?: WondertoneAuthClient | null;
};

const DEFAULT_ERROR_COPY: Record<AuthProviderMethod, string> = {
  google: 'Google sign-in failed. Please try again.',
  microsoft: 'Microsoft sign-in failed. Please try again.',
  facebook: 'Facebook sign-in failed. Please try again.',
  email: 'Email sign-in failed. Please try again.',
};

export const handleProviderSignIn = async (
  provider: Exclude<AuthProviderMethod, 'email'>,
  options: HandleProviderSignInOptions = {}
): Promise<SignInResult> => {
  const shouldCompleteGateIntent = options.completeGateIntent ?? true;
  const providerConfig =
    getEnabledProviders().find((entry) => entry.id === provider) ??
    OAUTH_PROVIDERS.find((entry) => entry.id === provider);

  if (!providerConfig) {
    return {
      success: false,
      message: 'This sign-in option is currently unavailable.',
    };
  }

  try {
    const supabase = options.supabaseClient ?? (await getSupabaseClient());
    if (!supabase) {
      throw new Error('Authentication is not configured.');
    }

    const redirectTo = `${window.location.origin}/create`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerConfig.supabaseId,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    if (shouldCompleteGateIntent) {
      useAuthModal.getState().completeGateIntent(provider);
    }
    return { success: true };
  } catch (error) {
    console.error('[OAuth] Sign-in failed');
    const message =
      error instanceof Error && error.message ? error.message : DEFAULT_ERROR_COPY[provider];
    return { success: false, message };
  }
};
