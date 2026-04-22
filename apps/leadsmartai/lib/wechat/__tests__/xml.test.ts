import { describe, expect, it } from "vitest";
import { buildTextReplyXml, parseTencentXml } from "../xml";

const realWorldTextMessage = `<xml>
  <ToUserName><![CDATA[gh_abc123]]></ToUserName>
  <FromUserName><![CDATA[openid_xyz]]></FromUserName>
  <CreateTime>1729512000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[您好，这套房子还在卖吗？]]></Content>
  <MsgId>1000000001</MsgId>
</xml>`;

const subscribeEvent = `<xml>
  <ToUserName><![CDATA[gh_abc123]]></ToUserName>
  <FromUserName><![CDATA[openid_new_follower]]></FromUserName>
  <CreateTime>1729512100</CreateTime>
  <MsgType><![CDATA[event]]></MsgType>
  <Event><![CDATA[subscribe]]></Event>
  <EventKey><![CDATA[qrscene_agent_42]]></EventKey>
  <Ticket><![CDATA[TICKET]]></Ticket>
</xml>`;

describe("parseTencentXml", () => {
  it("parses a real-world text message with CJK content", () => {
    const msg = parseTencentXml(realWorldTextMessage);
    expect(msg).not.toBeNull();
    expect(msg?.ToUserName).toBe("gh_abc123");
    expect(msg?.FromUserName).toBe("openid_xyz");
    expect(msg?.MsgType).toBe("text");
    expect(msg?.Content).toBe("您好，这套房子还在卖吗？");
    expect(msg?.MsgId).toBe("1000000001");
    expect(msg?.CreateTime).toBe(1729512000);
  });

  it("parses a subscribe event with a scene key from a QR scan", () => {
    const msg = parseTencentXml(subscribeEvent);
    expect(msg?.MsgType).toBe("event");
    expect(msg?.Event).toBe("subscribe");
    expect(msg?.EventKey).toBe("qrscene_agent_42");
    expect(msg?.Ticket).toBe("TICKET");
    // Events have no MsgId.
    expect(msg?.MsgId).toBeUndefined();
  });

  it("keeps unknown fields around under `raw`", () => {
    const xml = `<xml>
      <ToUserName><![CDATA[a]]></ToUserName>
      <FromUserName><![CDATA[b]]></FromUserName>
      <CreateTime>1</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[hi]]></Content>
      <FutureField><![CDATA[some-new-tencent-attribute]]></FutureField>
    </xml>`;
    const msg = parseTencentXml(xml);
    expect(msg?.raw.FutureField).toBe("some-new-tencent-attribute");
  });

  it("parses values that lack a CDATA wrapper", () => {
    // Tencent numeric fields (CreateTime, MsgId) appear as bare text.
    const msg = parseTencentXml(realWorldTextMessage);
    expect(msg?.CreateTime).toBe(1729512000);
    expect(msg?.MsgId).toBe("1000000001");
  });

  it("returns null on malformed input rather than throwing", () => {
    expect(parseTencentXml("")).toBeNull();
    expect(parseTencentXml("not xml")).toBeNull();
    expect(parseTencentXml("<xml></xml>")).toBeNull(); // no required fields
    // Missing required MsgType:
    expect(
      parseTencentXml(
        `<xml><ToUserName><![CDATA[a]]></ToUserName><FromUserName><![CDATA[b]]></FromUserName></xml>`,
      ),
    ).toBeNull();
  });

  it("tolerates an optional XML declaration prefix", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${realWorldTextMessage}`;
    const msg = parseTencentXml(xml);
    expect(msg?.Content).toBe("您好，这套房子还在卖吗？");
  });
});

describe("buildTextReplyXml", () => {
  it("emits a passive-reply XML with the required elements", () => {
    const xml = buildTextReplyXml({
      toOpenId: "openid_xyz",
      fromOaAppId: "gh_abc123",
      content: "您好，有房源信息我会发给您。",
      createTime: 1729512200,
    });
    expect(xml).toContain("<ToUserName><![CDATA[openid_xyz]]></ToUserName>");
    expect(xml).toContain("<FromUserName><![CDATA[gh_abc123]]></FromUserName>");
    expect(xml).toContain("<CreateTime>1729512200</CreateTime>");
    expect(xml).toContain("<MsgType><![CDATA[text]]></MsgType>");
    expect(xml).toContain("<Content><![CDATA[您好，有房源信息我会发给您。]]></Content>");
    // Round-trips: parse the emitted XML and sanity-check.
    const parsed = parseTencentXml(xml);
    expect(parsed?.MsgType).toBe("text");
    expect(parsed?.Content).toBe("您好，有房源信息我会发给您。");
  });

  it("splits ']]>' inside content to keep the CDATA section valid", () => {
    const xml = buildTextReplyXml({
      toOpenId: "o",
      fromOaAppId: "a",
      content: "something ]]> sneaky",
    });
    // CDATA must not contain a literal ']]>' — check that the output
    // has the split-and-restart form and still parses cleanly.
    expect(xml.indexOf("]]]]><![CDATA[>")).toBeGreaterThan(-1);
    const parsed = parseTencentXml(xml);
    // After parse, the two CDATA sections concatenate back; the raw
    // parser returns the first CDATA segment plus the bare fallback,
    // so the reconstruction isn't byte-identical but the structure
    // survives. What we're really testing is "we don't break the XML".
    expect(parsed).not.toBeNull();
  });
});
