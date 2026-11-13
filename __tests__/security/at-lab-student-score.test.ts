/**
 * AT-LAB-STUDENT-SCORE (P1, COS-T1-AT-R-LAB-REVIEW-2.md): no student path writes labSession.score. A student's
 * provisional score is kept as a labelled observation (scorer STUDENT_CLIENT); student updates to a completed or
 * teacher-reviewed session are refused (409 online, conflict in offline sync), so a reviewed score cannot change.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ session: null as any, update: vi.fn(async ({ data }: any) => ({ id: "lab-session-1", labId: "plant-lab", startedAt: new Date(), completedAt: null, ...data })) }));
vi.mock("@/lib/serverFlags", async () => ({ ...(await vi.importActual<any>("@/lib/serverFlags")), isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn().mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/offline/offlineQueue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/student/labEligibility", async () => ({ ...(await vi.importActual<any>("@/lib/student/labEligibility")), loadAuthorizedPracticalSessions: vi.fn().mockResolvedValue([{ session: { id: "lab-session-1" } }]) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: { findFirst: vi.fn().mockResolvedValue(null) },
    student: { findUnique: vi.fn().mockResolvedValue({ id: "student-rec-1", userId: "student-1" }), findFirst: vi.fn().mockResolvedValue({ id: "student-rec-1" }) },
    scheduledWork: { findFirst: vi.fn().mockResolvedValue({ id: "sw-1" }) },
    labSession: { findUnique: vi.fn(async () => m.session), update: m.update },
  },
}));

import { PATCH } from "@/app/api/student/labs/sessions/[sessionId]/route";
import { POST as SYNC } from "@/app/api/student/sync/route";

const base = { id: "lab-session-1", labId: "plant-lab", studentId: "student-1", schoolId: "school-1", startedAt: new Date("2026-10-25T09:00:00Z"), observations: { height: 4 } };
const reviewed = { ...base, completedAt: new Date("2026-10-25T09:30:00Z"), score: 80, teacherFeedback: "Clear evidence; the conclusion needs one more detail." };
const completed = { ...base, completedAt: new Date("2026-10-25T09:30:00Z"), score: null, teacherFeedback: null };
const inProgress = { ...base, completedAt: null, score: null, teacherFeedback: null };
const patch = (body: object) => PATCH(new Request("http://localhost/api/student/labs/sessions/lab-session-1", { method: "PATCH", body: JSON.stringify(body) }) as any, { params: { sessionId: "lab-session-1" } });
const sync = (payload: object) => SYNC(new Request("http://localhost/api/student/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocolVersion: 1, items: [{
  protocolVersion: 1, operationId: "lab-op-1", learnerId: "student-1", schoolId: "school-1", resourceType: "lab_session", resourceId: "lab-session-1", operationType: "lab_session.merge",
  payload, clientCreatedAt: "2026-10-25T10:00:00.000Z", idempotencyKey: "lab-op-1", dependencyIds: [] }] }) }) as any);
const written = () => m.update.mock.calls.at(-1)?.[0]?.data;

beforeEach(() => { m.update.mockClear(); });

describe("AT-LAB-STUDENT-SCORE: online PATCH", () => {
  it("refuses to change a teacher-reviewed session (409) and writes nothing", async () => {
    m.session = reviewed;
    const res = await patch({ score: 100 });
    expect(res.status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("refuses updates to a completed session awaiting review (409)", async () => {
    m.session = completed;
    expect((await patch({ observations: { height: 9 }, score: 95 })).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("never writes labSession.score; keeps the student's score as a labelled observation", async () => {
    m.session = inProgress;
    const res = await patch({ observations: { height: 6 }, score: 70, completedAt: "2026-10-25T09:40:00Z" });
    expect(res.status).toBe(200);
    expect(written()).not.toHaveProperty("score");
    expect(written().observations).toEqual({ height: 6, provisionalScore: { value: 70, scorer: "STUDENT_CLIENT" } });
  });
  it("labels a score sent without observations against the stored observations", async () => {
    m.session = inProgress;
    await patch({ score: 55 });
    expect(written()).not.toHaveProperty("score");
    expect(written().observations).toEqual({ height: 4, provisionalScore: { value: 55, scorer: "STUDENT_CLIENT" } });
  });
});

describe("AT-LAB-STUDENT-SCORE: offline sync replay", () => {
  it("a replayed score on a teacher-reviewed session is a conflict and writes nothing", async () => {
    m.session = reviewed;
    const body = await (await sync({ score: 100 })).json();
    expect(body.results[0].status).toBe("conflict");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("a replayed edit to a completed session is a conflict", async () => {
    m.session = completed;
    expect((await (await sync({ observations: { height: 9 } })).json()).results[0].status).toBe("conflict");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("never writes labSession.score; keeps the student's score as a labelled observation", async () => {
    m.session = inProgress;
    const body = await (await sync({ score: 100, observations: { height: 7 } })).json();
    expect(body.results[0].status).toBe("synced");
    expect(written()).not.toHaveProperty("score");
    expect(written().observations).toEqual({ height: 7, provisionalScore: { value: 100, scorer: "STUDENT_CLIENT" } });
  });
});
