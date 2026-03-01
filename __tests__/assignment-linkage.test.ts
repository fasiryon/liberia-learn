import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockGenerateAssessmentItems = vi.hoisted(() => vi.fn());

const mockIsAssignmentLessonLinkageEnabled = vi.hoisted(() => vi.fn());
const mockIsAiAssignmentGenerationEnabled = vi.hoisted(() => vi.fn());
const mockIsAbBlockSchedulingEnabled = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn());
const mockIsDeliveryComplianceReportingEnabled = vi.hoisted(() => vi.fn());

const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockContentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkCreate = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionCreate = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionUpdate = vi.hoisted(() => vi.fn());
const mockAssignmentCreate = vi.hoisted(() => vi.fn());
const mockVirtualLabFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/curriculum-helpers", () => ({
  generateAssessmentItems: mockGenerateAssessmentItems,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isAssignmentLessonLinkageEnabled: mockIsAssignmentLessonLinkageEnabled,
    isAiAssignmentGenerationEnabled: mockIsAiAssignmentGenerationEnabled,
    isAbBlockSchedulingEnabled: mockIsAbBlockSchedulingEnabled,
    isVirtualLabsEnabled: mockIsVirtualLabsEnabled,
    isDeliveryComplianceReportingEnabled: mockIsDeliveryComplianceReportingEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: mockClassFindUnique },
    curriculumContent: { findUnique: mockCurriculumContentFindUnique },
    scheduledWork: {
      create: mockScheduledWorkCreate,
      findUnique: mockScheduledWorkFindUnique,
    },
    assignmentSuggestion: {
      findUnique: mockAssignmentSuggestionFindUnique,
      create: mockAssignmentSuggestionCreate,
      update: mockAssignmentSuggestionUpdate,
    },
    assignment: { create: mockAssignmentCreate },
    virtualLab: { findMany: mockVirtualLabFindMany },
  },
}));

import { POST as schedulePost } from "@/app/api/teacher/schedule/route";
import { POST as acceptPost } from "@/app/api/teacher/assignment-suggestions/[id]/accept/route";
import { POST as dismissPost } from "@/app/api/teacher/assignment-suggestions/[id]/dismiss/route";
import { POST as generatePost } from "@/app/api/teacher/assignments/generate/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER_USER = { id: "u1", schoolId: "school-1", role: "TEACHER" };

const CONTENT_WITH_EXIT_TICKET = {
  id: "content-pk-1",
  grade: 6,
  subject: "MATH",
  moeAlignments: [{ code: "MATH-G6-ALG-01" }],
  payload: { title: "Algebra Basics" },
  deliveryProfile: {
    estimatedMinutes: 45,
    exitTicket: {
      questions: [
        { question: "Q1", type: "mcq", standardCode: "MATH-G6-ALG-01", choices: ["A", "B"] },
        { question: "Q2", type: "short_answer", standardCode: "MATH-G6-ALG-01", choices: [] },
      ],
    },
  },
};

const CONTENT_NO_EXIT_TICKET = {
  id: "content-pk-2",
  grade: 6,
  subject: "MATH",
  moeAlignments: [],
  payload: { title: "Simple Lesson" },
  deliveryProfile: null,
};

const SUGGESTION_PENDING = {
  id: "as-1",
  schoolId: "school-1",
  classId: "class-1",
  contentId: "content-pk-1",
  scheduledWorkId: "sw-1",
  suggestedTitle: "Check for Understanding: Algebra Basics",
  suggestedDueDate: new Date("2026-03-04"),
  moeStandardCodes: ["MATH-G6-ALG-01"],
  status: "pending",
};

const SUGGESTION_ACCEPTED = { ...SUGGESTION_PENDING, status: "accepted" };

function makePostRequest(url: string, body: object) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeAcceptParams(id = "as-1") {
  return { params: { id } };
}

// ─── Tests: schedule POST auto-creates AssignmentSuggestion ──────────────────

