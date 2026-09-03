import { describe, expect, it, vi } from 'vitest';
import type {
  AuthChangeEvent,
  AuthOtpResponse,
  AuthTokenResponse,
  OAuthResponse,
  Session,
  SignInWithOAuthCredentials,
  SignInWithPasswordlessCredentials,
  SignOut,
} from '@supabase/auth-js';
import type { GoTrueClient } from '@supabase/auth-js';
import { createWondertoneAuthClient } from '@/utils/wondertoneAuthClient';

const createSession = (accessToken: string | null): Session => {
  return {
    access_token: accessToken,
    refresh_token: accessToken,
    expires_in: 3600,
    expires_at: 1_788_432_000,
    token_type: 'bearer',
    user: null,
    provider_token: null,
  } as unknown as Session;
};

class StubGoTrueClient implements Pick<
  GoTrueClient,
  'getSession' | 'setSession' | 'signInWithOtp' | 'signInWithOAuth' | 'signOut' | 'onAuthStateChange'
> {
  public session: Session | null = createSession('initial-token');
  public signInWithOtp = vi.fn(
    async (_credentials: SignInWithPasswordlessCredentials): Promise<AuthOtpResponse> => ({
      data: { session: this.session },
      error: null,
    })
  );
  public signInWithOAuth = vi.fn(
    async (_credentials: SignInWithOAuthCredentials): Promise<OAuthResponse> => ({
      data: { provider: 'google', url: 'https://example.com' },
      error: null,
    })
  );
  public signOut = vi.fn(async (_signOut?: SignOut) => {
    this.session = null;
    return { error: null };
  });
  private unsubscribeSpy = vi.fn();
  private stateChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null =
    null;

  getSession = vi.fn(async (): Promise<AuthTokenResponse> => ({
    data: { session: this.session },
    error: null,
  }));

  setSession = vi.fn(
    async (
      currentSession: Pick<Session, 'refresh_token' | 'access_token'>
    ): Promise<AuthTokenResponse> => {
      this.session = createSession(currentSession.access_token ?? null);
      return {
        data: { session: this.session },
        error: null,
      };
    }
  );

  onAuthStateChange = vi.fn(
    (
      callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>
    ) => {
      this.stateChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: this.unsubscribeSpy,
          },
        },
      };
    }
  );

  trigger(event: AuthChangeEvent, session: Session | null) {
    this.stateChangeCallback?.(event, session);
  }

  get unsubscribeCalledCount() {
    return this.unsubscribeSpy.mock.calls.length;
  }
}

describe('createWondertoneAuthClient', () => {
  it('returns null when Supabase env is missing', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = createWondertoneAuthClient({
      supabaseUrl: '',
      supabaseAnonKey: '',
    });
    expect(client).toBeNull();
    consoleSpy.mockRestore();
  });

  it('wraps GoTrue client and exposes expected helpers', async () => {
    const stub = new StubGoTrueClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ tier: 'pro', remaining_tokens: 42 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = createWondertoneAuthClient({
      client: stub as unknown as GoTrueClient,
      supabaseUrl: 'https://wondertone.supabase.co',
      supabaseAnonKey: 'anon-key',
      fetch: fetchMock,
    });

    expect(client).not.toBeNull();

    const token = await client!.getAccessToken();
    expect(token).toBe('initial-token');
    expect(stub.getSession).toHaveBeenCalledTimes(1);

    await client!.auth.signInWithOtp({ email: 'test@example.com' });
    expect(stub.signInWithOtp).toHaveBeenCalledTimes(1);

    await client!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://example.com' } });
    expect(stub.signInWithOAuth).toHaveBeenCalledTimes(1);

    const { data: sessionData } = await client!.auth.getSession();
    expect(sessionData.session).toEqual(createSession('initial-token'));

    const { data: subscription } = client!.auth.onAuthStateChange(() => {});
    subscription.subscription.unsubscribe();
    expect(stub.unsubscribeCalledCount).toBe(1);

    const selectResult = await client!
      .from('v_entitlements')
      .select('*')
      .maybeSingle<{ tier: string; remaining_tokens: number }>();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestArgs = fetchMock.mock.calls[0]![1];
    expect(requestArgs?.headers?.Prefer).toBe('return=representation,single-object');
    expect(selectResult.data).toEqual({ tier: 'pro', remaining_tokens: 42 });
    expect(selectResult.error).toBeNull();
  });
});
