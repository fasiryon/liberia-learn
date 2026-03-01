import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn());
const mockGradeToBand = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile = vi.hoisted(() => vi.fn());

const mockVirtualLabFindMany = vi.hoisted(() => vi.fn());
const mockVirtualLabFindUnique = vi.hoisted(() => vi.fn());
const mockLabSessionFindFirst = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique = vi.hoisted(() => vi.fn());
const mockLabSessionCreateMany = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkUpdate = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockStrandCatalogFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isVirtualLabsEnabled: mockIsVirtualLabsEnabled,
  };
});

vi.mock("@/lib/moe/alignment-engine", () => ({
  gradeToBand: mockGradeToBand,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    virtualLab: {
      findMany: mockVirtualLabFindMany,
      findUnique: mockVirtualLabFindUnique,
    },
    labSession: {
      findFirst: mockLabSessionFindFirst,
      findUnique: mockLabSessionFindUnique,
      createMany: mockLabSessionCreateMany,
      update: mockLabSessionUpdate,
    },
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
      update: mockScheduledWorkUpdate,
    },
    enrollment: {
      findMany: mockEnrollmentFindMany,
    },
    student: {
      findUnique: mockStudentFindUnique,
    },
    strandCatalog: {
      findFirst: mockStrandCatalogFindFirst,
    },
  },
}));

import { GET as labsGet } from "@/app/api/teacher/labs/route";
import { GET as labDetailGet } from "@/app/api/teacher/labs/[labId]/route";
import { POST as linkLabPost } from "@/app/api/teacher/schedule/[id]/lab/route";
import { POST as startSessionPost } from "@/app/api/student/labs/[labId]/session/route";
import { PATCH as updateSessionPatch } from "@/app/api/student/labs/sessions/[sessionId]/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER_USER = { id: "teacher-1", schoolId: "school-1", role: "TEACHER" };
const STUDENT_USER = { id: "student-1", schoolId: "school-1", role: "STUDENT" };

const PLATFORM_LAB = {
  id: "lab-db-1",
  labId: "lab-sci-cell-g8",
  title: "Cell Division Virtual Lab",
  description: "Explore mitosis and meiosis interactively",
  subject: "SCIENCE",
  grade: 8,
  gradeBand: "7-9",
  labType: "simulation",
  estimatedMinutes: 30,
  difficulty: "intermediate",
  status: "published",
  schoolId: null, // platform-wide
  moeStandardCodes: ["SCI-G8-LIF-01"],
  triggerStandardCodes: ["SCI-G8-LIF-01"],
};

const SCHOOL_LAB = {
  ...PLATFORM_LAB,
  id: "lab-db-2",
  labId: "lab-sci-school-specific",
  title: "School-Specific Lab",
  schoolId: "school-1",
};

const SCHEDULED_WORK_RECORD = {
  id: "sw-1",
  classId: "class-1",
  suggestedLabs: [],
  class: { schoolId: "school-1" },
};

const LAB_SESSION_RECORD = {
  id: "sess-1",
  labId: "lab-sci-cell-g8",
  studentId: "student-1",
  schoolId: "school-1",
  scheduledWorkId: "sw-1",
  startedAt: null,
  completedAt: null,
  score: null,
  masteryUpdated: false,
  observations: null,
  conclusions: null,
};

