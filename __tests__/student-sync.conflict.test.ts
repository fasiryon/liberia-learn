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
    student: {
      findUnique: vi.fn(),
    },
    scheduledWork: {
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
    labSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
import { logLearningEvent } from "@/lib/events/logLearningEvent";

describe("student sync conflict detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.student.findUnique as any).mockResolvedValue({ id: "student-rec-1", userId: "student-1" });
    (prisma.student as any).findFirst = vi.fn().mockResolvedValue({ id: "student-rec-1" });
    (prisma.scheduledWork.findFirst as any).mockResolvedValue({ id: "sw-1" });
  });

  function observation(overrides: Record<string, unknown> = {}) {
    return {
      protocolVersion: 1,
      operationId: "observation-1",
      learnerId: "student-1",
      schoolId: "school-1",
      resourceType: "learning_observation",
      resourceId: "g4-frac-diagnostic-equal-parts",
      operationType: "learning_observation.append",
      payload: {
        itemId: "g4-frac-diagnostic-equal-parts",
        itemVersion: "1.0.0",
        hintsUsed: 0,
        aiAssisted: false,
      },
      clientCreatedAt: "2026-09-12T12:00:00.000Z",
      idempotencyKey: "observation-1",
      dependencyIds: [],
      ...overrides,
    };
  }

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
    expect(data.results[0].status).toBe("rejected");
    expect(prisma.studentProgress.upsert).not.toHaveBeenCalled();
  });

  it("records an offline learning observation as raw telemetry only", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, items: [observation()] }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results[0]).toMatchObject({ status: "synced", resolutionHint: "raw_observation_recorded" });
    expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
      studentId: "student-rec-1",
      eventType: "learning.observation.received",
      status: "raw_observation",
      metadata: expect.objectContaining({ evidenceAdmission: "NOT_AUTOMATIC" }),
    }), { throwOnError: true });
  });

  it("rejects offline mastery claims and cross-tenant observations", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
    const masteryClaim = observation({
      payload: { itemId: "g4-frac-diagnostic-equal-parts", masteryScore: 1 },
    });
    const crossTenant = observation({ operationId: "observation-2", idempotencyKey: "observation-2", schoolId: "school-2" });
    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, items: [masteryClaim, crossTenant] }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results.map((result: { resolutionHint: string }) => result.resolutionHint)).toEqual([
      "offline_client_cannot_assert_mastery",
      "tenant_or_student_identity_mismatch",
    ]);
    expect(logLearningEvent).not.toHaveBeenCalled();
  });

  it("deduplicates an offline observation against the raw-observation event type", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue({
      id: "event-1",
      metadata: { operationFingerprint: "different-is-rejected" },
    });
    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, items: [observation()] }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect((prisma.learningEvent.findFirst as any).mock.calls[0][0].where.eventType).toBe("learning.observation.received");
    expect(data.results[0].status).toBe("rejected");
    expect(logLearningEvent).not.toHaveBeenCalled();
  });

  it("keeps an offline lab score provisional and cannot set mastery", async () => {
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
    (prisma.labSession.findUnique as any).mockResolvedValue({
      id: "lab-session-1",
      studentId: "student-1",
      schoolId: "school-1",
      completedAt: null,
    });
    const req = new Request("http://localhost/api/student/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocolVersion: 1,
        items: [{
          protocolVersion: 1,
          operationId: "lab-observation-1",
          learnerId: "student-1",
          schoolId: "school-1",
          resourceType: "lab_session",
          resourceId: "lab-session-1",
          operationType: "lab_session.merge",
          payload: { score: 100, completedAt: "2026-09-12T12:00:00.000Z", masteryUpdated: true },
          clientCreatedAt: "2026-09-12T12:00:00.000Z",
          idempotencyKey: "lab-observation-1",
          dependencyIds: [],
        }],
      }),
    });

    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect(prisma.labSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ score: 100, masteryUpdated: false }),
    }));
    expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
      status: "provisional",
      metadata: expect.objectContaining({ evidenceAdmission: "NOT_AUTOMATIC", masteryUpdated: false }),
    }));
  });
});
