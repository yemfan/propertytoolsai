import { supabaseBrowser } from "./supabaseBrowser";

/**
 * Browser session is cookie-backed (`createBrowserClient`). Attaching
 * `Authorization: Bearer <access_token>` still helps API routes that read the
 * bearer before cookies in some paths.
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
