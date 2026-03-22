import { supabaseBrowser } from "./supabaseBrowser";

/**
 * Supabase browser client uses localStorage; API routes use cookies. Attaching
 * `Authorization: Bearer <access_token>` lets `getUserFromRequest` authenticate
 * the same session server-side.
 */
export async function mergeAuthHeaders(base?: HeadersInit): Promise<HeadersInit> {
  const headers = new Headers(base ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const {
    data: { session },
  } = await supabaseBrowser().auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}
