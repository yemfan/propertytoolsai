/**
 * Simple pub/sub callback registry for the reconnect event.
 * Pure TypeScript — no React dependency.
 */

export type ReconnectListener = () => void;

const listeners = new Set<ReconnectListener>();

/**
 * Register a callback to fire when the device transitions from
 * offline to online. Returns an unsubscribe function.
 */
export function subscribeReconnect(fn: ReconnectListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Called by NetworkContext when the device goes offline → online.
 * Iterates the listener set and calls each callback.
 */
export function fireReconnect(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Swallow errors from individual listeners so one bad
      // subscriber doesn't prevent the rest from firing.
    }
  });
}
