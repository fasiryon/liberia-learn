import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const {
  mockPrisma,
  mockLogAudit,
  mockRequireRole,
  mockGenerateCanvaAsset,
  mockHasCanvaMcpAuthorizationToken,
} = vi.hoisted(() => {
  const mockPrisma = {
    generatedDocument: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    class: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    student: { findFirst: vi.fn() },
    schoolEvent: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const mockLogAudit = vi.fn().mockResolvedValue(undefined);
  const mockRequireRole = vi.fn();
  const mockGenerateCanvaAsset = vi.fn();
  const mockHasCanvaMcpAuthorizationToken = vi.fn().mockReturnValue(true);
  return {
    mockPrisma,
    mockLogAudit,
    mockRequireRole,
    mockGenerateCanvaAsset,
    mockHasCanvaMcpAuthorizationToken,
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: vi.fn(),
  authOptions: {},
}));
vi.mock("@/lib/canva/canvaMcp", () => ({
  generateCanvaAsset: mockGenerateCanvaAsset,
}));
vi.mock("@/lib/canva/config", () => ({
  hasCanvaMcpAuthorizationToken: mockHasCanvaMcpAuthorizationToken,
}));

// Import templates after mocks
import { generateStudentIdCard } from "@/lib/canva/templates/studentIdCard";
import { generateEnrollmentLetter } from "@/lib/canva/templates/enrollmentLetter";

function makeRequest(body: Record<string, unknown>, url = "http://localhost/api/admin/documents") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHasCanvaMcpAuthorizationToken.mockReturnValue(true);
  mockLogAudit.mockResolvedValue(undefined);
});

// ========================
// Template unit tests
// ========================

describe("generateStudentIdCard", () => {
  const baseData = {
    studentName: "Fasir Student",
    studentNumber: "LIB-001",
    grade: "Grade 5",
    schoolName: "Monrovia Academy",
    academicYear: "2025-2026",
  };

  it("creates a GeneratedDocument with PENDING status and then COMPLETED", async () => {
    const pendingDoc = { id: "doc1", status: "PENDING" };
    const completedDoc = { id: "doc1", status: "COMPLETED", canvaUrl: "https://canva.com/1", downloadUrl: "https://canva.com/1" };

    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    // First update: GENERATING
    mockPrisma.generatedDocument.update.mockResolvedValueOnce({ ...pendingDoc, status: "GENERATING" });
    // Second update: COMPLETED
    mockPrisma.generatedDocument.update.mockResolvedValueOnce(completedDoc);
    mockGenerateCanvaAsset.mockResolvedValueOnce({ canvaUrl: "https://canva.com/1", designId: "design-1" });

    const result = await generateStudentIdCard(baseData, "school1", "user1", "admin1");

    expect(mockPrisma.generatedDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "STUDENT_ID_CARD",
          status: "PENDING",
          schoolId: "school1",
        }),
      })
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.canvaUrl).toBe("https://canva.com/1");
  });

  it("fails gracefully when MCP token is not configured (no throw)", async () => {
    mockHasCanvaMcpAuthorizationToken.mockReturnValue(false);

    const pendingDoc = { id: "doc2", status: "PENDING" };
    const failedDoc = { id: "doc2", status: "FAILED" };

    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    mockPrisma.generatedDocument.update.mockResolvedValueOnce(failedDoc);
    mockPrisma.generatedDocument.findUniqueOrThrow.mockResolvedValueOnce(failedDoc);

    const result = await generateStudentIdCard(baseData, "school1", "user1", "admin1");

    expect(mockGenerateCanvaAsset).not.toHaveBeenCalled();
    expect(result.status).toBe("FAILED");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.generate.failed" })
    );
  });

  it("sets status to FAILED when generateCanvaAsset throws — does not rethrow", async () => {
    const pendingDoc = { id: "doc3", status: "PENDING" };
    const failedDoc = { id: "doc3", status: "FAILED" };

    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    mockPrisma.generatedDocument.update
      .mockResolvedValueOnce({ ...pendingDoc, status: "GENERATING" })
      .mockResolvedValueOnce(failedDoc);
    mockGenerateCanvaAsset.mockRejectedValueOnce(new Error("Canva API down"));

    const result = await generateStudentIdCard(baseData, "school1", "user1", "admin1");

    expect(result.status).toBe("FAILED");
    // logAudit called with failed action
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.generate.failed" })
    );
  });
});

