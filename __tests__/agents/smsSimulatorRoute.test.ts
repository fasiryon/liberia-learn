import { describe, it, expect, afterEach } from "vitest";
import { POST } from "@/app/api/dev/simulate-inbound-sms/route";

const original = process.env.NODE_ENV;
afterEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = original;
});
function setEnv(v: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = v;
}

function req(body: unknown) {
  return new Request("http://x/api/dev/simulate-inbound-sms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/dev/simulate-inbound-sms", () => {
  it("is not accessible in production (404)", async () => {
    setEnv("production");
    const res = await POST(req({ from: "+231770000111", text: "hi" }));
    expect(res.status).toBe(404);
  });

  it("returns the normalized inbound in non-production", async () => {
    setEnv("development");
    const res = await POST(req({ from: "+231 770 000 111", text: "  How is my son  " }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received.normalizedFrom).toBe("+231770000111");
    expect(json.received.text).toBe("How is my son");
    // no SMS-facing agent wired yet
    expect(json.handled).toBe(false);
  });

  it("returns 400 when the body is invalid", async () => {
    setEnv("development");
    const res = await POST(req({ from: "", text: "hi" }));
    expect(res.status).toBe(400);
  });
});
