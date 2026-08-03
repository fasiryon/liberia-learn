import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Shared mock factory ──────────────────────────────────────────────────────

function makeAuthMock(role: string) {
  return {
    requireUser: vi.fn(async () => ({
      id: "user-1",
      role,
      schoolId: "school-1",
      isPlatformAdmin: false,
    })),
    requireRole: vi.fn(async () => ({
      id: "user-1",
      role,
      schoolId: "school-1",
      isPlatformAdmin: false,
    })),
    getOptionalUser: vi.fn(async () => null),
  };
}

function makePrismaMock() {
  return {
    student: {
      findUnique: vi.fn(),
    },
    scheduledWork: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    studentProgress: {
      create: vi.fn(),
    },
    curriculumContent: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    lessonAudio: {
      findMany: vi.fn(async () => []),
    },
  };
}

function makeRedisMock() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    del: vi.fn(async (key: string) => { store.delete(key); return 1; }),
    _store: store,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── FIX 2: student work route — APPROVED content gate ────────────────────────

describe("GET /api/student/work/[scheduledWorkId] — APPROVED content gate", () => {
  function makeScheduledWork(contentStatus: string) {
    return {
      id: "sw-1",
      classId: "class-1",
      classFormat: "standard",
      content: {
        contentId: "content-1",
        payload: { title: "Test Lesson", body: "Body content here." },
        subject: "MATH",
        grade: 7,
        contentType: "lesson",
        status: contentStatus,
        version: "1",
        deliveryProfile: null,
        moeAlignments: [],
        audioAssets: [],
        videoSupplements: [],
      },
      class: {
        id: "class-1",
        schoolId: "school-1",
        name: "Math 7A",
        Teacher: { name: "Mrs. Doe" },
        School: { name: "Test School" },
      },
      progress: [],
    };
  }

  it("returns 200 when content status is 'published'", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("STUDENT"));
    const prismaMock = makePrismaMock();
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.scheduledWork.findUnique.mockResolvedValue(makeScheduledWork("published"));
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "enrollment-1" });
    prismaMock.studentProgress.create.mockResolvedValue({});
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));
    vi.doMock("@/lib/autonomous/signals/productSignalService", () => ({
      logProductSignal: vi.fn(async () => {}),
    }));

    const { GET } = await import("@/app/api/student/work/[scheduledWorkId]/route");
    const req = new Request("http://localhost/api/student/work/sw-1") as any;
    const res = await GET(req, { params: Promise.resolve({ scheduledWorkId: "sw-1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 200 when content status is 'APPROVED'", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("STUDENT"));
    const prismaMock = makePrismaMock();
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.scheduledWork.findUnique.mockResolvedValue(makeScheduledWork("APPROVED"));
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "enrollment-1" });
    prismaMock.studentProgress.create.mockResolvedValue({});
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));
    vi.doMock("@/lib/autonomous/signals/productSignalService", () => ({
      logProductSignal: vi.fn(async () => {}),
    }));

    const { GET } = await import("@/app/api/student/work/[scheduledWorkId]/route");
    const req = new Request("http://localhost/api/student/work/sw-1") as any;
    const res = await GET(req, { params: Promise.resolve({ scheduledWorkId: "sw-1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 404 when content status is 'NEEDS_REVIEW'", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("STUDENT"));
    const prismaMock = makePrismaMock();
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.scheduledWork.findUnique.mockResolvedValue(makeScheduledWork("NEEDS_REVIEW"));
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "enrollment-1" });
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));
    vi.doMock("@/lib/autonomous/signals/productSignalService", () => ({
      logProductSignal: vi.fn(async () => {}),
    }));

    const { GET } = await import("@/app/api/student/work/[scheduledWorkId]/route");
    const req = new Request("http://localhost/api/student/work/sw-1") as any;
    const res = await GET(req, { params: Promise.resolve({ scheduledWorkId: "sw-1" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not yet approved/i);
  });

  it("returns 404 when content status is 'PENDING'", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("STUDENT"));
    const prismaMock = makePrismaMock();
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.scheduledWork.findUnique.mockResolvedValue(makeScheduledWork("PENDING"));
    prismaMock.enrollment.findUnique.mockResolvedValue({ id: "enrollment-1" });
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));
    vi.doMock("@/lib/autonomous/signals/productSignalService", () => ({
      logProductSignal: vi.fn(async () => {}),
    }));

    const { GET } = await import("@/app/api/student/work/[scheduledWorkId]/route");
    const req = new Request("http://localhost/api/student/work/sw-1") as any;
    const res = await GET(req, { params: Promise.resolve({ scheduledWorkId: "sw-1" }) });
    expect(res.status).toBe(404);
  });
});

// ── FIX 4: coverage API ───────────────────────────────────────────────────────

