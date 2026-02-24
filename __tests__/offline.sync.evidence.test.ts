/**
 * __tests__/offline.sync.evidence.test.ts
 *
 * Tests for the entity="evidence" branch in app/api/student/sync/route.ts — Block 8A.
 *
 * Verifies:
 *   1. processEvidence is called with correct fields from the payload.
 *   2. studentId / schoolId always come from session (tenant safe).
 *   3. result.status = "synced" / "skipped" based on processEvidence return.
 *   4. Missing required fields → status "skipped".
 *   5. idempotencyKey taken from item.idempotencyKey, falls back to opId.
 *   6. Mixed-entity batches: all entities processed correctly.
 *   7. Two items with same idempotencyKey: first synced, second skipped.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole    = vi.hoisted(() => vi.fn());
const mockProcessEvidence = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockLogAudit        = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  studentProgress: { findUnique: vi.fn(), upsert: vi.fn() },
  attendanceRecord: { findUnique: vi.fn(), upsert: vi.fn() },
  homeworkSubmission: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/mastery/evidencePipeline", () => ({
  processEvidence: mockProcessEvidence,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/offline-sync/policies", () => ({
  resolveAttendance: vi.fn().mockReturnValue({ action: "write", markedAt: new Date() }),
  resolveSubmission: vi.fn().mockReturnValue({ action: "write", submittedAt: new Date() }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST } from "@/app/api/student/sync/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(items: unknown[]) {
  return new Request("http://localhost/api/student/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

const SESSION_USER = {
  id: "user-session-123",
  role: "STUDENT",
  schoolId: "school-session-456",
};

const EVIDENCE_PAYLOAD = {
  subject: "MATH",
  strandKey: "algebra_basics",
  correct: 3,
  total: 4,
  source: "practice",
  wasAiAssisted: false,
  difficulty: 3,
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(SESSION_USER);
  mockProcessEvidence.mockResolvedValue({ baseline: {}, mastery: {} });
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
});

// ─── entity="evidence" basic behaviour ───────────────────────────────────────

describe("POST /api/student/sync — evidence entity", () => {
  it("calls processEvidence with subject/strandKey/correct/total/source from payload", async () => {
    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    await POST(req as any);

    expect(mockProcessEvidence).toHaveBeenCalledTimes(1);
    const arg = mockProcessEvidence.mock.calls[0][0];
    expect(arg.subject).toBe("MATH");
    expect(arg.strandKey).toBe("algebra_basics");
    expect(arg.correct).toBe(3);
    expect(arg.total).toBe(4);
    expect(arg.source).toBe("practice");
  });

  it("studentId is always user.id (never from payload)", async () => {
    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: { ...EVIDENCE_PAYLOAD, studentId: "injected-student" },
      },
    ]);

    await POST(req as any);

    const arg = mockProcessEvidence.mock.calls[0][0];
    expect(arg.studentId).toBe(SESSION_USER.id);
    expect(arg.studentId).not.toBe("injected-student");
  });

  it("schoolId is always user.schoolId (never from payload)", async () => {
    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: { ...EVIDENCE_PAYLOAD, schoolId: "injected-school" },
      },
    ]);

    await POST(req as any);

    const arg = mockProcessEvidence.mock.calls[0][0];
    expect(arg.schoolId).toBe(SESSION_USER.schoolId);
    expect(arg.schoolId).not.toBe("injected-school");
  });

  it("result.status = 'synced' when processEvidence returns normally", async () => {
    mockProcessEvidence.mockResolvedValue({ baseline: {}, mastery: {} });

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.synced).toBe(1);
    expect(body.skipped).toBe(0);
    const r = body.results.find((x: any) => x.opId === "op-1");
    expect(r?.status).toBe("synced");
  });

  it("result.status = 'skipped' when processEvidence returns { idempotent: true }", async () => {
    mockProcessEvidence.mockResolvedValue({ baseline: { disabled: true }, mastery: { disabled: true }, idempotent: true });

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.skipped).toBe(1);
    expect(body.synced).toBe(0);
    const r = body.results.find((x: any) => x.opId === "op-1");
    expect(r?.status).toBe("skipped");
  });

  it("result.status = 'skipped' when payload is missing subject", async () => {
    const { subject: _s, ...noSubject } = EVIDENCE_PAYLOAD;

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: noSubject,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.skipped).toBe(1);
    expect(mockProcessEvidence).not.toHaveBeenCalled();
  });

  it("result.status = 'skipped' when payload is missing strandKey", async () => {
    const { strandKey: _sk, ...noStrand } = EVIDENCE_PAYLOAD;

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: noStrand,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.skipped).toBe(1);
    expect(mockProcessEvidence).not.toHaveBeenCalled();
  });

  it("result.status = 'skipped' when payload is missing source", async () => {
    const { source: _src, ...noSource } = EVIDENCE_PAYLOAD;

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: noSource,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.skipped).toBe(1);
    expect(mockProcessEvidence).not.toHaveBeenCalled();
  });

  it("idempotencyKey taken from item.idempotencyKey", async () => {
    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        idempotencyKey: "client-idem-key",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    await POST(req as any);

    const arg = mockProcessEvidence.mock.calls[0][0];
    expect(arg.idempotencyKey).toBe("client-idem-key");
  });

  it("idempotencyKey falls back to opId when item.idempotencyKey absent", async () => {
    const req = makeRequest([
      {
        id: "op-fallback",
        opId: "op-fallback",
        entity: "evidence",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    await POST(req as any);

    const arg = mockProcessEvidence.mock.calls[0][0];
    expect(arg.idempotencyKey).toBe("op-fallback");
  });
});

// ─── Mixed entities ───────────────────────────────────────────────────────────

describe("POST /api/student/sync — mixed entities", () => {
  it("studentProgress + evidence in one request: both processed correctly", async () => {
    mockPrisma.studentProgress.findUnique.mockResolvedValue(null);
    mockPrisma.studentProgress.upsert.mockResolvedValue({});

    const req = makeRequest([
      {
        id: "op-1",
        entity: "studentProgress",
        scheduledWorkId: "sw-1",
        completedAt: "2026-02-24T10:00:00.000Z",
        clientUpdatedAt: "2026-02-24T10:00:00.000Z",
      },
      {
        id: "op-2",
        entity: "evidence",
        completedAt: "2026-02-24T10:01:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.synced).toBe(2);
    expect(body.skipped).toBe(0);
    expect(mockProcessEvidence).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studentProgress.upsert).toHaveBeenCalledTimes(1);
  });

  it("synced/skipped counts accurate for mixed batch", async () => {
    mockPrisma.studentProgress.findUnique.mockResolvedValue(null);
    mockPrisma.studentProgress.upsert.mockResolvedValue({});
    mockProcessEvidence.mockResolvedValue({ baseline: { disabled: true }, mastery: { disabled: true }, idempotent: true });

    const req = makeRequest([
      {
        id: "op-1",
        entity: "studentProgress",
        scheduledWorkId: "sw-1",
        completedAt: "2026-02-24T10:00:00.000Z",
        clientUpdatedAt: "2026-02-24T10:00:00.000Z",
      },
      {
        id: "op-2",
        entity: "evidence",
        completedAt: "2026-02-24T10:01:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.synced).toBe(1);   // only studentProgress
    expect(body.skipped).toBe(1);  // evidence was idempotent
  });
});

// ─── Evidence idempotency ─────────────────────────────────────────────────────

describe("POST /api/student/sync — evidence idempotency", () => {
  it("two evidence items with same idempotencyKey: first synced, second skipped", async () => {
    mockProcessEvidence
      .mockResolvedValueOnce({ baseline: {}, mastery: {} })                                          // first: new
      .mockResolvedValueOnce({ baseline: { disabled: true }, mastery: { disabled: true }, idempotent: true }); // second: duplicate

    const req = makeRequest([
      {
        id: "op-1",
        entity: "evidence",
        idempotencyKey: "same-key",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
      {
        id: "op-2",
        entity: "evidence",
        idempotencyKey: "same-key",
        completedAt: "2026-02-24T10:00:00.000Z",
        payload: EVIDENCE_PAYLOAD,
      },
    ]);

    const res = await POST(req as any);
    const body = await res.json();

    expect(body.synced).toBe(1);
    expect(body.skipped).toBe(1);

    const op1 = body.results.find((x: any) => x.opId === "op-1");
    const op2 = body.results.find((x: any) => x.opId === "op-2");
    expect(op1?.status).toBe("synced");
    expect(op2?.status).toBe("skipped");
  });
});
