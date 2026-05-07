import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireMoeActor = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/moe/authority", () => ({ requireMoeActor: mockRequireMoeActor }));
vi.mock("@/lib/db", () => ({
  prisma: {
    examCertification: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));
vi.mock("@/lib/queue", () => ({
  JobType: { GENERATE_CERTIFICATION_ASSETS: "GENERATE_CERTIFICATION_ASSETS" },
  enqueueJob: mockEnqueueJob,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/serverFlags", () => ({ isCertificationAssetGenerationEnabled: () => true }));

import { POST } from "@/app/api/certifications/generate-assets/route";

describe("certification asset generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockEnqueueJob.mockResolvedValue(undefined);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("blocks unauthorized users", async () => {
    mockRequireMoeActor.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const response = await POST(new Request("http://local/api/certifications/generate-assets", {
      method: "POST",
      body: JSON.stringify({ certificationId: "cert-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("uses persisted certification school for audit tenant scope", async () => {
    mockRequireMoeActor.mockResolvedValue({ user: { id: "moe-1" } });
    mockFindUnique.mockResolvedValue({
      id: "cert-1",
      exam: { schoolId: "school-from-db" },
    });

    const response = await POST(new Request("http://local/api/certifications/generate-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificationId: "cert-1", schoolId: "attacker-school" }),
    }));

    expect(response.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: "moe-1",
      schoolId: "school-from-db",
      resourceId: "cert-1",
    }));
  });
});
