import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireRole: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const db = vi.hoisted(() => ({
  prisma: {
    metricEvent: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    learningEvent: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);

const metrics = vi.hoisted(() => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/metrics/events", () => metrics);

const audit = vi.hoisted(() => ({ logAudit: vi.fn(), logAuditRequired: vi.fn() }));
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));

import { POST as reportSnapshot } from "@/app/api/student/sync/diagnostics/route";
import { GET as readDiagnostics } from "@/app/api/admin/support/learners/[learnerId]/sync-diagnostics/route";
import { POST as sync } from "@/app/api/student/sync/route";

const SECRET = "SECRET-ANSWER-42";
const student = { id: "learner-a", role: "STUDENT", schoolId: "school-a" };

function snapshotBody(extra: Record<string, unknown> = {}) {
  return {
    snapshot: {
      schemaVersion: 1,
      capturedAt: "2026-09-25T11:55:00.000Z",
      online: true,
      counts: { unacknowledged: 1, localPending: 0, sending: 0, retryPending: 0, authRequired: 0, conflict: 0, quarantined: 1, acknowledgedRetained: 0 },
      operations: [{ operationId: "op-1", category: "assessment_attempt", queueState: "TERMINAL_FAILURE", reasonCode: "http_500", ageSeconds: 5, retryCount: 3, payload: { answers: [SECRET] } }],
      payload: { answers: [SECRET] },
      ...extra,
    },
  };
}

function post(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireRole.mockResolvedValue(student);
  db.prisma.metricEvent.findFirst.mockResolvedValue(null);
});

describe("POST /api/student/sync/diagnostics", () => {
  it("stores only the sanitized snapshot bound to the session learner and school", async () => {
    const res = await reportSnapshot(post("http://x/api/student/sync/diagnostics", { ...snapshotBody(), learnerId: "learner-b" }));
    expect(res.status).toBe(200);
    expect(auth.requireRole).toHaveBeenCalledWith("STUDENT");
    const [name, payload, scope] = metrics.recordMetricEvent.mock.calls[0];
    expect(name).toBe("offline.sync.snapshot");
    expect(scope).toMatchObject({ userId: "learner-a", schoolId: "school-a", severity: "warning" });
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(JSON.stringify(payload)).not.toContain("payload");
  });

  it("refuses non-learners", async () => {
    auth.requireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await reportSnapshot(post("http://x/api/student/sync/diagnostics", snapshotBody()));
    expect(res.status).toBe(403);
    expect(metrics.recordMetricEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid, oversized, and rate-limited reports without storing them", async () => {
    expect((await reportSnapshot(post("http://x", "{not json"))).status).toBe(400);
    expect((await reportSnapshot(post("http://x", { snapshot: { schemaVersion: 1 } }))).status).toBe(400);
    expect((await reportSnapshot(post("http://x", snapshotBody({ pad: "x".repeat(20_000) })))).status).toBe(413);
    db.prisma.metricEvent.findFirst.mockResolvedValue({ id: "recent" });
    const limited = await reportSnapshot(post("http://x", snapshotBody()));
    expect(await limited.json()).toEqual({ recorded: false, reason: "rate_limited" });
    expect(metrics.recordMetricEvent).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/support/learners/[learnerId]/sync-diagnostics", () => {
  const params = (learnerId: string) => ({ params: Promise.resolve({ learnerId }) });

  it("returns 404 to an admin from another school and 403 to a teacher", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ id: "learner-b", name: "B", role: "STUDENT", schoolId: "school-b" });
    auth.requireUser.mockResolvedValue({ id: "admin-a", role: "ADMIN", schoolId: "school-a" });
    expect((await readDiagnostics(new Request("http://x"), params("learner-b"))).status).toBe(404);
    auth.requireUser.mockResolvedValue({ id: "teacher-a", role: "TEACHER", schoolId: "school-b" });
    expect((await readDiagnostics(new Request("http://x"), params("learner-b"))).status).toBe(403);
    expect(db.prisma.metricEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    auth.requireUser.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    expect((await readDiagnostics(new Request("http://x"), params("learner-a"))).status).toBe(401);
  });

  it("serves an own-school learner with no-store caching after a durable audit", async () => {
    auth.requireUser.mockResolvedValue({ id: "admin-a", role: "ADMIN", schoolId: "school-a" });
    db.prisma.user.findUnique.mockResolvedValue({ id: "learner-a", name: "A", role: "STUDENT", schoolId: "school-a" });
    db.prisma.metricEvent.findMany.mockResolvedValue([]);
    const res = await readDiagnostics(new Request("http://x"), params("learner-a"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).diagnostics.primaryState).toBe("UNKNOWN");
    expect(audit.logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ action: "support.sync_diagnostics.viewed" }));
  });
});

describe("POST /api/student/sync outcome recording", () => {
  it("records payload-free per-operation verdicts on the sync.result metric", async () => {
    const res = await sync(post("http://x/api/student/sync", {
      protocolVersion: 99,
      items: [{ operationId: "op-7", resourceType: "assessment_attempt", payload: { answers: [SECRET] } }],
    }));
    expect(res.status).toBe(200);
    const call = metrics.recordMetricEvent.mock.calls.find(([name]) => name === "sync.result");
    expect(call?.[1]).toMatchObject({
      outcomes: [{ operationId: "op-7", category: "assessment_attempt", verdict: "REJECTED", reasonCode: "incompatible_client_protocol" }],
    });
    expect(JSON.stringify(call?.[1])).not.toContain(SECRET);
  });
});
