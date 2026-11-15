import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn(), alert: vi.fn(), heartbeat: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, GetQueueAttributesCommand: class { constructor(readonly input: unknown) {} } }));
vi.mock("@/lib/db", () => ({ prisma: { curriculumRegenerationRun: { count: vi.fn(async () => 0) } } }));
vi.mock("@/lib/ops/alerts", () => ({ sendOpsAlert: h.alert }));
vi.mock("@/lib/ops/cronHeartbeat", () => ({ recordCronHeartbeat: h.heartbeat }));
import { POST } from "@/app/api/cron/check-dlq/route";

describe("AWS unavailable: DLQ observation cannot report a fabricated empty queue", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "synthetic-local-only");
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    vi.stubEnv("SQS_DLQ_URL", "https://synthetic.invalid/dlq.fifo");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    h.heartbeat.mockResolvedValue(undefined); h.alert.mockResolvedValue(undefined);
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const send = () => POST(new Request("http://local/api/cron/check-dlq", { method: "POST", headers: { authorization: "Bearer synthetic-local-only" } }));
  it("unknown depth refuses a successful check instead of converting null to zero", async () => {
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable"));
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ dlqDepth: null });
    expect(h.heartbeat).not.toHaveBeenCalled();
  });
  it("control: an actually observed zero remains a successful empty DLQ check", async () => {
    h.send.mockResolvedValue({ Attributes: { ApproximateNumberOfMessages: "0", ApproximateNumberOfMessagesNotVisible: "0", ApproximateNumberOfMessagesDelayed: "0" } });
    const response = await send(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ checked: true, dlqDepth: 0, alerted: false });
    expect(h.heartbeat).toHaveBeenCalledOnce();
  });
});
