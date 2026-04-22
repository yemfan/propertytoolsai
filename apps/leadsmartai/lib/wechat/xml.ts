/**
 * Minimal XML helpers for Tencent WeChat Official Account webhooks.
 *
 * Tencent's format is very constrained:
 *   * Root element is always `<xml>`.
 *   * Children are flat key/value pairs — one level deep.
 *   * Text values are wrapped in `<![CDATA[...]]>`.
 *   * Numbers (CreateTime, MsgId) appear as bare text.
 *
 * Rather than pull in `fast-xml-parser` or `xml2js` we use a ~80-line
 * parser + builder tailored to this exact shape. Rationale:
 *   - One less dep with its own CVE stream
 *   - Tencent's schema is stable in a way generic XML isn't
 *   - Errors here are narrower + more legible than from a generic lib
 *
 * If we ever need to handle nested structures (e.g. encrypted messages
 * with inner AES payloads), this file expands rather than getting
 * replaced.
 *
 * References:
 *   https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_standard_messages.html
 *   https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Passive_user_reply_message.html
 */

/** Keys Tencent uses on top-level webhook messages. Not exhaustive;
 *  unknown keys still round-trip through `raw`. */
export type TencentIncomingMessage = {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  /** Populated for text. */
  Content?: string;
  /** Populated for `event` messages. */
  Event?: string;
  /** Scene key from QR scans (subscribe-with-scene or SCAN event). */
  EventKey?: string;
  /** QR `qrscene_` ticket for subscribe events from scanning. */
  Ticket?: string;
  /** Media ids for image/voice/video. */
  MediaId?: string;
  /** Geo coordinates for location messages. */
  Location_X?: number;
  Location_Y?: number;
  Scale?: number;
  Label?: string;
  /** Tencent's unique message id (deduplication key). Absent on event messages. */
  MsgId?: string;
  /** Keep the full parsed record so unknown fields survive logging. */
  raw: Record<string, string>;
};

/**
 * Parse a Tencent webhook request body into a structured record.
 * Tolerant — returns `null` on parse failure so the webhook returns
 * empty success instead of exposing parser errors to Tencent's retry
 * logic (which would hammer us if we 5xx'd).
 */
export function parseTencentXml(body: string): TencentIncomingMessage | null {
  if (!body) return null;
  // Strip optional XML declaration + whitespace.
  const trimmed = body.replace(/^\s*<\?xml[^?]*\?>\s*/, "").trim();
  if (!trimmed.startsWith("<xml>") || !trimmed.endsWith("</xml>")) return null;

  const inner = trimmed.slice(5, -6);
  // Match each <Key>VALUE</Key> pair. VALUE is either a CDATA section
  // or bare text. Non-greedy on value; tolerant of whitespace between
  // tags.
  const pairRe = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g;
  const raw: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(inner)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3] ?? "";
    raw[key] = value;
  }

  if (!raw.ToUserName || !raw.FromUserName || !raw.MsgType) return null;

  const msg: TencentIncomingMessage = {
    ToUserName: raw.ToUserName,
    FromUserName: raw.FromUserName,
    CreateTime: Number(raw.CreateTime) || 0,
    MsgType: raw.MsgType,
    raw,
  };
  if (raw.Content != null) msg.Content = raw.Content;
  if (raw.Event != null) msg.Event = raw.Event;
  if (raw.EventKey != null) msg.EventKey = raw.EventKey;
  if (raw.Ticket != null) msg.Ticket = raw.Ticket;
  if (raw.MediaId != null) msg.MediaId = raw.MediaId;
  if (raw.MsgId != null) msg.MsgId = raw.MsgId;
  if (raw.Location_X != null) msg.Location_X = Number(raw.Location_X);
  if (raw.Location_Y != null) msg.Location_Y = Number(raw.Location_Y);
  if (raw.Scale != null) msg.Scale = Number(raw.Scale);
  if (raw.Label != null) msg.Label = raw.Label;
  return msg;
}

/**
 * Build a Tencent "passive reply" XML response for a given incoming
 * message. Currently supports text replies only — if the webhook wants
 * to reply with image / article / transfer_customer_service, extend
 * this (or use the outbound customer-service API instead; passive
 * reply has a 5-second timeout which our DB writes can exceed).
 */
export function buildTextReplyXml(args: {
  toOpenId: string;
  fromOaAppId: string;
  content: string;
  createTime?: number;
}): string {
  const createTime = args.createTime ?? Math.floor(Date.now() / 1000);
  return [
    "<xml>",
    `<ToUserName><![CDATA[${args.toOpenId}]]></ToUserName>`,
    `<FromUserName><![CDATA[${args.fromOaAppId}]]></FromUserName>`,
    `<CreateTime>${createTime}</CreateTime>`,
    "<MsgType><![CDATA[text]]></MsgType>",
    `<Content><![CDATA[${escapeCdata(args.content)}]]></Content>`,
    "</xml>",
  ].join("");
}

/**
 * CDATA sections can't contain the `]]>` terminator. If the content
 * we're embedding happens to contain it (unlikely but possible for
 * user-authored text), split the sequence across two CDATA blocks.
 */
function escapeCdata(s: string): string {
  return s.replace(/\]\]>/g, "]]]]><![CDATA[>");
}
