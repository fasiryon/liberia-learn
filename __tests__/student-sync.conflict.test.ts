import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({
    id: "student-1",
    role: "STUDENT",
    schoolId: "school-1",
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: {
      findFirst: vi.fn(),
    },
    studentProgress: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    attendanceRecord: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    homeworkSubmission: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: vi.fn(),
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn(),
}));

import { POST } from "@/app/api/student/sync/route";
import { prisma } from "@/lib/db";

describe("student sync conflict detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns conflict when client version is stale", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
    (prisma.studentProgress.findUnique as any).mockResolvedValue({
      completedAt: new Date("2026-02-20T12:00:10.000Z"),
    });

    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: "op-1",
            entity: "studentProgress",
            scheduledWorkId: "sw-1",
            completedAt: "2026-02-20T12:00:00.000Z",
            clientUpdatedAt: "2026-02-20T12:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results[0].status).toBe("conflict");
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("skips replayed offline events idempotently", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue({ id: "evt-1" });

    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: "op-2",
            entity: "studentProgress",
            scheduledWorkId: "sw-2",
            completedAt: "2026-02-20T12:00:00.000Z",
            clientUpdatedAt: "2026-02-20T12:00:00.000Z",
            clientEventId: "client-2",
          },
        ],
      }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results[0].status).toBe("skipped");
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });
});