describe("GET /api/admin/curriculum/coverage — matrix + permissions", () => {
  beforeEach(() => {
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => makeRedisMock() },
    }));
  });

  it("returns matrix with approved/pending/needsReview counts", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("ADMIN"));
    const prismaMock = makePrismaMock();
    prismaMock.curriculumContent.findMany.mockResolvedValue([
      { id: "c1", grade: 7, subject: "MATH", status: "published" },
      { id: "c2", grade: 7, subject: "MATH", status: "published" },
      { id: "c3", grade: 7, subject: "MATH", status: "NEEDS_REVIEW" },
      { id: "c4", grade: 7, subject: "MATH", status: "PENDING" },
    ]);
    prismaMock.lessonAudio.findMany.mockResolvedValue([]);
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));

    const { GET } = await import("@/app/api/admin/curriculum/coverage/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const cell = body.matrix["G7"]["MATH"];
    expect(cell.approved).toBe(2);
    expect(cell.needsReview).toBe(1);
    expect(cell.pending).toBe(1);
  });

  it("summary.passingCells matches cells where approved >= 15", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("ADMIN"));
    const prismaMock = makePrismaMock();
    // 15 approved for G1/MATH only
    const rows = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      grade: 1,
      subject: "MATH",
      status: "published",
    }));
    prismaMock.curriculumContent.findMany.mockResolvedValue(rows);
    prismaMock.lessonAudio.findMany.mockResolvedValue([]);
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));

    const { GET } = await import("@/app/api/admin/curriculum/coverage/route");
    const res = await GET();
    const body = await res.json();
    expect(body.summary.passingCells).toBe(1);
    expect(body.matrix["G1"]["MATH"].meetsGate).toBe(true);
    expect(body.matrix["G1"]["MATH"].approved).toBe(15);
  });

  it("deserts array contains only cells with approved === 0", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("ADMIN"));
    const prismaMock = makePrismaMock();
    // Only G1/MATH has content
    prismaMock.curriculumContent.findMany.mockResolvedValue([
      { id: "c1", grade: 1, subject: "MATH", status: "published" },
    ]);
    prismaMock.lessonAudio.findMany.mockResolvedValue([]);
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));

    const { GET, GRADES, SUBJECTS } = await import("@/app/api/admin/curriculum/coverage/route");
    const res = await GET();
    const body = await res.json();
    // G1/MATH has 1 approved — should NOT be in deserts
    const hasMathG1Desert = body.deserts.some(
      (d: { grade: string; subject: string }) => d.grade === "G1" && d.subject === "MATH"
    );
    expect(hasMathG1Desert).toBe(false);
    // All other cells have 0 approved — should all be in deserts
    const expectedDeserts = (GRADES.length * SUBJECTS.length) - 1;
    expect(body.deserts.length).toBe(expectedDeserts);
  });

  it("returns 403 when TEACHER role requests coverage", async () => {
    vi.doMock("@/lib/auth", () => makeAuthMock("TEACHER"));
    vi.doMock("@/lib/db", () => ({ prisma: makePrismaMock() }));

    const { GET } = await import("@/app/api/admin/curriculum/coverage/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

// ── FIX 6: coverage cache invalidated on lesson approval ─────────────────────

describe("POST /api/admin/curriculum/approve — cache invalidation", () => {
  it("calls redis.del with coverage cache key after approval", async () => {
    const redisMock = makeRedisMock();
    // Pre-populate cache so del is meaningful
    redisMock._store.set("cache:curriculum:coverage", { cached: true });

    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => redisMock },
    }));
    vi.doMock("@/lib/auth", () => makeAuthMock("ADMIN"));
    const prismaMock = makePrismaMock();
    (prismaMock as any).curriculumContent = {
      findUnique: vi.fn(async () => ({
        id: "db-id-1",
        contentId: "content-approve-1",
        payload: {},
        status: "PENDING",
        grade: 7,
        subject: "MATH",
      })),
      update: vi.fn(async () => ({})),
    };
    (prismaMock as any).$transaction = vi.fn(async (callback: any) => callback({
      curriculumContent: (prismaMock as any).curriculumContent,
    }));
    (prismaMock as any).curriculumFeedback = { create: vi.fn(async () => ({})) };
    vi.doMock("@/lib/db", () => ({ prisma: prismaMock }));
    vi.doMock("@/lib/audit", () => ({
      logAudit: vi.fn(async () => {}),
      logAuditRequired: vi.fn(async () => {}),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isCurriculumFeedbackEnabled: () => false,
      isTeacherGenerationEnabled: () => true,
    }));
    vi.doMock("@/lib/ai/rag/embeddingService", () => ({ embedLesson: vi.fn(async () => {}) }));
    vi.doMock("@/lib/ai/rag/ragIngestionService", () => ({
      syncCurriculumContentRagChunks: vi.fn(async () => {}),
    }));
    vi.doMock("@/lib/queue", () => ({ isQueueConfigured: () => false }));
    vi.doMock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/admin/curriculum/approve/route");
    const req = new Request("http://localhost/api/admin/curriculum/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: "content-approve-1" }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(redisMock.del).toHaveBeenCalledWith("cache:curriculum:coverage");
  });
});
