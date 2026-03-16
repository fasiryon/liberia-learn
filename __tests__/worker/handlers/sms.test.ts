import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendSMS = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sms", () => ({
  sendSMS: mockSendSMS,
}));

import { handleSendSmsJob } from "@/worker/handlers/sms";

describe("handleSendSmsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends SMS through the shared helper", async () => {
    mockSendSMS.mockResolvedValue({ ok: true, sid: "msg-1" });

    await expect(
      handleSendSmsJob({ to: "+231770000000", body: "Test message" })
    ).resolves.toEqual({ ok: true, sid: "msg-1" });

    expect(mockSendSMS).toHaveBeenCalledWith("+231770000000", "Test message");
  });

  it("throws when the helper reports failure", async () => {
    mockSendSMS.mockResolvedValue({ ok: false, error: "provider failed" });

    await expect(
      handleSendSmsJob({ to: "+231770000000", body: "Test message" })
    ).rejects.toThrow("provider failed");
  });
});
