import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "../svix";

const RAW_SECRET = Buffer.from("test-secret-bytes-aaaaaaaaaaaa");
const SECRET = "whsec_" + RAW_SECRET.toString("base64");

function sign(svixId: string, ts: string, body: string): string {
  return createHmac("sha256", RAW_SECRET).update(`${svixId}.${ts}.${body}`).digest("base64");
}

describe("verifySvixSignature", () => {
  it("accepts a valid v1 signature", () => {
    const body = '{"type":"email.opened","data":{"email_id":"x"}}';
    const ts = "1715000000";
    const id = "msg_xyz";
    const sig = `v1,${sign(id, ts, body)}`;
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: body,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sig,
      nowMs: () => Number(ts) * 1000,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = '{"type":"email.opened","data":{"email_id":"x"}}';
    const ts = "1715000000";
    const id = "msg_xyz";
    const sig = `v1,${sign(id, ts, body)}`;
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: body + "tampered",
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sig,
      nowMs: () => Number(ts) * 1000,
    });
    expect(r.ok).toBe(false);
  });

  it("accepts when one of multiple signatures matches (rotation)", () => {
    const body = '{"x":1}';
    const ts = "1715000000";
    const id = "id";
    const correct = `v1,${sign(id, ts, body)}`;
    const wrong = "v1,bm90LWNvcnJlY3Q=";
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: body,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: `${wrong} ${correct}`,
      nowMs: () => Number(ts) * 1000,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects events older than the tolerance window", () => {
    const body = '{"x":1}';
    const ts = "1715000000";
    const id = "id";
    const sig = `v1,${sign(id, ts, body)}`;
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: body,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sig,
      // Now is 10 minutes after ts; tolerance is 5min default.
      nowMs: () => (Number(ts) + 600) * 1000,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("tolerance");
  });

  it("rejects when any svix header is missing", () => {
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: "{}",
      svixId: null,
      svixTimestamp: "1",
      svixSignature: "v1,sig",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a secret missing the whsec_ prefix", () => {
    const r = verifySvixSignature({
      secret: "not-a-svix-secret",
      rawBody: "{}",
      svixId: "id",
      svixTimestamp: "1",
      svixSignature: "v1,sig",
      toleranceSeconds: null,
    });
    expect(r.ok).toBe(false);
  });

  it("ignores non-v1 signature versions", () => {
    const body = '{"x":1}';
    const ts = "1715000000";
    const id = "id";
    const validV1 = sign(id, ts, body);
    const r = verifySvixSignature({
      secret: SECRET,
      rawBody: body,
      svixId: id,
      svixTimestamp: ts,
      svixSignature: `v2,${validV1}`,
      nowMs: () => Number(ts) * 1000,
    });
    expect(r.ok).toBe(false);
  });
});
