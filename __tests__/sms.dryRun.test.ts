import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger so we can verify DryRunSMSProvider logs
const mockLoggerInfo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { info: mockLoggerInfo, warn: vi.fn(), error: vi.fn() },
}));

import { DryRunSMSProvider } from "@/lib/sms/dry-run-provider";

describe("DryRunSMSProvider", () => {
  let provider: DryRunSMSProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DryRunSMSProvider();
  });

  it('has name "dry-run"', () => {
    expect(provider.name).toBe("dry-run");
  });

  it("returns ok:true without sending", async () => {
    const result = await provider.send({ to: "+231555000001", body: "Test message" });
    expect(result.ok).toBe(true);
  });

  it("returns a dry-run prefixed providerMessageId", async () => {
    const result = await provider.send({ to: "+231555000001", body: "Test" });
    expect(result.providerMessageId).toMatch(/^dry-run-/);
  });

  it("logs the intended send without revealing full phone number", async () => {
    await provider.send({ to: "+231555000001", body: "Absence alert" });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining("SMS not sent"),
      expect.objectContaining({ to: expect.stringContaining("****") })
    );
  });

  it("normalizeError returns retryable:false", () => {
    const result = provider.normalizeError(new Error("some error"));
    expect(result.retryable).toBe(false);
    expect(result.message).toBe("some error");
  });
});

describe("sendSMS — dry-run gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("routes to dry-run provider when ENABLE_LIVE_SMS is not set", async () => {
    delete process.env.ENABLE_LIVE_SMS;
    const { sendSMS } = await import("@/lib/sms");
    const result = await sendSMS("+231555000001", "Test message");
    expect(result.ok).toBe(true);
    expect(result.sid).toMatch(/^dry-run-/);
  });

  it("routes to dry-run provider when ENABLE_LIVE_SMS=false", async () => {
    process.env.ENABLE_LIVE_SMS = "false";
    const { sendSMS } = await import("@/lib/sms");
    const result = await sendSMS("+231555000001", "Test message");
    expect(result.ok).toBe(true);
    expect(result.sid).toMatch(/^dry-run-/);
    delete process.env.ENABLE_LIVE_SMS;
  });
});
