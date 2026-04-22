import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "mock-id" }),
}));

import { sendAgentWelcomeEmail } from "./welcomeAgent";
import { sendEmail } from "@/lib/email";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSendEmail.mockClear();
});

describe("sendAgentWelcomeEmail", () => {
  it("sends email to the given address", async () => {
    await sendAgentWelcomeEmail({ to: "agent@test.com", name: "John Smith" });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe("agent@test.com");
  });

  it("includes iOS + Android download CTAs in HTML", async () => {
    // The template renders two buttons labeled "Download for iOS" and
    // "Download for Android". Their hrefs come from LEADSMART_IOS_APP_STORE_URL
    // / LEADSMART_ANDROID_PLAY_STORE_URL, which fall back to the dashboard URL
    // when the store listings haven't been published yet. So we assert on the
    // CTA labels (stable) rather than on host names (env-dependent).
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "Jane" });
    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain("Download for iOS");
    expect(html).toContain("Download for Android");
  });

  it("includes dashboard link", async () => {
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "Jane" });
    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain("/dashboard");
  });

  it("extracts first name for greeting", async () => {
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "Michael Ye" });
    const text = mockSendEmail.mock.calls[0][0].text;
    expect(text).toContain("Hi Michael");
  });

  it("uses fallback name when empty", async () => {
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "" });
    const text = mockSendEmail.mock.calls[0][0].text;
    expect(text).toContain("Hi there");
  });

  it("subject mentions LeadSmart AI", async () => {
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "Test" });
    expect(mockSendEmail.mock.calls[0][0].subject).toContain("LeadSmart AI");
  });
});
