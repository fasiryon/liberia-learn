import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn(), run: {
  id: "synthetic-run", workflowType: "synthetic", partitionKey: "synthetic-school", status: "failed",
  attempt: 1, maxAttempts: 3, nextRetryAt: null as Date | null, traceId: "synthetic-trace",
} }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
vi.mock("@/lib/db", () => ({ prisma: {
  workflowRun: {
    findMany: vi.fn(async ({ where }: { where: { status: string } }) => h.run.status === where.status && h.run.nextRetryAt !== null ? [{ ...h.run }] : []),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (typeof data.status === "string") h.run.status = data.status;
      if (data.nextRetryAt === null || data.nextRetryAt instanceof Date) h.run.nextRetryAt = data.nextRetryAt;
      return { ...h.run };
    }),
  },
  workflowCheckpoint: { count: vi.fn(async () => 0), upsert: vi.fn(async () => ({ id: "synthetic-checkpoint" })) },
} }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: async (_name: string, operation: () => Promise<unknown>) => operation() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/serverFlags", () => ({ isWorkflowRecoveryCronEnabled: () => true }));
// Actual recovery, orchestrator, queue and state manager all run. Only the DB
// delegate and SDK transport are synthetic. This is not a native SQL receipt.
import { requeueRetryableWorkflows } from "@/lib/autonomous/runtime/workflowRecoveryService";

describe("R3 independent review: failed dispatch remains recoverable", () => {
  beforeEach(() => {
    vi.clearAllMocks(); h.run.status = "failed"; h.run.nextRetryAt = new Date(0);
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("does not erase the failed retry state when SQS rejects recovery", async () => {
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable"));
    const first = await requeueRetryableWorkflows(); const second = await requeueRetryableWorkflows();
    expect(first).toMatchObject({ requeued: 0, skipped: 1 });
    expect({ status: h.run.status, retryScheduled: h.run.nextRetryAt !== null, second }).toMatchObject({ status: "failed", retryScheduled: true, second: { requeued: 0, skipped: 1 } });
  });
  it("control: accepted delivery is counted once", async () => {
    h.send.mockResolvedValue({}); expect(await requeueRetryableWorkflows()).toMatchObject({ requeued: 1, skipped: 0 });
    expect(h.send).toHaveBeenCalledOnce();
  });
});
