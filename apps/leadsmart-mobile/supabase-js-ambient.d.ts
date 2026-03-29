/** Minimal typings when `@supabase/supabase-js` is not yet hoisted; replace with package types after `pnpm install`. */
declare module "@supabase/supabase-js" {
  export type SupabaseClient = {
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
