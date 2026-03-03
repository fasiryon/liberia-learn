/**
 * __tests__/offline/queue-wiring.test.ts
 *
 * Gap 1: Verifies that the three production routes enqueue the correct
 * offline operations after a successful DB write.
 *
 * Routes under test:
 *   POST /api/student/work/[scheduledWorkId]/complete  → "lesson.completed"
 *   PATCH /api/student/labs/sessions/[sessionId]       → "lab.session.update"
 *   PATCH /api/teacher/schedule/[id]/deliver           → "lesson.delivered"
 *
 * The in-memory queue (lib/offline/offlineQueue.ts) is cleared before each
 * test so assertions are isolated.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearQueue, getQueue } from "@/lib/offline/offlineQueue";

// ─── Shared mock scaffolding ──────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSwFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());
const mockProgressUpsert = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate = vi.hoisted(() => vi.fn());
const mockStrandFindFirst = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockIsLessonDeliveryEnabled = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockUpdateMastery = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/serverFlags", () => ({
  isVirtualLabsEnabled: mockIsVirtualLabsEnabled,
  isLessonDeliveryTrackingEnabled: mockIsLessonDeliveryEnabled,
}));
vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMastery,
}));
vi.mock("@/lib/moe/alignment-engine", () => ({
  gradeToBand: vi.fn().mockReturnValue("G4_6"),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    scheduledWork: {
      findUnique: mockSwFindUnique,
      update: vi.fn().mockResolvedValue({
        id: "sw-123",
        isDelivered: true,
        deliveredAt: new Date("2026-03-02T10:00:00.000Z"),
        completionRate: 85,
        classId: "class-1",
      }),
    },
    student: { findUnique: mockStudentFindUnique },
    enrollment: { findUnique: mockEnrollmentFindUnique },
    studentProgress: { upsert: mockProgressUpsert },
    labSession: {
      findUnique: mockLabSessionFindUnique,
      update: mockLabSessionUpdate,
    },
    strandCatalog: { findFirst: mockStrandFindFirst },
  },
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const STUDENT_USER = {
  id: "user-student-1",
  role: "STUDENT",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const TEACHER_USER = {
  id: "user-teacher-1",
  role: "TEACHER",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const makeReq = (method = "POST", body?: object) =>
  new NextRequest("http://localhost", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

// ─── Gap 1 tests ──────────────────────────────────────────────────────────────

describe("Gap 1: offline queue wiring", () => {
  beforeEach(() => {
    clearQueue();
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockIsLessonDeliveryEnabled.mockReturnValue(true);
  });

  // ── lesson.completed ────────────────────────────────────────────────────────

  describe("POST /api/student/work/[scheduledWorkId]/complete", () => {
    async function callComplete(scheduledWorkId: string) {
      const { POST } = await import(
        "@/app/api/student/work/[scheduledWorkId]/complete/route"
      );
      const req = makeReq("POST");
      const params = Promise.resolve({ scheduledWorkId });
      return POST(req, { params });
    }

    beforeEach(() => {
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockSwFindUnique.mockResolvedValue({
        id: "sw-lesson-1",
        classId: "class-1",
        class: { schoolId: "school-1" },
      });
      mockStudentFindUnique.mockResolvedValue({ id: "student-rec-1", userId: "user-student-1" });
      mockEnrollmentFindUnique.mockResolvedValue({ studentId: "student-rec-1", classId: "class-1" });
      mockProgressUpsert.mockResolvedValue({
        studentId: "user-student-1",
        scheduledWorkId: "sw-lesson-1",
        completedAt: new Date("2026-03-02T08:00:00.000Z"),
      });
    });

    it("returns 200 and enqueues a lesson.completed item", async () => {
      const res = await callComplete("sw-lesson-1");
      expect(res.status).toBe(200);

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].opType).toBe("lesson.completed");
      expect(queue[0].scheduledWorkId).toBe("sw-lesson-1");
    });

    it("enqueued item has userId in payload", async () => {
      await callComplete("sw-lesson-1");
      const item = getQueue()[0];
      expect(item.payload.userId).toBe("user-student-1");
    });

    it("enqueued item has completedAt in payload", async () => {
      await callComplete("sw-lesson-1");
      const item = getQueue()[0];
      expect(typeof item.payload.completedAt).toBe("string");
    });

    it("enqueuing is idempotent — re-completing does not duplicate queue entry", async () => {
      await callComplete("sw-lesson-1");
      await callComplete("sw-lesson-1");
      expect(getQueue()).toHaveLength(1);
    });

    it("queue error does NOT cause route to return 500", async () => {
      // Force enqueue to throw (simulate corrupted state) — route should still succeed
      vi.spyOn(await import("@/lib/offline/offlineQueue"), "enqueue").mockImplementationOnce(() => {
        throw new Error("queue failure");
      });
      const res = await callComplete("sw-lesson-1");
      expect(res.status).toBe(200);
    });
  });

  // ── lab.session.update ──────────────────────────────────────────────────────

  describe("PATCH /api/student/labs/sessions/[sessionId]", () => {
    async function callPatch(sessionId: string, body: object) {
      const { PATCH } = await import(
        "@/app/api/student/labs/sessions/[sessionId]/route"
      );
      const req = makeReq("PATCH", body);
      return PATCH(req, { params: { sessionId } });
    }

    beforeEach(() => {
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockLabSessionFindUnique.mockResolvedValue({
        id: "session-42",
        studentId: "user-student-1",
        schoolId: "school-1",
        labId: "lab-chem-1",
        scheduledWorkId: "sw-123",
        masteryUpdated: false,
        score: null,
      });
      mockLabSessionUpdate.mockResolvedValue({
        id: "session-42",
        observations: "test observations",
        score: null,
        completedAt: null,
      });
    });

    it("returns 200 and enqueues a lab.session.update item", async () => {
      const res = await callPatch("session-42", { observations: "bubbles formed" });
      expect(res.status).toBe(200);

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].opType).toBe("lab.session.update");
      expect(queue[0].scheduledWorkId).toBe("session-42");
    });

    it("enqueued item payload includes userId", async () => {
      await callPatch("session-42", { observations: "test" });
      expect(getQueue()[0].payload.userId).toBe("user-student-1");
    });

    it("enqueuing is idempotent for same session", async () => {
      await callPatch("session-42", { observations: "first" });
      await callPatch("session-42", { observations: "second" });
      expect(getQueue()).toHaveLength(1);
    });
  });

  // ── lesson.delivered ────────────────────────────────────────────────────────

  describe("PATCH /api/teacher/schedule/[id]/deliver", () => {
    async function callDeliver(id: string, body: object) {
      const { PATCH } = await import(
        "@/app/api/teacher/schedule/[id]/deliver/route"
      );
      const req = makeReq("PATCH", body);
      return PATCH(req, { params: { id } });
    }

    beforeEach(() => {
      mockRequireRole.mockResolvedValue(TEACHER_USER);
      mockSwFindUnique.mockResolvedValue({
        id: "sw-deliver-1",
        classId: "class-1",
        class: { schoolId: "school-1" },
      });
    });

    it("returns 200 and enqueues a lesson.delivered item", async () => {
      const res = await callDeliver("sw-deliver-1", {
        deliveredAt: "2026-03-02T10:00:00.000Z",
        completionRate: 85,
      });
      expect(res.status).toBe(200);

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].opType).toBe("lesson.delivered");
      expect(queue[0].scheduledWorkId).toBe("sw-deliver-1");
    });

    it("enqueued payload has teacherId and classId", async () => {
      await callDeliver("sw-deliver-1", { completionRate: 90 });
      const item = getQueue()[0];
      expect(item.payload.teacherId).toBe("user-teacher-1");
      expect(item.payload.classId).toBe("class-1");
    });

    it("enqueuing is idempotent for same scheduled work", async () => {
      await callDeliver("sw-deliver-1", { completionRate: 80 });
      await callDeliver("sw-deliver-1", { completionRate: 95 });
      expect(getQueue()).toHaveLength(1);
    });
  });
});