describe("generateEnrollmentLetter", () => {
  const baseData = {
    studentName: "Jane Doe",
    guardianName: "Mr. Doe",
    grade: "Grade 4",
    schoolName: "Liberia School",
    enrollmentDate: "05/13/2026",
    academicYear: "2026-2027",
  };

  it("fails gracefully when token not configured", async () => {
    mockHasCanvaMcpAuthorizationToken.mockReturnValue(false);

    const pendingDoc = { id: "docE1", status: "PENDING" };
    const failedDoc = { id: "docE1", status: "FAILED" };

    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    mockPrisma.generatedDocument.update.mockResolvedValueOnce(failedDoc);
    mockPrisma.generatedDocument.findUniqueOrThrow.mockResolvedValueOnce(failedDoc);

    const result = await generateEnrollmentLetter(baseData, "school1", "user1", "admin1");

    expect(mockGenerateCanvaAsset).not.toHaveBeenCalled();
    expect(result.status).toBe("FAILED");
  });

  it("sets downloadUrl on successful generation", async () => {
    const pendingDoc = { id: "docE2", status: "PENDING" };
    const completedDoc = {
      id: "docE2",
      status: "COMPLETED",
      canvaUrl: "https://canva.com/letter",
      downloadUrl: "https://canva.com/letter",
    };

    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    mockPrisma.generatedDocument.update
      .mockResolvedValueOnce({ ...pendingDoc, status: "GENERATING" })
      .mockResolvedValueOnce(completedDoc);
    mockGenerateCanvaAsset.mockResolvedValueOnce({
      canvaUrl: "https://canva.com/letter",
      designId: "design-letter",
    });

    const result = await generateEnrollmentLetter(baseData, "school1", "user1", "admin1");

    expect(result.status).toBe("COMPLETED");
    expect(result.downloadUrl).toBe("https://canva.com/letter");
  });
});

// ========================
// API route tests
// ========================

describe("GET /api/admin/documents", () => {
  it("returns 403 for non-admin users", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { GET } = await import("@/app/api/admin/documents/route");
    const req = new Request("http://localhost/api/admin/documents");
    const res = await GET(req as never);

    expect(res.status).toBe(403);
  });

  it("returns only documents scoped to schoolId", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin1", schoolId: "school1", role: "ADMIN" });

    const docs = [
      { id: "d1", type: "STUDENT_ID_CARD", status: "COMPLETED", schoolId: "school1", student: null },
    ];
    mockPrisma.generatedDocument.findMany.mockResolvedValueOnce(docs);

    const { GET } = await import("@/app/api/admin/documents/route");
    const req = new Request("http://localhost/api/admin/documents?type=STUDENT_ID_CARD");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.generatedDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school1" }),
      })
    );
    expect(data).toHaveLength(1);
  });
});

describe("POST /api/admin/documents/id-cards/generate", () => {
  it("returns 201 and generates ID cards for class enrollments", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin1", schoolId: "school1", role: "ADMIN" });

    const classData = {
      id: "class1",
      gradeLevel: 5,
      name: "5A",
      School: { name: "Monrovia Academy" },
      enrollments: [
        {
          Student: {
            id: "stu1",
            user: { id: "user1", name: "Alice", loginId: "alice001" },
          },
        },
      ],
    };
    mockPrisma.class.findFirst.mockResolvedValueOnce(classData);

    // For generateStudentIdCard calls
    const pendingDoc = { id: "doc1", status: "PENDING" };
    const completedDoc = { id: "doc1", status: "COMPLETED", canvaUrl: "https://canva.com/id1" };
    mockPrisma.generatedDocument.create.mockResolvedValueOnce(pendingDoc);
    mockPrisma.generatedDocument.update
      .mockResolvedValueOnce({ ...pendingDoc, status: "GENERATING" })
      .mockResolvedValueOnce(completedDoc);
    mockGenerateCanvaAsset.mockResolvedValueOnce({ canvaUrl: "https://canva.com/id1", designId: "d1" });

    const { POST } = await import("@/app/api/admin/documents/id-cards/generate/route");
    const req = makeRequest({ classId: "class1" });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.generated).toBe(1);
    expect(data.docs).toHaveLength(1);
  });

  it("returns 403 when non-admin calls the endpoint", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { POST } = await import("@/app/api/admin/documents/id-cards/generate/route");
    const req = makeRequest({ classId: "class1" });
    const res = await POST(req as never);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/documents/permission-slips", () => {
  it("returns 400 when event is not a TRIP", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin1", schoolId: "school1", role: "ADMIN" });

    mockPrisma.schoolEvent.findFirst.mockResolvedValueOnce({
      id: "event1",
      title: "Sports Day",
      type: "SPORTS",
      schoolId: "school1",
      eventDate: new Date(),
      endDate: null,
    });

    const { POST } = await import("@/app/api/admin/documents/permission-slips/route");
    const req = makeRequest({ eventId: "event1" });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/TRIP/);
  });
});

