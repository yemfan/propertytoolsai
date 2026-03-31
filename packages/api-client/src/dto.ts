/**
 * Shared JSON envelope patterns for LeadSmart AI HTTP APIs (dashboard, mobile, public).
 */

/** Typical success body: `{ ok: true, ...payload }` */
export type ApiOk<T extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true;
} & T;

/** Typical failure body: `{ ok: false, error: string, code?: string }` */
export type ApiErr = {
  ok: false;
  error: string;
  code?: string;
};

export type ApiEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = ApiOk<T> | ApiErr;

export function isApiErr(e: ApiEnvelope): e is ApiErr {
  return e.ok === false;
}

export function isApiOk<T extends Record<string, unknown>>(e: ApiEnvelope<T>): e is ApiOk<T> {
  return e.ok === true;
}
