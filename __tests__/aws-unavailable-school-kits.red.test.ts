import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const h = vi.hoisted(() => ({ send: vi.fn(), audit: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
vi.mock("@/lib/db", () => ({ prisma: { school: { create: vi.fn(async () => ({ id: "synthetic-school", name: "Synthetic" })), update: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => ({ id: "synthetic-admin", schoolId: "synthetic-school" })) }));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: vi.fn(async () => ({ id: "synthetic-platform" })) }));
vi.mock("@/lib/permissions", () => ({ assertPermission: vi.fn(), PERMISSIONS: { SCHOOL_CREATE: "SCHOOL_CREATE" } }));
vi.mock("@/lib/audit", () => ({ logAudit: h.audit }));
import { POST as adminCreate } from "@/app/api/admin/schools/route";
import { POST as platformCreate } from "@/app/api/platform/schools/route";

describe("AWS unavailable: optional school kit acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("ENABLE_SCHOOL_ONBOARDING_KITS", "true");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable")); h.audit.mockResolvedValue(undefined);
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each(["admin", "platform"])("%s school creation must not audit a rejected kit as enqueued", async route => {
    const form = new FormData(); form.set("name", "Synthetic");
    const request = route === "admin"
      ? new NextRequest("http://local/api/admin/schools", { method: "POST", body: form })
      : new NextRequest("http://local/api/platform/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Synthetic" }) });
    await (route === "admin" ? adminCreate(request) : platformCreate(request));
    expect(h.send).toHaveBeenCalledOnce();
    expect(h.audit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "school.onboarding_kit.enqueued" }));
  });
});
