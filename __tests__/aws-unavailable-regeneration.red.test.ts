import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn(), run: vi.fn(), jobs: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  curriculumRegenerationRun: { findUnique: h.run },
  curriculumRegenerationJob: { count: vi.fn(async () => 1), groupBy: vi.fn(async () => []), findMany: h.jobs },
  curriculumRegenerationCheckpoint: { findMany: vi.fn(async () => []) },
} }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/ai/curriculum-factory", () => ({ generateCurriculumPayload: vi.fn() }));
vi.mock("@/lib/serverFlags", () => ({ isCurriculumRegenQueueEnabled: () => true }));
vi.mock("@/lib/curriculum/mutations/repository", () => ({ updateCurriculumContent: vi.fn(), updateCurriculumContentInTransaction: vi.fn() }));
import { enqueuePendingCurriculumRegenerationJobs } from "@/lib/curriculum/regenerationQueue";

describe("AWS unavailable: regeneration dispatch count is evidence based", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    h.run.mockResolvedValue({ id: "synthetic-run", status: "running" });
    h.jobs.mockResolvedValue([{ runId: "synthetic-run", curriculumContentId: "synthetic-content", gradeLevel: 4, subject: "MATH", idempotencyKey: "synthetic-key", attempt: 0 }]);
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("a rejected dispatch cannot increment the enqueued count", async () => {
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable"));
    expect(await enqueuePendingCurriculumRegenerationJobs({ runId: "synthetic-run", gradeLevel: 4, subject: "MATH" })).toMatchObject({ enqueued: 0 });
  });
  it("control: confirmed dispatch counts the accepted job", async () => {
    h.send.mockResolvedValue({});
    expect(await enqueuePendingCurriculumRegenerationJobs({ runId: "synthetic-run", gradeLevel: 4, subject: "MATH" })).toMatchObject({ enqueued: 1 });
  });
});
