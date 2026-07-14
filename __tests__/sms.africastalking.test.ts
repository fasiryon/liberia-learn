import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AfricasTalkingSMSProvider } from "@/lib/sms/providers/africastalking";

const ORIGINAL_ENV = { ...process.env };

describe("AfricasTalkingSMSProvider", () => {
  beforeEach(() => {
    delete process.env.AT_API_KEY;
    delete process.env.AT_USERNAME;
    delete process.env.AFRICA_TALKING_API_KEY;
    delete process.env.AFRICA_TALKING_USERNAME;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("isConfigured", () => {
    it("is false when no credentials are set", () => {
      expect(AfricasTalkingSMSProvider.isConfigured()).toBe(false);
    });

    it("is true when AT_API_KEY and AT_USERNAME are both set", () => {
      process.env.AT_API_KEY = "key";
      process.env.AT_USERNAME = "user";
      expect(AfricasTalkingSMSProvider.isConfigured()).toBe(true);
    });

    it("is false when only one of the two is set", () => {
      process.env.AT_API_KEY = "key";
      expect(AfricasTalkingSMSProvider.isConfigured()).toBe(false);
    });
  });

  describe("send (with an injected sendFn - never touches the real SDK or network)", () => {
    it("returns ok:true on a successful send", async () => {
      const sendFn = vi.fn().mockResolvedValue({
        SMSMessageData: { Recipients: [{ statusCode: 101, messageId: "msg-1", status: "Success" }] },
      });
      const provider = new AfricasTalkingSMSProvider({ sendFn });
      const result = await provider.send({ to: "+231770000111", body: "hi" });
      expect(result).toEqual({ ok: true, providerMessageId: "msg-1", error: undefined });
      expect(sendFn).toHaveBeenCalledWith(expect.objectContaining({ to: ["+231770000111"], message: "hi" }));
    });

    it("returns ok:false when the recipient status code is an error", async () => {
      const sendFn = vi.fn().mockResolvedValue({
        SMSMessageData: { Recipients: [{ statusCode: 401, status: "InvalidSenderId" }] },
      });
      const provider = new AfricasTalkingSMSProvider({ sendFn });
      const result = await provider.send({ to: "+231770000111", body: "hi" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("InvalidSenderId");
    });

    it("returns ok:false and a normalized retryable error when the SDK throws a timeout", async () => {
      const sendFn = vi.fn().mockRejectedValue(new Error("network timeout"));
      const provider = new AfricasTalkingSMSProvider({ sendFn });
      const result = await provider.send({ to: "+231770000111", body: "hi" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("fails without hitting the network when no sendFn is injected and credentials are unset", async () => {
      const provider = new AfricasTalkingSMSProvider();
      const result = await provider.send({ to: "+231770000111", body: "hi" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not configured");
    });
  });
});
