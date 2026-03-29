import type { ApiFailure, ApiFetchOptions, ApiResult, ApiSuccess } from "./types";

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Typed fetch helper: JSON body, discriminated result, works in browser + RN.
 */
export async function apiFetch<T>(url: string, init: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const { raw, ...req } = init;
  const headers = new Headers(req.headers);
  if (req.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, { ...req, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network_error";
    const failure: ApiFailure = {
      ok: false,
      status: 0,
      error: msg,
      body: null,
      headers: new Headers(),
    };
    return failure;
  }

  const text = await res.text();
  const parsed = text ? parseJsonSafe(text) : null;

  if (res.ok) {
    const success: ApiSuccess<T> = {
      ok: true,
      status: res.status,
      data: parsed as T,
      headers: res.headers,
    };
    return success;
  }

  if (raw) {
    const failure: ApiFailure = {
      ok: false,
      status: res.status,
      error: typeof parsed === "object" && parsed && "error" in parsed ? String((parsed as any).error) : res.statusText,
      body: parsed,
      headers: res.headers,
    };
    return failure;
  }

  const failure: ApiFailure = {
    ok: false,
    status: res.status,
    error:
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error?: unknown }).error ?? res.statusText)
        : res.statusText,
    body: parsed,
    headers: res.headers,
  };
  return failure;
}

export async function apiFetchJson<T>(
  url: string,
  body: unknown,
  init: Omit<ApiFetchOptions, "body"> = {}
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    ...init,
    method: init.method ?? "POST",
    body: JSON.stringify(body),
  });
}
