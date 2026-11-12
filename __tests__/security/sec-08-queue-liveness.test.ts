import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ readiness: vi.fn() }));
vi.mock("@/lib/queueReadiness", () => ({ getQueueReadiness: m.readiness }));
import { GET } from "@/app/api/health/queue/route";
beforeEach(() => {
  vi.clearAllMocks(); m.readiness.mockResolvedValue({ configured: true, fifoDetected: true,
    sendPermissions: true, receiveDeletePermissions: true, queueUrl: "https://private.synthetic.invalid/jobs" });
});
describe("SEC-08 public queue liveness", () => {
  it("does not perform an active queue readiness probe", async () => {
    await GET(); expect(m.readiness).not.toHaveBeenCalled();
  });
  it("returns only liveness without infrastructure metadata or readiness claims", async () => {
    const response = await GET(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "alive" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("reports liveness without consulting a failed queue dependency", async () => {
    m.readiness.mockRejectedValue(new Error("synthetic unavailable queue"));
    const response = await GET().catch(() => new Response("failed probe", { status: 500 }));
    expect(response.status).toBe(200); expect(m.readiness).not.toHaveBeenCalled();
  });
});
