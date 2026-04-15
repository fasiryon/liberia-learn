import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSendSMS = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sms", () => ({
  sendSMS: mockSendSMS,
}));

import { sendReliableSms } from "@/lib/sms/reliableSend";

describe("sendReliableSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries retryable failures before succeeding", async () => {
    mockSendSMS
      .mockResolvedValueOnce({ ok: false, error: "temporary network timeout" })
      .mockResolvedValueOnce({ ok: true, sid: "sms-123" });

    const result = await sendReliableSms("+231770000000", "hello", {
      sleep: async () => {},
    });

    expect(result).toEqual({
      ok: true,
      sid: "sms-123",
      error: undefined,
      attempts: 2,
    });
  });

  it("stops on non-retryable failures", async () => {
    mockSendSMS.mockResolvedValueOnce({ ok: false, error: "invalid recipient" });

    const result = await sendReliableSms("+231770000000", "hello", {
      sleep: async () => {},
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
  });
});
