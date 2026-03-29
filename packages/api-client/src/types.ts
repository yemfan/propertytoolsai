/** Standard envelope for LeadSmart HTTP JSON APIs. */
export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  headers: Headers;
};

export type ApiFailure = {
  ok: false;
  status: number;
  error: string;
  body: unknown;
  headers: Headers;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ApiFetchOptions = RequestInit & {
  /** When set, non-2xx still resolves (no throw); inspect `ok`. */
  raw?: boolean;
};
