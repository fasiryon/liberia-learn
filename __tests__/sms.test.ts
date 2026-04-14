import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sendSMS", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ENABLE_LIVE_SMS;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it("routes to dry-run provider when ENABLE_LIVE_SMS is not set (Sprint 5 gate)", async () => {
    // Sprint 5: sendSMS uses DryRunSMSProvider by default (ENABLE_LIVE_SMS not set).
    // The old Twilio dev-bypass path ("dev-no-send") is only reached when live SMS is on.
    const { sendSMS } = await import("@/lib/sms");
    const result = await sendSMS("+231770000000", "Test message");

    expect(result.ok).toBe(true);
    expect(result.sid).toMatch(/^dry-run-/);
  });
});
