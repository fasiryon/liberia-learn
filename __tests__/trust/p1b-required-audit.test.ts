import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockLogAuditRequired = vi.hoisted(() => vi.fn());

let durableStatus = "pending_approval";

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: mockLogAuditRequired }));
vi.mock("@/lib/serverFlags", () => ({ isCurriculumFeedbackEnabled: () => false }));
vi.mock("@/lib/ai/rag/embeddingService", () => ({ embedLesson: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/rag/ragIngestionService", () => ({
  syncCurriculumContentRagChunks: vi.fn(async () => undefined),
  deleteCurriculumContentRagChunks: vi.fn(async () => undefined),
}));
vi.mock("@/lib/queue", () => ({
  enqueueJob: vi.fn(),
  isQueueConfigured: () => false,
  JobType: { GENERATE_EMBEDDINGS: "GENERATE_EMBEDDINGS" },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => null } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findUnique: mockFindUnique },
    $transaction: vi.fn(async (callback: any) => {
      let stagedStatus = durableStatus;
      const tx = {
        curriculumContent: {
          update: mockUpdate.mockImplementationOnce(async (args: any) => {
            stagedStatus = args.data.status;
            return args.data;
          }),
        },
      };
      const result = await callback(tx);
      durableStatus = stagedStatus;
      return result;
    }),
  },
}));

import { POST } from "@/app/api/admin/curriculum/approve/route";
import { POST as reject } from "@/app/api/admin/curriculum/reject/route";

describe("P1-B required audit transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    durableStatus = "pending_approval";
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    mockFindUnique.mockResolvedValue({
      id: "row-1",
      contentId: "lesson-1",
      grade: 7,
      subject: "MATH",
      status: "pending_approval",
      payload: {},
    });
  });

  it("rolls back curriculum approval when the required audit write fails", async () => {
    mockLogAuditRequired.mockRejectedValue(new Error("audit store unavailable"));

    const response = await POST(new Request("http://localhost/api/admin/curriculum/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentId: "lesson-1" }),
    }));

    expect(response.status).toBe(500);
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockLogAuditRequired).toHaveBeenCalledOnce();
    expect(durableStatus).toBe("pending_approval");
  });

  it("rolls back curriculum rejection when the required audit write fails", async () => {
    mockLogAuditRequired.mockRejectedValue(new Error("audit store unavailable"));

    const response = await reject(new Request("http://localhost/api/admin/curriculum/reject", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentId: "lesson-1", rejectionReason: "Unsafe source" }),
    }));

    expect(response.status).toBe(500);
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockLogAuditRequired).toHaveBeenCalledOnce();
    expect(durableStatus).toBe("pending_approval");
  });
});
