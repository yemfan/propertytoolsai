/**
 * Debounced no-arg callback; `cancel()` clears pending work (for unmount).
 */
export function debounceFn(
  fn: () => void,
  ms: number
): { run: () => void; cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
    run: () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn();
      }, ms);
    },
    cancel: () => {
      if (t) clearTimeout(t);
      t = null;
    },
  };
}
