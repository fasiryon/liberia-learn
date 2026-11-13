import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ depths: vi.fn(), alert: vi.fn(), heartbeat: vi.fn() }));
vi.mock("@/lib/ops/queueDepths", () => ({ getQueueDepths: h.depths }));
vi.mock("@/lib/ops/alerts", () => ({ sendOpsAlert: h.alert }));
vi.mock("@/lib/ops/cronHeartbeat", () => ({ recordCronHeartbeat: h.heartbeat }));
import { POST } from "@/app/api/cron/check-dlq/route";

describe("AWS unavailable: DLQ observation cannot report a fabricated empty queue", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "synthetic-local-only");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    h.heartbeat.mockResolvedValue(undefined); h.alert.mockResolvedValue(undefined);
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const send = () => POST(new Request("http://local/api/cron/check-dlq", { method: "POST", headers: { authorization: "Bearer synthetic-local-only" } }));
  it("unknown depth refuses a successful check instead of converting null to zero", async () => {
    h.depths.mockResolvedValue({ dlq: { configured: true, depth: null } });
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ dlqDepth: null });
    expect(h.heartbeat).not.toHaveBeenCalled();
  });
  it("control: an actually observed zero remains a successful empty DLQ check", async () => {
    h.depths.mockResolvedValue({ dlq: { configured: true, depth: 0 } });
    const response = await send(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ checked: true, dlqDepth: 0, alerted: false });
    expect(h.heartbeat).toHaveBeenCalledOnce();
  });
});
