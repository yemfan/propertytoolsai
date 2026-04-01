/** Minimal typings when `@supabase/supabase-js` is not yet hoisted; replace with package types after `pnpm install`. */
declare module "@supabase/supabase-js" {
  export type Session = {
    access_token: string;
    refresh_token?: string;
    user?: { id: string; email?: string };
  };

  export type AuthChangeEvent =
    | "INITIAL_SESSION"
    | "PASSWORD_RECOVERY"
    | "SIGNED_IN"
    | "SIGNED_OUT"
    | "TOKEN_REFRESHED"
    | "USER_UPDATED";

  export type SupabaseAuthClient = {
    getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ data: { session: Session | null; user: unknown }; error: Error | null }>;
    signOut: () => Promise<{ error: Error | null }>;
  };

  export type SupabaseClient = {
    auth: SupabaseAuthClient;
    channel: (name: string) => RealtimeChannel;
    removeChannel: (ch: RealtimeChannel) => Promise<unknown>;
    realtime: { setAuth?: (token: string) => void };
  };

  export type RealtimeChannel = {
    on: (
      type: string,
      config: Record<string, unknown>,
      cb: () => void
    ) => RealtimeChannel;
    subscribe: (cb?: (status: string) => void) => RealtimeChannel;
  };

  export function createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClient;
}
