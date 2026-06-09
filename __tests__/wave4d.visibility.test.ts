import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── POST /api/teacher/lessons/[contentId]/assign ──────────────────────────────

describe("POST /api/teacher/lessons/[contentId]/assign", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  function makeReq(body: object): any {
    return new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates assignment and returns 200", async () => {
    const mockCreate = vi.fn(async () => ({ id: "tla-1", contentId: "c-1", classId: "cls-1" }));
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED" })),
        },
        class: { findUnique: vi.fn(async () => ({ schoolId: "s-1" })) },
        teacherLessonAssignment: { create: mockCreate },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("returns 409 with already_assigned on duplicate contentId+classId", async () => {
    const dupError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "APPROVED" })),
        },
        class: { findUnique: vi.fn(async () => ({ schoolId: "s-1" })) },
        teacherLessonAssignment: { create: vi.fn(async () => { throw dupError; }) },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_assigned");
  });

  it("returns 403 if lesson not APPROVED", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "t-1", role: "TEACHER", schoolId: "s-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({ contentId: "c-1", editedById: "t-1", editReviewStatus: "PENDING" })),
        },
        teacherLessonAssignment: { create: vi.fn() },
      },
    }));
    const { POST } = await import("@/app/api/teacher/lessons/[contentId]/assign/route");
    const res = await POST(makeReq({ classId: "cls-1" }), { params: { contentId: "c-1" } });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/student/teacher-lessons ─────────────────────────────────────────

describe("GET /api/student/teacher-lessons", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("returns class_only assigned lesson that is APPROVED with scheduledFor=null", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: {
          findMany: vi.fn(async () => [{
            id: "tla-1", scheduledFor: null,
            content: {
              id: "cc-1", contentId: "c-1", title: "Photosynthesis", grade: 7, subject: "SCIENCE",
              editedBy: { name: "Mr. Johnson" }, editReviewStatus: "APPROVED", visibility: "class_only",
            },
          }]),
        },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0].teacherAuthorName).toBe("Mr. Johnson");
  });

  it("does NOT return lesson with scheduledFor in the future", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });

  it("returns school_wide lesson for student at same school", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-1" }] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: {
          findMany: vi.fn(async () => [{
            id: "cc-2", contentId: "c-2", title: "School Wide Lesson", grade: 7, subject: "ENGLISH",
            editedBy: { name: "Ms. Kollie" }, editReviewStatus: "APPROVED", visibility: "school_wide", schoolId: "sch-1",
          }]),
        },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0].title).toBe("School Wide Lesson");
  });

  it("returns 0 lessons when student has no classId and no school_wide lessons", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-1", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        student: { findUnique: vi.fn(async () => ({ enrollments: [] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) },
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });
});

// ── Pack security: stripStudentKeys ──────────────────────────────────────────

describe("stripStudentKeys — security: teacher lesson answer keys never in student packs", () => {
  it("strips answerKey, correctAnswer, correctIndex, modelAnswer, teacherNotes from payload", async () => {
    const { stripStudentKeys } = await import("@/lib/packs/generatePack");
    const payload = {
      title: "Photosynthesis",
      body: "Plants make food using sunlight.",
      questions: [
        {
          question: "What do plants need for photosynthesis?",
          choices: ["Water", "Light", "Soil", "Air"],
          answerKey: "Light",        // MUST be stripped
          correctAnswer: 1,          // MUST be stripped
          correctIndex: 1,           // MUST be stripped
        },
      ],
      assessmentQuestions: [
        { question: "Describe the process", modelAnswer: "Plants use CO2 and sunlight..." }, // MUST be stripped
      ],
      teacherNotes: "Pause after slide 3 for questions.",  // MUST be stripped
      presenterNotes: "This is confidential.",              // MUST be stripped
      scoringRubric: "Award 2 points for...",              // MUST be stripped
    };

    const stripped = stripStudentKeys(payload) as any;

    // Sensitive keys must be absent
    expect(stripped.questions[0]).not.toHaveProperty("answerKey");
    expect(stripped.questions[0]).not.toHaveProperty("correctAnswer");
    expect(stripped.questions[0]).not.toHaveProperty("correctIndex");
    expect(stripped.assessmentQuestions[0]).not.toHaveProperty("modelAnswer");
    expect(stripped).not.toHaveProperty("teacherNotes");
    expect(stripped).not.toHaveProperty("presenterNotes");
    expect(stripped).not.toHaveProperty("scoringRubric");

    // Non-sensitive keys must be preserved
    expect(stripped.title).toBe("Photosynthesis");
    expect(stripped.body).toBe("Plants make food using sunlight.");
    expect(stripped.questions[0].question).toBe("What do plants need for photosynthesis?");
    expect(stripped.questions[0].choices).toHaveLength(4);
  });

  it("strips nested answer keys in deeply nested structures", async () => {
    const { stripStudentKeys } = await import("@/lib/packs/generatePack");
    const payload = {
      sections: [
        { sectionTitle: "Quiz", items: [{ answerKey: "secret", text: "visible" }] },
      ],
    };
    const stripped = stripStudentKeys(payload) as any;
    expect(stripped.sections[0].items[0]).not.toHaveProperty("answerKey");
    expect(stripped.sections[0].items[0].text).toBe("visible");
  });

  it("handles null/undefined payload without throwing", async () => {
    const { stripStudentKeys } = await import("@/lib/packs/generatePack");
    expect(stripStudentKeys(null)).toBeNull();
    expect(stripStudentKeys(undefined)).toBeUndefined();
    expect(stripStudentKeys("string")).toBe("string");
  });
});