function makeRequest(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

// ─── Tests: GET /api/teacher/labs ────────────────────────────────────────────

describe("GET /api/teacher/labs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockVirtualLabFindMany.mockResolvedValue([PLATFORM_LAB, SCHOOL_LAB]);
  });

  it("returns 404 when ENABLE_VIRTUAL_LABS flag is OFF", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    const res = await labsGet(makeRequest("GET", "http://localhost/api/teacher/labs"));

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns published labs including platform-wide and school-specific", async () => {
    const res = await labsGet(makeRequest("GET", "http://localhost/api/teacher/labs"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.labs).toHaveLength(2);
    const labIds = json.labs.map((l: any) => l.labId);
    expect(labIds).toContain("lab-sci-cell-g8");
    expect(labIds).toContain("lab-sci-school-specific");
  });

  it("queries with OR schoolId=null OR schoolId=teacher's school", async () => {
    await labsGet(makeRequest("GET", "http://localhost/api/teacher/labs"));

    const findManyArgs = mockVirtualLabFindMany.mock.calls[0][0];
    expect(findManyArgs.where.OR).toContainEqual({ schoolId: null });
    expect(findManyArgs.where.OR).toContainEqual({ schoolId: "school-1" });
  });

  it("applies subject filter from query param", async () => {
    await labsGet(makeRequest("GET", "http://localhost/api/teacher/labs?subject=SCIENCE"));

    const findManyArgs = mockVirtualLabFindMany.mock.calls[0][0];
    expect(findManyArgs.where.subject).toBe("SCIENCE");
  });

  it("applies grade filter from query param", async () => {
    await labsGet(makeRequest("GET", "http://localhost/api/teacher/labs?grade=8"));

    const findManyArgs = mockVirtualLabFindMany.mock.calls[0][0];
    expect(findManyArgs.where.grade).toBe(8);
  });
});

// ─── Tests: GET /api/teacher/labs/[labId] ────────────────────────────────────

describe("GET /api/teacher/labs/[labId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockVirtualLabFindUnique.mockResolvedValue(PLATFORM_LAB);
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    const res = await labDetailGet(
      makeRequest("GET", "http://localhost/api/teacher/labs/lab-sci-cell-g8"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 for a school-specific lab belonging to a different school", async () => {
    mockVirtualLabFindUnique.mockResolvedValue({
      ...SCHOOL_LAB,
      schoolId: "school-OTHER",
    });

    const res = await labDetailGet(
      makeRequest("GET", "http://localhost/api/teacher/labs/lab-sci-school-specific"),
      { params: { labId: "lab-sci-school-specific" } }
    );

    expect(res.status).toBe(403);
  });

  it("returns lab detail for a platform-wide lab (schoolId=null)", async () => {
    const res = await labDetailGet(
      makeRequest("GET", "http://localhost/api/teacher/labs/lab-sci-cell-g8"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lab.labId).toBe("lab-sci-cell-g8");
  });

  it("returns lab detail for a school-specific lab with matching schoolId", async () => {
    mockVirtualLabFindUnique.mockResolvedValue(SCHOOL_LAB);

    const res = await labDetailGet(
      makeRequest("GET", "http://localhost/api/teacher/labs/lab-sci-school-specific"),
      { params: { labId: "lab-sci-school-specific" } }
    );

    expect(res.status).toBe(200);
  });

  it("returns 404 when lab is not found", async () => {
    mockVirtualLabFindUnique.mockResolvedValue(null);

    const res = await labDetailGet(
      makeRequest("GET", "http://localhost/api/teacher/labs/nonexistent"),
      { params: { labId: "nonexistent" } }
    );

    expect(res.status).toBe(404);
  });
});

// ─── Tests: POST /api/teacher/schedule/[id]/lab ───────────────────────────────