describe("Auto-trigger on enrollment creation", () => {
  it("fires generateEnrollmentLetter when enrollment is created", async () => {
    // We test that prisma.student.findFirst is called as part of fire-and-forget
    const mockRequireUser = vi.fn().mockResolvedValue({
      id: "admin1",
      schoolId: "school1",
      role: "ADMIN",
      isPlatformAdmin: false,
    });

    // Re-mock requireUser for enrollment route
    vi.doMock("@/lib/auth", () => ({
      requireRole: mockRequireRole,
      requireUser: mockRequireUser,
      authOptions: {},
    }));

    const enrollment = {
      id: "enr1",
      studentId: "stu1",
      academicYearId: "ay1",
      grade: "5",
      status: "ACTIVE",
    };

    // Mock createAcademicEnrollmentForSchool
    vi.doMock("@/lib/records/systemOfRecord", () => ({
      createAcademicEnrollmentForSchool: vi.fn().mockResolvedValue(enrollment),
      createAcademicEnrollmentSchema: {
        parse: vi.fn().mockReturnValue({
          studentId: "stu1",
          academicYearId: "ay1",
          grade: "5",
          status: "ACTIVE",
        }),
      },
      listAcademicEnrollmentsForSchool: vi.fn().mockResolvedValue([]),
      resolveAdminSchoolScope: vi.fn().mockReturnValue("school1"),
      updateAcademicEnrollmentSchema: { parse: vi.fn() },
      updateAcademicEnrollmentStatusForSchool: vi.fn(),
    }));
    vi.doMock("@/lib/errors/apiErrorHandler", () => ({
      handleApiError: vi.fn().mockReturnValue(new Response("error", { status: 500 })),
    }));

    // student.findFirst should resolve with a student record
    mockPrisma.student.findFirst.mockResolvedValueOnce({
      id: "stu1",
      user: { id: "user1", name: "Alice" },
      guardians: [],
    });

    // generatedDocument.create for the letter
    mockPrisma.generatedDocument.create.mockResolvedValueOnce({ id: "doc-letter", status: "PENDING" });
    mockPrisma.generatedDocument.update.mockResolvedValueOnce({ id: "doc-letter", status: "GENERATING" });
    mockPrisma.generatedDocument.update.mockResolvedValueOnce({
      id: "doc-letter",
      status: "COMPLETED",
      canvaUrl: "https://canva.com/letter",
    });
    mockGenerateCanvaAsset.mockResolvedValueOnce({ canvaUrl: "https://canva.com/letter", designId: "dl1" });

    const { POST } = await import("@/app/api/admin/enrollment/route");
    const req = new Request("http://localhost/api/admin/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: "stu1", academicYearId: "ay1", grade: "5", status: "ACTIVE" }),
    });

    const res = await POST(req as never);
    // Give fire-and-forget a tick to start
    await new Promise((r) => setTimeout(r, 10));

    expect(res.status).toBe(201);
    // The fire-and-forget should have kicked off prisma.student.findFirst
    expect(mockPrisma.student.findFirst).toHaveBeenCalled();
  });
});
