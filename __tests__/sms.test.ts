import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sendSMS", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("logs to console when no Twilio credentials", async () => {
    // Ensure env vars are not set
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendSMS } = await import("@/lib/sms");

    const result = await sendSMS("+231770000000", "Test message");

    expect(result.ok).toBe(true);
    expect(result.sid).toBe("dev-no-send");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
