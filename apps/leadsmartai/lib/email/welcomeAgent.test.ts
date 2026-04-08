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

  it("includes app store links in HTML", async () => {
    await sendAgentWelcomeEmail({ to: "a@b.com", name: "Jane" });
    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain("apps.apple.com");
    expect(html).toContain("play.google.com");
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
