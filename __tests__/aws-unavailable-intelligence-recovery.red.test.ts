import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn(), detect: vi.fn(), transition: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
vi.mock("@/lib/db", () => ({ prisma: {
  studentPerformanceEvent: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "synthetic-event" })) },
  workflowRun: { findMany: vi.fn(async () => [{ id: "synthetic-run", workflowType: "synthetic", partitionKey: "synthetic-school", attempt: 1, maxAttempts: 3 }]) },
} }));
vi.mock("@/lib/intelligence/confusionScheduler", () => ({ runConfusionDetectionForStudent: h.detect }));
vi.mock("@/lib/autonomous/workflowStateManager", () => ({ transitionWorkflowStatus: h.transition }));
vi.mock("@/lib/serverFlags", () => ({ isWorkflowRecoveryCronEnabled: () => true }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
import { recordPerformanceEvent } from "@/lib/intelligence/recordPerformanceEvent";
import { requeueRetryableWorkflows } from "@/lib/autonomous/runtime/workflowRecoveryService";

describe("AWS unavailable: optional intelligence and recovery dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo"); vi.stubEnv("ENABLE_PERFORMANCE_EVENTS", "true");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable")); h.transition.mockResolvedValue(undefined); h.detect.mockResolvedValue(undefined);
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("recovery cannot count a rejected delivery as requeued", async () => {
    expect(await requeueRetryableWorkflows()).toMatchObject({ requeued: 0 });
  });
  it("confusion detection uses its synthetic inline fallback after rejected delivery", async () => {
    await recordPerformanceEvent({ studentId: "synthetic-student", schoolId: "synthetic-school", subject: "MATH", gradeLevel: 4, eventType: "quiz", score: 1, durationSeconds: 1, attempts: 1, aiAssistUsed: false });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(h.send).toHaveBeenCalledOnce(); expect(h.detect).toHaveBeenCalledOnce();
  });
});
