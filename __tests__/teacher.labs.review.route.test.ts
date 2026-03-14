import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockVirtualLabFindUnique = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/db", () => ({
  prisma: {
    labSession: {
      findUnique: mockLabSessionFindUnique,
      update: mockLabSessionUpdate,
    },
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
    },
    virtualLab: {
      findUnique: mockVirtualLabFindUnique,
    },
  },
}));

import { GET, PATCH } from "@/app/api/teacher/labs/sessions/[sessionId]/route";

function makeRequest(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

const TEACHER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const ADMIN = { id: "admin-1", role: "ADMIN", schoolId: "school-1" };
const SESSION = {
  id: "session-1",
  labId: "lab-1",
  studentId: "student-1",
  schoolId: "school-1",
  scheduledWorkId: "scheduled-1",
  startedAt: new Date("2026-03-10T08:00:00Z"),
  completedAt: new Date("2026-03-10T08:30:00Z"),
  score: 78,
  teacherFeedback: null,
  student: { id: "student-1", name: "Mariama Doe", email: "mariama@school.lr" },
};
const SCHEDULED_WORK = {
  id: "scheduled-1",
  class: { teacherId: "teacher-1", schoolId: "school-1", name: "JSS 1 Science" },
};

describe("teacher lab review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockRequireRole.mockResolvedValue(TEACHER);
    mockLabSessionFindUnique.mockResolvedValue(SESSION);
    mockScheduledWorkFindUnique.mockResolvedValue(SCHEDULED_WORK);
    mockVirtualLabFindUnique.mockResolvedValue({
      labId: "lab-1",
      title: "Leaf Growth Investigation",
      payload: { labObjective: "Measure growth" },
    });
    mockLabSessionUpdate.mockResolvedValue({ ...SESSION, score: 88, teacherFeedback: "Clear observation work." });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when a teacher requests a session outside their class", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      ...SCHEDULED_WORK,
      class: { ...SCHEDULED_WORK.class, teacherId: "teacher-other" },
    });

    const response = await GET(makeRequest("GET", "http://localhost/api/teacher/labs/sessions/session-1"), {
      params: { sessionId: "session-1" },
    });

    expect(response.status).toBe(403);
    expect(mockVirtualLabFindUnique).not.toHaveBeenCalled();
  });

  it("allows an admin to load a same-school lab session", async () => {
    mockRequireRole.mockResolvedValue(ADMIN);

    const response = await GET(makeRequest("GET", "http://localhost/api/teacher/labs/sessions/session-1"), {
      params: { sessionId: "session-1" },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.className).toBe("JSS 1 Science");
    expect(json.lab.title).toBe("Leaf Growth Investigation");
  });

  it("persists teacher score and feedback, then logs audit", async () => {
    const response = await PATCH(
      makeRequest("PATCH", "http://localhost/api/teacher/labs/sessions/session-1", {
        score: 88,
        teacherFeedback: "The student recorded observations carefully and explained the result clearly.",
      }),
      { params: { sessionId: "session-1" } }
    );

    expect(response.status).toBe(200);
    expect(mockLabSessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: {
        score: 88,
        teacherFeedback: "The student recorded observations carefully and explained the result clearly.",
      },
    });
    expect(mockLogAudit).toHaveBeenCalledOnce();
    expect(mockLogAudit.mock.calls[0][0].action).toBe("lab.session.reviewed");
  });
});