describe("POST /api/teacher/schedule/[id]/lab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockScheduledWorkFindUnique.mockResolvedValue(SCHEDULED_WORK_RECORD);
    mockVirtualLabFindUnique.mockResolvedValue(PLATFORM_LAB);
    mockEnrollmentFindMany.mockResolvedValue([
      { Student: { userId: "student-1" } },
      { Student: { userId: "student-2" } },
    ]);
    mockLabSessionCreateMany.mockResolvedValue({ count: 2 });
    mockScheduledWorkUpdate.mockResolvedValue({ ...SCHEDULED_WORK_RECORD, suggestedLabs: [PLATFORM_LAB] });
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    const res = await linkLabPost(
      makeRequest("POST", "http://localhost/api/teacher/schedule/sw-1/lab", { labId: "lab-sci-cell-g8" }),
      { params: { id: "sw-1" } }
    );

    expect(res.status).toBe(404);
  });

  it("creates LabSession for each enrolled student", async () => {
    const res = await linkLabPost(
      makeRequest("POST", "http://localhost/api/teacher/schedule/sw-1/lab", { labId: "lab-sci-cell-g8" }),
      { params: { id: "sw-1" } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sessionCount).toBe(2);
    expect(mockLabSessionCreateMany).toHaveBeenCalledOnce();

    const createArgs = mockLabSessionCreateMany.mock.calls[0][0];
    expect(createArgs.data).toHaveLength(2);
    expect(createArgs.data[0].studentId).toBe("student-1");
    expect(createArgs.data[1].studentId).toBe("student-2");
  });

  it("returns 403 when scheduled work belongs to a different school", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      ...SCHEDULED_WORK_RECORD,
      class: { schoolId: "school-OTHER" },
    });

    const res = await linkLabPost(
      makeRequest("POST", "http://localhost/api/teacher/schedule/sw-1/lab", { labId: "lab-sci-cell-g8" }),
      { params: { id: "sw-1" } }
    );

    expect(res.status).toBe(403);
    expect(mockLabSessionCreateMany).not.toHaveBeenCalled();
  });

  it("calls logAudit with lab.linked action", async () => {
    await linkLabPost(
      makeRequest("POST", "http://localhost/api/teacher/schedule/sw-1/lab", { labId: "lab-sci-cell-g8" }),
      { params: { id: "sw-1" } }
    );

    expect(mockLogAudit).toHaveBeenCalledOnce();
    expect(mockLogAudit.mock.calls[0][0].action).toBe("lab.linked");
  });

  it("returns 400 when lab is not published", async () => {
    mockVirtualLabFindUnique.mockResolvedValue({ ...PLATFORM_LAB, status: "draft" });

    const res = await linkLabPost(
      makeRequest("POST", "http://localhost/api/teacher/schedule/sw-1/lab", { labId: "lab-sci-cell-g8" }),
      { params: { id: "sw-1" } }
    );

    expect(res.status).toBe(400);
  });
});

// ─── Tests: POST /api/student/labs/[labId]/session ───────────────────────────

