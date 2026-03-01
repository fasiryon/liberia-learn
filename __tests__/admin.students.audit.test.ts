/**
 * __tests__/admin.students.audit.test.ts
 *
 * AUDIT-2 (Block 22): Isolation + audit logging for GET /api/admin/students
 *
 * Verifies:
 *  - RBAC: TEACHER → 403, unauthenticated → 401
 *  - Tenant isolation: query always scoped to admin's own schoolId
 *  - Null schoolId guard: returns 400 if admin has no schoolId
 *  - logAudit is called on successful reads (mutation coverage)
 *  - Response contains no student identifiers beyond own-school scope
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/admin/students/route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAdmin(schoolId: string | null = "school-A", isPlatformAdmin = false) {
  return { id: "admin-1", role: "ADMIN", schoolId, isPlatformAdmin };
}

const SAMPLE_STUDENTS = [
  {
    id: "student-1",
    createdAt: new Date(),
    user: { name: "Alice", email: "alice@school.edu" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.student.findMany as any).mockResolvedValue(SAMPLE_STUDENTS);
});

// ── RBAC ──────────────────────────────────────────────────────────────────────

describe("GET /api/admin/students — RBAC", () => {
  it("returns 401 for unauthenticated requests", async () => {
    (requireRole as any).mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for TEACHER role", async () => {
    (requireRole as any).mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await GET();
    expect(res.status).toBe(403);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe("GET /api/admin/students — tenant isolation", () => {
  it("scopes student query to admin's own schoolId", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));

    await GET();

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { schoolId: "school-A" } },
      })
    );
  });

  it("returns 400 when admin has no schoolId (null guard)", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin(null));

    const res = await GET();

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("schoolId required");
    // Must not query DB without a schoolId
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});

// ── Audit logging ─────────────────────────────────────────────────────────────

describe("GET /api/admin/students — audit logging", () => {
  it("calls logAudit on successful list", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));

    await GET();

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.students.listed",
        resourceType: "student_roster",
        schoolId: "school-A",
      })
    );
  });

  it("audit log includes count of students returned", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));
    (prisma.student.findMany as any).mockResolvedValue(SAMPLE_STUDENTS);

    await GET();

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ count: SAMPLE_STUDENTS.length }),
      })
    );
  });

  it("does not call logAudit when admin has no schoolId", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin(null));

    await GET();

    // Guard fires before any DB access — no audit needed
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("logAudit is called with expected schoolId and userId", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-B"));

    await GET();

    // Verify schoolId and userId are passed — confirms no cross-tenant audit records
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        schoolId: "school-B",
        action: "admin.students.listed",
      })
    );
  });
});

// ── Response shape ─────────────────────────────────────────────────────────────

describe("GET /api/admin/students — response shape", () => {
  it("returns 200 with students array", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.students).toHaveLength(1);
  });

  it("student records include id, name, email", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));

    const res = await GET();
    const body = await res.json();
    const student = body.students[0];
    expect(student).toHaveProperty("id");
    expect(student).toHaveProperty("name");
    expect(student).toHaveProperty("email");
  });

  it("response contains no cross-school student data (query scoped)", async () => {
    (requireRole as any).mockResolvedValue(makeAdmin("school-A"));

    await GET();

    // Confirm the where clause never leaks a null (which would match unscoped students)
    const whereArg = (prisma.student.findMany as any).mock.calls[0][0].where;
    expect(whereArg.user.schoolId).toBe("school-A");
    expect(whereArg.user.schoolId).not.toBeNull();
    expect(whereArg.user.schoolId).not.toBeUndefined();
  });
});
