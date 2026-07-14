import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrangeSMSProvider } from "@/lib/sms/providers/orange";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("OrangeSMSProvider", () => {
  beforeEach(() => {
    process.env.ORANGE_CLIENT_ID = "client-id";
    process.env.ORANGE_CLIENT_SECRET = "client-secret";
    process.env.ORANGE_SENDER_NUMBER = "+231770000000";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("isConfigured", () => {
    it("is true when all three env vars are set", () => {
      expect(OrangeSMSProvider.isConfigured()).toBe(true);
    });

    it("is false when any of the three is missing", () => {
      delete process.env.ORANGE_SENDER_NUMBER;
      expect(OrangeSMSProvider.isConfigured()).toBe(false);
    });
  });

  describe("send (with an injected fetchImpl - never touches the real network)", () => {
    it("fetches an OAuth2 token via client-credentials, then sends via Bearer auth", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-1", expires_in: "3600", token_type: "Bearer" }))
        .mockResolvedValueOnce(
          jsonResponse(201, {
            outboundSMSMessageRequest: {
              resourceURL: "https://api.orange.com/smsmessaging/v1/outbound/tel:+231770000111/requests/msg-1",
            },
          })
        );
      const provider = new OrangeSMSProvider({ fetchImpl });

      const result = await provider.send({ to: "+231770000111", body: "hi" });

      expect(result).toEqual({ ok: true, providerMessageId: "msg-1" });
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
      expect(tokenUrl).toBe("https://api.orange.com/oauth/v3/token");
      expect(tokenInit.headers.Authorization).toMatch(/^Basic /);
      expect(tokenInit.body).toBe("grant_type=client_credentials");

      const [sendUrl, sendInit] = fetchImpl.mock.calls[1];
      expect(sendUrl).toContain("tel%3A%2B231770000000/requests");
      expect(sendInit.headers.Authorization).toBe("Bearer tok-1");
      const sentBody = JSON.parse(sendInit.body);
      expect(sentBody.outboundSMSMessageRequest.address).toBe("tel:+231770000111");
      expect(sentBody.outboundSMSMessageRequest.outboundSMSTextMessage.message).toBe("hi");
    });

    it("caches the token across sends within its validity window", async () => {
      let now = 1_000_000;
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-1", expires_in: "3600" }))
        .mockResolvedValueOnce(jsonResponse(201, { outboundSMSMessageRequest: { resourceURL: "x/requests/m1" } }))
        .mockResolvedValueOnce(jsonResponse(201, { outboundSMSMessageRequest: { resourceURL: "x/requests/m2" } }));
      const provider = new OrangeSMSProvider({ fetchImpl, now: () => now });

      await provider.send({ to: "+231770000111", body: "one" });
      now += 1000; // well within the 1h token lifetime
      await provider.send({ to: "+231770000111", body: "two" });

      expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 token fetch + 2 sends, not 2 token fetches
    });

    it("fetches a new token once the cached one expires", async () => {
      let now = 1_000_000;
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-1", expires_in: "3600" }))
        .mockResolvedValueOnce(jsonResponse(201, { outboundSMSMessageRequest: { resourceURL: "x/requests/m1" } }))
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-2", expires_in: "3600" }))
        .mockResolvedValueOnce(jsonResponse(201, { outboundSMSMessageRequest: { resourceURL: "x/requests/m2" } }));
      const provider = new OrangeSMSProvider({ fetchImpl, now: () => now });

      await provider.send({ to: "+231770000111", body: "one" });
      now += 3600 * 1000; // past the 1h token lifetime
      await provider.send({ to: "+231770000111", body: "two" });

      expect(fetchImpl).toHaveBeenCalledTimes(4); // 2 token fetches + 2 sends
    });

    it("returns ok:false when the token request fails", async () => {
      const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(401, {}));
      const provider = new OrangeSMSProvider({ fetchImpl });

      const result = await provider.send({ to: "+231770000111", body: "hi" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("401");
    });

    it("returns ok:false and retryable:true on a 5xx send failure", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-1", expires_in: "3600" }))
        .mockResolvedValueOnce(jsonResponse(503, {}));
      const provider = new OrangeSMSProvider({ fetchImpl });

      const result = await provider.send({ to: "+231770000111", body: "hi" });

      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it("fails without hitting the network when credentials are unset", async () => {
      delete process.env.ORANGE_CLIENT_ID;
      const fetchImpl = vi.fn();
      const provider = new OrangeSMSProvider({ fetchImpl });

      const result = await provider.send({ to: "+231770000111", body: "hi" });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("not configured");
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
