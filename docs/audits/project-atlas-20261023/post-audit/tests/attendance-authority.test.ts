import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { observe } from "./observations";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(), studentFind: vi.fn(), meetingFind: vi.fn(),
  eventFind: vi.fn(), attendanceFind: vi.fn(), attendanceUpsert: vi.fn(),
  logEvent: vi.fn(), metric: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findUnique: mocks.studentFind, findFirst: mocks.studentFind },
  meeting: { findUnique: mocks.meetingFind },
  learningEvent: { findFirst: mocks.eventFind },
  attendanceRecord: { findUnique: mocks.attendanceFind, upsert: mocks.attendanceUpsert },
} }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mocks.metric }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mocks.logEvent }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(), studentSessionSummary: vi.fn() }));
import { POST } from "@/app/api/student/sync/route";
import { resolveAttendance } from "@/lib/offline-sync/policies";

const user = { id: "synthetic-user-A", role: "STUDENT", schoolId: "synthetic-school-A" };
const teacherRecord = { meetingId: "synthetic-meeting-A", studentId: "synthetic-student-A", status: "ABSENT", markedAt: new Date("2026-10-23T09:00:00.000Z") };
let currentRecord = { ...teacherRecord };
beforeEach(() => {
  vi.clearAllMocks(); currentRecord = { ...teacherRecord };
  mocks.requireRole.mockResolvedValue(user);
  mocks.studentFind.mockResolvedValue({ id: "synthetic-student-A", userId: user.id });
  mocks.meetingFind.mockResolvedValue({ Class: { schoolId: "synthetic-school-A" } });
  mocks.eventFind.mockResolvedValue(null);
  mocks.attendanceFind.mockImplementation(async () => ({ ...currentRecord }));
  mocks.attendanceUpsert.mockImplementation(async (query: { update: { status: string; markedAt: Date } }) => {
    currentRecord = { ...currentRecord, ...query.update }; return currentRecord;
  });
  mocks.logEvent.mockResolvedValue({ id: "synthetic-event" });
  mocks.metric.mockResolvedValue(undefined);
});
function operation(overrides: Record<string, unknown> = {}) {
  return { id: "synthetic-operation", entity: "attendance", payload: {
    meetingId: teacherRecord.meetingId, studentId: teacherRecord.studentId,
    status: "PRESENT", clientUpdatedAt: "2026-10-23T10:00:00.000Z", ...overrides,
  } };
}
function request(item = operation(), protocol = false) {
  const payload = protocol ? { protocolVersion: 1, items: [{ ...item,
    protocolVersion: 1, operationId: item.id, learnerId: user.id, schoolId: user.schoolId,
    resourceType: "attendance", resourceId: teacherRecord.meetingId, operationType: "attendance.mark",
    clientCreatedAt: "2026-10-23T10:00:00.000Z", idempotencyKey: item.id, dependencyIds: [],
  }] } : { items: [item] };
  return new NextRequest("http://atlas.invalid/api/student/sync", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } });
}
describe("SEC-R02 synthetic canonical attendance authority", () => {
  it.each([false, true])("P0 cannot overwrite teacher attendance through student sync, protocol1=%s", async protocol => {
    const response = await POST(request(operation(), protocol));
    const result = await response.json();
    observe("ATLAS-SEC-R02", { protocol1: protocol, http: response.status, result, canonicalStatus: currentRecord.status, canonicalWrites: mocks.attendanceUpsert.mock.calls.length });
    expect(response.status).toBe(200);
    expect(result.synced).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ opId: "synthetic-operation", entity: "attendance", status: "conflict", resolutionHint: "attendance_requires_teacher_review" });
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
    expect(currentRecord.status).toBe("ABSENT");
  });
  it("P0 a future device timestamp is not authority over a teacher record", () => {
    const decision = resolveAttendance({ ...teacherRecord, status: "ABSENT" }, {
      meetingId: teacherRecord.meetingId, studentId: teacherRecord.studentId,
      status: "PRESENT", clientUpdatedAt: "2099-01-01T00:00:00.000Z",
    });
    expect(decision.action).toBe("conflict");
  });
  it("P0 students cannot create a new canonical attendance mark either", async () => {
    mocks.attendanceFind.mockResolvedValue(null);
    const response = await POST(request());
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.synced).toBe(0);
    expect(result.results[0]).toMatchObject({ status: "conflict", resolutionHint: "attendance_requires_teacher_review" });
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
  });
  it("control: already rejects a different student's attendance", async () => {
    await POST(request(operation({ studentId: "synthetic-student-B" })));
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
  });
  it("control: already rejects a meeting in another school", async () => {
    mocks.meetingFind.mockResolvedValue({ Class: { schoolId: "synthetic-school-B" } });
    await POST(request());
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
  });
  it("control: an older timestamp cannot replace the newer teacher record", async () => {
    await POST(request(operation({ clientUpdatedAt: "2026-10-23T08:00:00.000Z" })));
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
  });
  it("preserves a supported raw learning observation in a mixed attendance batch", async () => {
    const canonical = { protocolVersion: 1, learnerId: user.id, schoolId: user.schoolId,
      clientCreatedAt: "2026-10-23T10:00:00.000Z", dependencyIds: [] };
    const response = await POST(new NextRequest("http://atlas.invalid/api/student/sync", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, items: [
        { ...canonical, operationId: "synthetic-attendance", idempotencyKey: "synthetic-attendance", resourceType: "attendance", resourceId: teacherRecord.meetingId, operationType: "attendance.mark", payload: operation().payload },
        { ...canonical, operationId: "synthetic-observation", idempotencyKey: "synthetic-observation", resourceType: "learning_observation", resourceId: "synthetic-item", operationType: "learning_observation.append", payload: { itemId: "synthetic-item", hintsUsed: 0 } },
      ] }),
    }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.synced).toBe(1);
    expect(result.results.map((row: { status: string }) => row.status)).toEqual(["conflict", "synced"]);
    expect(mocks.logEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "learning.observation.received", status: "raw_observation" }), { throwOnError: true });
    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
  });
});