describe("POST /api/student/labs/[labId]/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_USER);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockLabSessionFindFirst.mockResolvedValue(LAB_SESSION_RECORD);
    mockLabSessionUpdate.mockResolvedValue({ ...LAB_SESSION_RECORD, startedAt: new Date() });
  });

  it("returns 404 when no existing session found for this student/lab", async () => {
    mockLabSessionFindFirst.mockResolvedValue(null);

    const res = await startSessionPost(
      makeRequest("POST", "http://localhost/api/student/labs/lab-sci-cell-g8/session"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    const res = await startSessionPost(
      makeRequest("POST", "http://localhost/api/student/labs/lab-sci-cell-g8/session"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(404);
  });

  it("updates startedAt and returns session on first access", async () => {
    const res = await startSessionPost(
      makeRequest("POST", "http://localhost/api/student/labs/lab-sci-cell-g8/session"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session).toBeDefined();
    expect(mockLabSessionUpdate).toHaveBeenCalledOnce();
  });

  it("returns existing session without updating when already completed", async () => {
    mockLabSessionFindFirst.mockResolvedValue({
      ...LAB_SESSION_RECORD,
      completedAt: new Date("2026-03-01"),
    });

    const res = await startSessionPost(
      makeRequest("POST", "http://localhost/api/student/labs/lab-sci-cell-g8/session"),
      { params: { labId: "lab-sci-cell-g8" } }
    );

    expect(res.status).toBe(200);
    // No update should happen if already completed
    expect(mockLabSessionUpdate).not.toHaveBeenCalled();
  });
});

// ─── Tests: PATCH /api/student/labs/sessions/[sessionId] ─────────────────────

describe("PATCH /api/student/labs/sessions/[sessionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_USER);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockLabSessionFindUnique.mockResolvedValue(LAB_SESSION_RECORD);
    mockLabSessionUpdate.mockResolvedValue({
      ...LAB_SESSION_RECORD,
      score: 85,
      completedAt: new Date("2026-03-01T10:00:00Z"),
      masteryUpdated: false,
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-db-1" });
    mockScheduledWorkFindUnique.mockResolvedValue({
      content: { subject: "SCIENCE", grade: 8, moeAlignments: [{ code: "SCI-G8-LIF-01" }] },
    });
    mockStrandCatalogFindFirst.mockResolvedValue({ strandKey: "life-science-g7-9" });
    mockGradeToBand.mockReturnValue("7-9");
    mockUpdateMasteryProfile.mockResolvedValue(undefined);
  });

  it("returns 403 when sessionId belongs to a different student", async () => {
    mockLabSessionFindUnique.mockResolvedValue({
      ...LAB_SESSION_RECORD,
      studentId: "student-OTHER",
    });

    const res = await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
        score: 85,
        completedAt: "2026-03-01T10:00:00Z",
      }),
      { params: { sessionId: "sess-1" } }
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when session belongs to a different school", async () => {
    mockLabSessionFindUnique.mockResolvedValue({
      ...LAB_SESSION_RECORD,
      schoolId: "school-OTHER",
    });

    const res = await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 85 }),
      { params: { sessionId: "sess-1" } }
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);

    const res = await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 85 }),
      { params: { sessionId: "sess-1" } }
    );

    expect(res.status).toBe(404);
  });

  it("completes session with score and sets masteryUpdated=true", async () => {
    // First update returns the session; second update sets masteryUpdated=true
    mockLabSessionUpdate
      .mockResolvedValueOnce({
        ...LAB_SESSION_RECORD,
        score: 85,
        completedAt: new Date("2026-03-01T10:00:00Z"),
        masteryUpdated: false,
      })
      .mockResolvedValueOnce({
        ...LAB_SESSION_RECORD,
        score: 85,
        completedAt: new Date("2026-03-01T10:00:00Z"),
        masteryUpdated: true,
      });

    const res = await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
        score: 85,
        completedAt: "2026-03-01T10:00:00Z",
      }),
      { params: { sessionId: "sess-1" } }
    );

    expect(res.status).toBe(200);
    // Mastery service should have been called
    expect(mockUpdateMasteryProfile).toHaveBeenCalledOnce();
    // Second labSession.update call sets masteryUpdated=true
    expect(mockLabSessionUpdate).toHaveBeenCalledTimes(2);
    const masteryUpdateCall = mockLabSessionUpdate.mock.calls[1][0];
    expect(masteryUpdateCall.data.masteryUpdated).toBe(true);
  });

  it("does not call mastery service when session was already masteryUpdated", async () => {
    mockLabSessionFindUnique.mockResolvedValue({
      ...LAB_SESSION_RECORD,
      masteryUpdated: true,
      completedAt: new Date("2026-03-01T09:00:00Z"),
      score: 90,
    });

    await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
        score: 90,
        completedAt: "2026-03-01T10:00:00Z",
      }),
      { params: { sessionId: "sess-1" } }
    );

    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });

  it("persists observations and conclusions when provided", async () => {
    await updateSessionPatch(
      makeRequest("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
        observations: "Cells divided into two",
        conclusions: "Mitosis confirmed",
      }),
      { params: { sessionId: "sess-1" } }
    );

    const updateArgs = mockLabSessionUpdate.mock.calls[0][0];
    expect(updateArgs.data.observations).toBe("Cells divided into two");
    expect(updateArgs.data.conclusions).toBe("Mitosis confirmed");
  });
});
