/**
 * Tencent WeChat Official Account webhook signature verification.
 *
 * Tencent signs every webhook request to our configured URL with a
 * SHA1 hash computed as:
 *
 *   sha1(sort([token, timestamp, nonce]).join(""))
 *
 * …where `token` is the string we configured in the Tencent admin
 * console when setting up the webhook. The `signature`, `timestamp`,
 * and `nonce` arrive as query-string parameters on every request.
 *
 * This helper does exactly that check and nothing else — it does NOT
 * read env or touch the DB. The caller loads the expected token (from
 * the `wechat_oa_accounts` row that matches the request's OA) and
 * passes it in. Keeping it pure makes testing trivial and lets future
 * per-OA token rotation happen without touching this file.
 *
 * Reference:
 *   https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html
 */

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * @returns true iff the caller's signature matches what we'd compute
 *   from the same token. Uses a timing-safe byte comparison so a wrong
 *   signature does not leak length / prefix-match information via
 *   response time.
 */
export function verifyTencentSignature({
  token,
  timestamp,
  nonce,
  signature,
}: {
  token: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): boolean {
  if (!token || !timestamp || !nonce || !signature) return false;

  // Per Tencent docs: sort alphabetically (the three input strings
  // are sorted lexicographically, then concatenated).
  const sorted = [token, timestamp, nonce].sort();
  const computed = createHash("sha1").update(sorted.join(""), "utf8").digest("hex");

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
