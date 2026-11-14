import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn(), dispatch: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class { send = h.send; },
  ReceiveMessageCommand: class { kind = "receive"; constructor(readonly input: unknown) {} },
  DeleteMessageCommand: class { kind = "delete"; constructor(readonly input: unknown) {} },
  SendMessageCommand: class { kind = "send"; constructor(readonly input: unknown) {} },
}));
vi.mock("@/worker/handlers", () => ({ dispatchJob: h.dispatch }));
vi.mock("@/lib/cloudwatch", () => ({ publishMetric: vi.fn(async () => undefined) }));
vi.mock("@/worker/sentry", () => ({ initWorkerSentry: vi.fn(), Sentry: { captureException: vi.fn() } }));
describe("AWS redrive unavailable: local worker retry boundary proposal", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo"); vi.stubEnv("SQS_DLQ_URL", "");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("does not execute the handler again beyond its three-receive budget without a DLQ", async () => {
    h.send.mockImplementation(async command => command.kind === "receive" ? { Messages: [{ Body: JSON.stringify({ jobType: "SEND_SMS", payload: {} }), ReceiptHandle: "synthetic-handle", Attributes: { ApproximateReceiveCount: "4" } }] } : {});
    h.dispatch.mockRejectedValue(Error("Synthetic handler unavailable"));
    const { pollOnce } = await import("@/worker/index"); await pollOnce(); await pollOnce();
    expect(h.dispatch).not.toHaveBeenCalled();
  });
  it("control: a first delivery succeeds and is acknowledged after actual handler completion", async () => {
    h.send.mockImplementation(async command => command.kind === "receive" ? { Messages: [{ Body: JSON.stringify({ jobType: "SEND_SMS", payload: {} }), ReceiptHandle: "synthetic-handle", Attributes: { ApproximateReceiveCount: "1" } }] } : {});
    h.dispatch.mockResolvedValue({ status: "ok" });
    const { pollOnce } = await import("@/worker/index"); await pollOnce();
    expect(h.dispatch).toHaveBeenCalledOnce();
    expect(h.send.mock.calls.filter(([command]) => command.kind === "delete")).toHaveLength(1);
  });
});