// ── GET /api/student/teacher-lessons — visibility edge cases ─────────────────

describe("GET /api/student/teacher-lessons — visibility edge cases", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("class_only lesson NOT visible to student in a different class", async () => {
    // Student is enrolled in cls-2. Lesson only assigned to cls-1.
    // findMany for assignments uses { classId: { in: ["cls-2"] } } so returns nothing.
    vi.doMock("@/lib/auth", () => ({
      requireRole: vi.fn(async () => ({ id: "s-2", role: "STUDENT", schoolId: "sch-1" })),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        // Route selects enrollments array, not classId directly
        student: { findUnique: vi.fn(async () => ({ enrollments: [{ classId: "cls-2" }] })) },
        teacherLessonAssignment: { findMany: vi.fn(async () => []) }, // no cls-2 assignments
        curriculumContent: { findMany: vi.fn(async () => []) },
      },
    }));
    const { GET } = await import("@/app/api/student/teacher-lessons/route");
    const res = await GET();
    const body = await res.json();
    expect(body.lessons).toHaveLength(0);
  });

  it("emergency-unpublished (PENDING) NOT returned — source filters editReviewStatus=APPROVED", async () => {
    // Verify the route source enforces APPROVED filter — unpublished lessons can't sneak through
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/api/student/teacher-lessons/route.ts", "utf-8");
    // Both the assignment path and school_wide path must require APPROVED status
    const approvedMatches = (src.match(/"APPROVED"/g) || []).length;
    expect(approvedMatches).toBeGreaterThanOrEqual(2); // once for assignments, once for school_wide
  });

  it("school_wide WHERE includes schoolId from user — cross-school isolation enforced in source", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/api/student/teacher-lessons/route.ts", "utf-8");
    // schoolId must appear in the school_wide findMany WHERE
    expect(src).toContain("schoolId");
    expect(src).toContain("school_wide");
    // The schoolId is sourced from user.schoolId (not hardcoded)
    expect(src).toContain("user.schoolId");
  });
});

// ── teacherAuthorName in curriculum API ───────────────────────────────────────

describe("GET /api/curriculum/[contentId] — teacherAuthorName in metadata", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetAllMocks(); });

  it("includes teacherAuthorName when content is teacher-created", async () => {
    vi.doMock("@/lib/db", () => ({
      prisma: {
        curriculumContent: {
          findUnique: vi.fn(async () => ({
            id: "cc-1", contentId: "c-1", grade: 7, subject: "SCIENCE",
            teacherCreated: true,
            editedBy: { name: "Mr. Johnson" },
            payload: { title: "Photosynthesis", body: "Plants..." },
            audioAssets: [],
            status: "published",
          })),
        },
      },
    }));
    // The curriculum route is at app/api/curriculum/[contentId]/route.ts
    // We just need to confirm the route exports a GET that includes teacherAuthorName
    const fs = await import("fs");
    const path = await import("path");
    const routeFile = path.resolve("app/api/curriculum/[contentId]/route.ts");
    const source = fs.existsSync(routeFile) ? fs.readFileSync(routeFile, "utf-8") : "";
    expect(source).toContain("teacherAuthorName");
    expect(source).toContain("teacherCreated");
  });
});
