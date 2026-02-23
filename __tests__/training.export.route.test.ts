import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
    schoolId: "school-1",
    isPlatformAdmin: true,
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    trainingModule: { findMany: vi.fn() },
    teacherTrainingProgress: { findMany: vi.fn() },
    exportRecord: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: vi.fn(),
}));

import { GET } from "@/app/api/admin/training/export/route";
import { prisma } from "@/lib/db";

describe("training export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates ExportRecord and AuditLog", async () => {
    (prisma.trainingModule.findMany as any).mockResolvedValue([
      { id: "m1", code: "W0", title: "Week 0" },
    ]);
    (prisma.teacherTrainingProgress.findMany as any).mockResolvedValue([
      { moduleId: "m1", status: "COMPLETED", teacherId: "t1" },
    ]);
    (prisma.exportRecord.create as any).mockResolvedValue({ id: "exp-1" });
    (prisma.auditLog.create as any).mockResolvedValue({ id: "audit-1" });

    const req = new Request(
      "http://localhost/api/admin/training/export?scope=school&scopeId=school-1&format=csv"
    );
    const res = await GET(req as any);

    expect(res.status).toBe(200);
    expect(prisma.exportRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exportType: "training_summary",
          scope: "school",
          scopeId: "school-1",
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
