import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFind: vi.fn(),
  sessionUpdate: vi.fn(),
  responseCreate: vi.fn(),
  submissionUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {
  smsSession: { findFirst: mocks.sessionFind, update: mocks.sessionUpdate },
  smsResponse: { create: mocks.responseCreate },
  assignmentSubmission: { upsert: mocks.submissionUpsert },
} }));
vi.mock("@/lib/sms", () => ({ sendSMS: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn().mockResolvedValue({}) }));

import { POST } from "@/app/api/webhooks/sms-reply/route";

const originalSecret = process.env.AT_WEBHOOK_SECRET;
function request(raw: string, signature?: string) {
  return new Request("http://localhost/api/webhooks/sms-reply", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(signature ? { "x-at-signature": signature } : {}) },
    body: raw,
  }) as never;
}
function sign(raw: string) { return createHmac("sha256", "secret").update(raw).digest("hex"); }

describe("SMS reply webhook authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AT_WEBHOOK_SECRET = "secret";
    mocks.sessionFind.mockResolvedValue(null);
  });
  afterEach(() => originalSecret === undefined ? delete process.env.AT_WEBHOOK_SECRET : process.env.AT_WEBHOOK_SECRET = originalSecret);

  it.each([
    ["unsigned", "from=%2B231770000111&text=A&id=1", undefined, 401],
    ["bad signature", "from=%2B231770000111&text=A&id=1", "bad", 401],
    ["tampered body", "from=%2B231770000111&text=B&id=1", sign("from=%2B231770000111&text=A&id=1"), 401],
  ])("rejects %s before any grade-affecting write", async (_name, raw, signature, status) => {
    const res = await POST(request(raw, signature));
    expect(res.status).toBe(status);
    expect(mocks.responseCreate).not.toHaveBeenCalled();
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
    expect(mocks.submissionUpsert).not.toHaveBeenCalled();
  });

  it("accepts a valid signature and preserves provider flow", async () => {
    const raw = "from=%2B231770000111&text=A&id=valid-1";
    const res = await POST(request(raw, sign(raw)));
    expect(res.status).toBe(200);
    expect(mocks.sessionFind).toHaveBeenCalledOnce();
  });

  it("fails closed without the production secret", async () => {
    delete process.env.AT_WEBHOOK_SECRET;
    const raw = "from=%2B231770000111&text=A&id=1";
    const res = await POST(request(raw, sign(raw)));
    expect(res.status).toBe(503);
    expect(mocks.submissionUpsert).not.toHaveBeenCalled();
  });

  it("rejects malformed authenticated payload before mutation", async () => {
    const raw = "text=A&id=1";
    const res = await POST(request(raw, sign(raw)));
    expect(res.status).toBe(400);
    expect(mocks.submissionUpsert).not.toHaveBeenCalled();
  });

  it("rejects replay before session or grade mutation", async () => {
    const raw = "from=%2B231770000111&text=A&id=replay-1";
    await POST(request(raw, sign(raw)));
    const res = await POST(request(raw, sign(raw)));
    expect(res.status).toBe(409);
    expect(mocks.sessionFind).toHaveBeenCalledOnce();
    expect(mocks.submissionUpsert).not.toHaveBeenCalled();
  });
});