describe("POST /api/teacher/schedule — assignment suggestion auto-creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(true);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);
    mockClassFindUnique.mockResolvedValue({ schoolId: "school-1" });
    mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_WITH_EXIT_TICKET);
    mockScheduledWorkCreate.mockResolvedValue({ id: "sw-1", classId: "class-1", suggestedLabs: null });
    mockAssignmentSuggestionCreate.mockResolvedValue({ id: "as-1" });
    mockVirtualLabFindMany.mockResolvedValue([]);
  });

  it("creates AssignmentSuggestion when exitTicket is present and flag is ON", async () => {
    await schedulePost(
      makePostRequest("http://localhost/api/teacher/schedule", {
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    expect(mockAssignmentSuggestionCreate).toHaveBeenCalledOnce();
    const createArgs = mockAssignmentSuggestionCreate.mock.calls[0][0];
    expect(createArgs.data.status).toBe("pending");
    expect(createArgs.data.schoolId).toBe("school-1");
    expect(createArgs.data.classId).toBe("class-1");
    expect(createArgs.data.scheduledWorkId).toBe("sw-1");
  });

  it("does NOT create AssignmentSuggestion when linkage flag is OFF", async () => {
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);

    await schedulePost(
      makePostRequest("http://localhost/api/teacher/schedule", {
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    expect(mockAssignmentSuggestionCreate).not.toHaveBeenCalled();
  });

  it("does NOT create AssignmentSuggestion when content has no exitTicket", async () => {
    mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_NO_EXIT_TICKET);

    await schedulePost(
      makePostRequest("http://localhost/api/teacher/schedule", {
        contentId: "content-pk-2",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    expect(mockAssignmentSuggestionCreate).not.toHaveBeenCalled();
  });

  it("includes moeStandardCodes from moeAlignments in the suggestion", async () => {
    await schedulePost(
      makePostRequest("http://localhost/api/teacher/schedule", {
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    const createArgs = mockAssignmentSuggestionCreate.mock.calls[0][0];
    expect(createArgs.data.moeStandardCodes).toContain("MATH-G6-ALG-01");
  });

  it("sets suggestedDueDate to scheduledDate + 1 day", async () => {
    await schedulePost(
      makePostRequest("http://localhost/api/teacher/schedule", {
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    const createArgs = mockAssignmentSuggestionCreate.mock.calls[0][0];
    const expectedDue = new Date("2026-03-04");
    expect(createArgs.data.suggestedDueDate.toDateString()).toBe(expectedDue.toDateString());
  });
});

// ─── Tests: accept suggestion ─────────────────────────────────────────────────

describe("POST /api/teacher/assignment-suggestions/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(true);
    mockAssignmentSuggestionFindUnique.mockResolvedValue(SUGGESTION_PENDING);
    mockAssignmentCreate.mockResolvedValue({
      id: "assignment-1",
      classId: "class-1",
      title: SUGGESTION_PENDING.suggestedTitle,
    });
    mockAssignmentSuggestionUpdate.mockResolvedValue({ ...SUGGESTION_PENDING, status: "accepted" });
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);

    const res = await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(404);
  });

  it("creates an Assignment and marks suggestion as accepted", async () => {
    const res = await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(200);
    expect(mockAssignmentCreate).toHaveBeenCalledOnce();
    expect(mockAssignmentSuggestionUpdate).toHaveBeenCalledOnce();

    const updateArgs = mockAssignmentSuggestionUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("accepted");
  });

  it("returns the created assignment in the response", async () => {
    const res = await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    const json = await res.json();
    expect(json.assignment).toBeDefined();
    expect(json.assignment.id).toBe("assignment-1");
  });

  it("sets generationMethod=suggested on the created assignment", async () => {
    await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    const createArgs = mockAssignmentCreate.mock.calls[0][0];
    expect(createArgs.data.generationMethod).toBe("suggested");
  });

  it("returns 400 when suggestion is already accepted", async () => {
    mockAssignmentSuggestionFindUnique.mockResolvedValue(SUGGESTION_ACCEPTED);

    const res = await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/accepted/i);
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when suggestion belongs to a different school", async () => {
    mockAssignmentSuggestionFindUnique.mockResolvedValue({
      ...SUGGESTION_PENDING,
      schoolId: "school-OTHER",
    });

    const res = await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(404);
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });

  it("calls logAudit with assignment.suggestion.accepted on success", async () => {
    await acceptPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(mockLogAudit).toHaveBeenCalledOnce();
    const auditArgs = mockLogAudit.mock.calls[0][0];
    expect(auditArgs.action).toBe("assignment.suggestion.accepted");
    expect(auditArgs.schoolId).toBe("school-1");
  });
});

// ─── Tests: dismiss suggestion ────────────────────────────────────────────────

describe("POST /api/teacher/assignment-suggestions/[id]/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(true);
    mockAssignmentSuggestionFindUnique.mockResolvedValue(SUGGESTION_PENDING);
    mockAssignmentSuggestionUpdate.mockResolvedValue({ ...SUGGESTION_PENDING, status: "dismissed" });
  });

  it("returns 404 when flag is OFF", async () => {
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);

    const res = await dismissPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(404);
  });

  it("marks suggestion as dismissed and returns { ok: true }", async () => {
    const res = await dismissPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const updateArgs = mockAssignmentSuggestionUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("dismissed");
  });

  it("returns 404 when suggestion belongs to a different school", async () => {
    mockAssignmentSuggestionFindUnique.mockResolvedValue({
      ...SUGGESTION_PENDING,
      schoolId: "school-OTHER",
    });

    const res = await dismissPost(makePostRequest("http://localhost", {}), makeAcceptParams());

    expect(res.status).toBe(404);
    expect(mockAssignmentSuggestionUpdate).not.toHaveBeenCalled();
  });
});

// ─── Tests: POST /api/teacher/assignments/generate ────────────────────────────

describe("POST /api/teacher/assignments/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsAiAssignmentGenerationEnabled.mockReturnValue(true);
    mockClassFindUnique.mockResolvedValue({ schoolId: "school-1" });
    mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_WITH_EXIT_TICKET);
    mockGenerateAssessmentItems.mockReturnValue([
      { question: "What is x?", type: "short_answer", standardCode: "MATH-G6-ALG-01" },
    ]);
  });

  it("returns 404 when ENABLE_AI_ASSIGNMENT_GENERATION flag is OFF", async () => {
    mockIsAiAssignmentGenerationEnabled.mockReturnValue(false);

    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        classId: "class-1",
        contentId: "content-pk-1",
        assignmentType: "quiz",
      })
    );

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns a draft without saving to DB", async () => {
    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        classId: "class-1",
        contentId: "content-pk-1",
        assignmentType: "quiz",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft).toBeDefined();
    expect(json.draft.generationMethod).toBe("ai_generated");
    // Verify nothing was written to the assignments table
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });

  it("draft includes title, questions, moeStandardCodes, contentId", async () => {
    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        classId: "class-1",
        contentId: "content-pk-1",
        assignmentType: "quiz",
      })
    );

    const json = await res.json();
    expect(json.draft.title).toContain("Quiz");
    expect(json.draft.questions).toBeDefined();
    expect(json.draft.moeStandardCodes).toContain("MATH-G6-ALG-01");
    expect(json.draft.contentId).toBe("content-pk-1");
  });

  it("returns 400 when classId is missing", async () => {
    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        contentId: "content-pk-1",
        assignmentType: "quiz",
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when assignmentType is missing", async () => {
    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        classId: "class-1",
        contentId: "content-pk-1",
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 403 when class belongs to a different school", async () => {
    mockClassFindUnique.mockResolvedValue({ schoolId: "school-OTHER" });

    const res = await generatePost(
      makePostRequest("http://localhost/api/teacher/assignments/generate", {
        classId: "class-1",
        contentId: "content-pk-1",
        assignmentType: "quiz",
      })
    );

    expect(res.status).toBe(403);
  });
});
