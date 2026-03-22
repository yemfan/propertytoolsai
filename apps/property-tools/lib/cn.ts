/** Tiny className merge — keeps Card/layout components dependency-free. */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
