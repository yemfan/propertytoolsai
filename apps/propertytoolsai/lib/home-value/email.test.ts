import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendHomeValueReportEmail } from "./email";
import { sendEmail } from "@/lib/email";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSendEmail.mockClear();
});

describe("sendHomeValueReportEmail", () => {
  it("calls sendEmail with correct recipient", async () => {
    await sendHomeValueReportEmail({
      to: "buyer@test.com",
      name: "Jane Doe",
      address: "123 Main St, LA, CA 90001",
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe("buyer@test.com");
  });

  it("includes property address in subject", async () => {
    await sendHomeValueReportEmail({
      to: "a@b.com",
      name: "Test",
      address: "456 Oak Ave",
    });
    expect(mockSendEmail.mock.calls[0][0].subject).toContain("456 Oak Ave");
  });

  it("includes address in HTML body", async () => {
    await sendHomeValueReportEmail({
      to: "a@b.com",
      name: "Test",
      address: "789 Pine Rd",
    });
    expect(mockSendEmail.mock.calls[0][0].html).toContain("789 Pine Rd");
  });

  it("extracts first name for greeting", async () => {
    await sendHomeValueReportEmail({
      to: "a@b.com",
      name: "Michael Ye",
      address: "123 St",
    });
    expect(mockSendEmail.mock.calls[0][0].text).toContain("Hi Michael");
  });

  it("includes report URL when provided", async () => {
    await sendHomeValueReportEmail({
      to: "a@b.com",
      name: "Test",
      address: "123 St",
      reportUrl: "/reports/home-value/abc.pdf",
    });
    expect(mockSendEmail.mock.calls[0][0].html).toContain("/reports/home-value/abc.pdf");
  });

  it("returns success", async () => {
    const result = await sendHomeValueReportEmail({
      to: "a@b.com",
      name: "Test",
      address: "123 St",
    });
    expect(result.success).toBe(true);
  });
});
