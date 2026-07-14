import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockRecordSmsSendFailure } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockRecordSmsSendFailure: vi.fn(),
}));

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

describe("sendSMS - live failure tracking (Orange fallback behavior, approved)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/serverFlags", () => ({ isLiveSmsEnabled: () => true }));
    vi.doMock("@/lib/sms/providers/twilio", () => ({
      TwilioSMSProvider: class {
        name = "twilio";
        send = mockSend;
      },
    }));
    vi.doMock("@/lib/sms/failureTracking", () => ({ recordSmsSendFailure: mockRecordSmsSendFailure }));
    mockSend.mockReset();
    mockRecordSmsSendFailure.mockReset();
    delete process.env.SMS_PROVIDER;
  });

  it("records a failure (alert) and does not fall back to another provider", async () => {
    mockSend.mockResolvedValue({ ok: false, error: "HTTP 503", retryable: true });
    const { sendSMS } = await import("@/lib/sms");

    const result = await sendSMS("+231770000000", "Test message");

    expect(result.ok).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1); // no retry-via-different-provider
    expect(mockRecordSmsSendFailure).toHaveBeenCalledWith(
      "twilio",
      expect.objectContaining({ scope: "national" }),
      expect.objectContaining({ error: "HTTP 503" })
    );
  });

  it("does not record a failure on a successful send", async () => {
    mockSend.mockResolvedValue({ ok: true, providerMessageId: "sid-1" });
    const { sendSMS } = await import("@/lib/sms");

    await sendSMS("+231770000000", "Test message");

    expect(mockRecordSmsSendFailure).not.toHaveBeenCalled();
  });
});

describe("selectSmsProvider / selectTwoWaySmsProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SMS_PROVIDER;
  });

  it("selectSmsProvider returns Orange when explicitly selected", async () => {
    process.env.SMS_PROVIDER = "orange";
    const { selectSmsProvider } = await import("@/lib/sms");
    expect(selectSmsProvider().name).toBe("orange");
  });

  it("selectTwoWaySmsProvider NEVER returns Orange, even when SMS_PROVIDER=orange is set globally", async () => {
    process.env.SMS_PROVIDER = "orange";
    const { selectTwoWaySmsProvider } = await import("@/lib/sms");
    expect(selectTwoWaySmsProvider().name).not.toBe("orange");
  });

  it("selectTwoWaySmsProvider respects an explicit non-Orange selection", async () => {
    process.env.SMS_PROVIDER = "twilio";
    const { selectTwoWaySmsProvider } = await import("@/lib/sms");
    expect(selectTwoWaySmsProvider().name).toBe("twilio");
  });

  it("both default to the same Twilio/AT auto-detect when SMS_PROVIDER is unset", async () => {
    const { selectSmsProvider, selectTwoWaySmsProvider } = await import("@/lib/sms");
    expect(selectSmsProvider().name).toBe(selectTwoWaySmsProvider().name);
  });
});
