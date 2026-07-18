import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks ---
const mockPrisma = {
  school: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  schoolOnboarding: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  user: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  class: { count: vi.fn() },
  student: { findUnique: vi.fn() },
  studentGuardian: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({ logDataAccess: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

import { requireRole } from "@/lib/auth";
const mockRequireRole = vi.mocked(requireRole);

const SCHOOL_ID = "school-onboard-test";
const USER_ID = "user-admin-onboard";

function mockAdmin() {
  mockRequireRole.mockResolvedValue({ id: USER_ID, schoolId: SCHOOL_ID, role: "ADMIN" } as any);
}

function makeRequest(body: object = {}) {
  return { json: async () => body } as any;
}

describe("School Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.school.findUnique.mockResolvedValue({ id: SCHOOL_ID, name: "Test School", onboardingStep: 0 });
    mockPrisma.school.update.mockResolvedValue({});
    mockPrisma.schoolOnboarding.update.mockResolvedValue({ step: 1, completed: false });
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.class.count.mockResolvedValue(0);
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  describe("GET /api/admin/onboarding — SchoolOnboarding created on first visit", () => {
    it("creates SchoolOnboarding record if not exists and returns it", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue(null);
      const newRecord = { step: 1, completed: false };
      mockPrisma.schoolOnboarding.create.mockResolvedValue(newRecord);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.class.count.mockResolvedValue(0);

      const { GET } = await import("@/app/api/admin/onboarding/route");
      const res = await GET();
      const body = await res.json();

      expect(mockPrisma.schoolOnboarding.create).toHaveBeenCalledWith({
        data: { schoolId: SCHOOL_ID, step: 1 },
      });
      expect(body.onboarding).toEqual(newRecord);
    });

    it("returns existing SchoolOnboarding without creating", async () => {
      mockAdmin();
      const existing = { step: 2, completed: false };
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue(existing);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.class.count.mockResolvedValue(3);

      const { GET } = await import("@/app/api/admin/onboarding/route");
      const res = await GET();
      const body = await res.json();

      expect(mockPrisma.schoolOnboarding.create).not.toHaveBeenCalled();
      expect(body.onboarding.step).toBe(2);
    });
  });

  describe("POST /api/admin/onboarding/step/[n] — Step 1 saves school profile", () => {
    it("saves school profile and advances step", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue({ step: 1, completed: false });

      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({ name: "Lincoln School", principalName: "Mr. Doe" }), { params: { n: "1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockPrisma.school.update).toHaveBeenCalled();
    });

    it("returns 400 for invalid step number", async () => {
      mockAdmin();
      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({}), { params: { n: "99" } });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/admin/onboarding/step/2 — requires minimum 1 teacher", () => {
    it("blocks step 2 if no teachers", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue({ step: 1, completed: false });
      mockPrisma.user.count.mockResolvedValue(0);

      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({}), { params: { n: "2" } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("teacher");
    });

    it("allows step 2 with at least 1 teacher", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue({ step: 2, completed: false });
      mockPrisma.user.count.mockResolvedValue(3);

      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({}), { params: { n: "2" } });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/onboarding/import-students — CSV creates student + guardian", () => {
    it("creates student and guardian from valid CSV", async () => {
      mockAdmin();
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValueOnce({ id: "stu-user-1" });
      mockPrisma.user.create.mockResolvedValueOnce({ id: "grd-user-1" });
      mockPrisma.student.findUnique.mockResolvedValue({ id: "student-1" });
      mockPrisma.studentGuardian.create.mockResolvedValue({});

      const csv = "firstName,lastName,grade,guardianEmail,guardianPhone\nFatu,Kollie,9,fatu@example.com,+2310555555";

      const { POST } = await import("@/app/api/admin/onboarding/import-students/route");
      const res = await POST({ json: async () => ({ csv }) } as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.created).toBe(1);
    });

    it("rejects CSV with missing required columns", async () => {
      mockAdmin();
      const csv = "name,grade\nFatu,9";

      const { POST } = await import("@/app/api/admin/onboarding/import-students/route");
      const res = await POST({ json: async () => ({ csv }) } as any);
      expect(res.status).toBe(400);
    });

    it("rejects malformed rows gracefully — skips empty names", async () => {
      mockAdmin();
      mockPrisma.user.create.mockResolvedValue({ id: "u1" });
      mockPrisma.student.findUnique.mockResolvedValue({ id: "s1" });

      const csv = "firstName,lastName,grade\nFatu,Kollie,9\n,EmptyFirst,8";

      const { POST } = await import("@/app/api/admin/onboarding/import-students/route");
      const res = await POST({ json: async () => ({ csv }) } as any);
      const body = await res.json();
      expect(body.created).toBe(1);
    });

    it("Sprint 6.5 regression: hashes the temp password with bcrypt, not sha256 — must round-trip through bcrypt.compare so login actually works with the password the wizard displays", async () => {
      mockAdmin();
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValueOnce({ id: "stu-user-1" });
      mockPrisma.student.findUnique.mockResolvedValue({ id: "student-1" });

      const csv = "firstName,lastName,grade\nFatu,Kollie,9";

      const { POST } = await import("@/app/api/admin/onboarding/import-students/route");
      await POST({ json: async () => ({ csv }) } as any);

      const bcrypt = (await import("bcryptjs")).default;
      const studentCreateCall = mockPrisma.user.create.mock.calls.find(
        (call: any[]) => call[0]?.data?.role === "STUDENT"
      );
      expect(studentCreateCall).toBeDefined();
      const hashedPwd = studentCreateCall![0].data.hashedPwd;
      expect(await bcrypt.compare("Student@2026!", hashedPwd)).toBe(true);
    });
  });

  describe("POST /api/admin/onboarding/step/4 — creates Class records per subject/grade", () => {
    it("saves step 4 and allows class creation", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue({ step: 4, completed: false });
      mockPrisma.user.count.mockResolvedValue(0);

      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({ grades: [7, 8] }), { params: { n: "4" } });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/onboarding/complete — marks completed: true", () => {
    it("marks onboarding as completed", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.upsert.mockResolvedValue({ step: 5, completed: true });

      const { POST } = await import("@/app/api/admin/onboarding/complete/route");
      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockPrisma.schoolOnboarding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ completed: true }),
        })
      );
    });
  });

  describe("Admin cannot skip steps out of order", () => {
    it("blocks skipping from step 1 to step 4", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue({ step: 1, completed: false });
      mockPrisma.user.count.mockResolvedValue(5);

      const { POST } = await import("@/app/api/admin/onboarding/step/[n]/route");
      const res = await POST(makeRequest({}), { params: { n: "4" } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("step 1");
    });
  });

  describe("Dashboard banner shows when !completed", () => {
    it("GET /api/admin/onboarding returns completed: false for new school", async () => {
      mockAdmin();
      mockPrisma.schoolOnboarding.findUnique.mockResolvedValue(null);
      mockPrisma.schoolOnboarding.create.mockResolvedValue({ step: 1, completed: false });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.class.count.mockResolvedValue(0);

      const { GET } = await import("@/app/api/admin/onboarding/route");
      const res = await GET();
      const body = await res.json();
      expect(body.onboarding.completed).toBe(false);
    });
  });

  describe("POST /api/admin/onboarding/import-teachers — CSV import", () => {
    it("creates teachers from valid CSV", async () => {
      mockAdmin();
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "t1" });

      const csv = "name,email,subject,grades\nMr. Kollie,kollie@school.edu,MATH,7-9";
      const { POST } = await import("@/app/api/admin/onboarding/import-teachers/route");
      const res = await POST({ json: async () => ({ csv }) } as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.created).toBe(1);
    });

    it("Sprint 6.5 regression: hashes the temp password with bcrypt, not sha256 — must round-trip through bcrypt.compare so login actually works with the password the wizard displays", async () => {
      mockAdmin();
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "t1" });

      const csv = "name,email,subject,grades\nMr. Kollie,kollie@school.edu,MATH,7-9";
      const { POST } = await import("@/app/api/admin/onboarding/import-teachers/route");
      await POST({ json: async () => ({ csv }) } as any);

      const bcrypt = (await import("bcryptjs")).default;
      const hashedPwd = mockPrisma.user.create.mock.calls[0][0].data.hashedPwd;
      expect(await bcrypt.compare("School@2026!", hashedPwd)).toBe(true);
    });

    it("rejects CSV without name column", async () => {
      mockAdmin();
      const csv = "email,subject\nkollie@school.edu,MATH";
      const { POST } = await import("@/app/api/admin/onboarding/import-teachers/route");
      const res = await POST({ json: async () => ({ csv }) } as any);
      expect(res.status).toBe(400);
    });
  });
});
