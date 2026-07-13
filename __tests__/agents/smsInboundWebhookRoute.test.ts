import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

const { mockHandleGuardianInbound } = vi.hoisted(() => ({
  mockHandleGuardianInbound: vi.fn(),
}));

vi.mock("@/lib/agents/bootstrap", () => ({}));
vi.mock("@/lib/agents/sms/guardianInbound", () => ({
  handleGuardianInbound: mockHandleGuardianInbound,
}));

import { POST } from "@/app/api/webhooks/sms-inbound/route";

function formReq(fields: Record<string, string>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams(fields).toString();
  return new Request("http://x/api/webhooks/sms-inbound", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  }) as never;
}

const originalSecret = process.env.AT_WEBHOOK_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.AT_WEBHOOK_SECRET;
  else process.env.AT_WEBHOOK_SECRET = originalSecret;
});

describe("POST /api/webhooks/sms-inbound", () => {
  beforeEach(() => {
    mockHandleGuardianInbound.mockReset();
    mockHandleGuardianInbound.mockResolvedValue({
      from: "+231770000111",
      normalizedFrom: "+231770000111",
      handled: true,
      agentStatus: "SUCCESS",
      response: "hi",
      invocationId: "inv-1",
    });
    delete process.env.AT_WEBHOOK_SECRET;
  });

  it("parses Africa's Talking form-urlencoded fields and routes to the guardian handler", async () => {
    const res = await POST(formReq({ from: "+231770000111", text: "Hi", id: "at-msg-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.messageId).toBe("at-msg-1");
    expect(mockHandleGuardianInbound).toHaveBeenCalledWith({ from: "+231770000111", text: "Hi" });
  });

  it("skips signature validation when AT_WEBHOOK_SECRET is not set", async () => {
    const res = await POST(formReq({ from: "+231770000111", text: "Hi" }));
    expect(res.status).toBe(200);
  });

  it("rejects requests with a missing signature when AT_WEBHOOK_SECRET is set", async () => {
    process.env.AT_WEBHOOK_SECRET = "test-secret";
    const res = await POST(formReq({ from: "+231770000111", text: "Hi" }));
    expect(res.status).toBe(401);
    expect(mockHandleGuardianInbound).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid signature", async () => {
    process.env.AT_WEBHOOK_SECRET = "test-secret";
    const res = await POST(
      formReq({ from: "+231770000111", text: "Hi" }, { "x-at-signature": "not-the-right-signature" })
    );
    expect(res.status).toBe(401);
  });

  it("accepts requests with a valid HMAC signature", async () => {
    process.env.AT_WEBHOOK_SECRET = "test-secret";
    const body = new URLSearchParams({ from: "+231770000111", text: "Hi" }).toString();
    const signature = createHmac("sha256", "test-secret").update(body).digest("hex");

    const res = await POST(
      new Request("http://x/api/webhooks/sms-inbound", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-at-signature": signature },
        body,
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockHandleGuardianInbound).toHaveBeenCalled();
  });
});
