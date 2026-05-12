import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const {
  mockPrisma,
  mockLogAudit,
  mockSendPushToUser,
  mockRequireRole,
  mockCheckRateLimit,
  mockRateLimitExceededResponse,
  mockResetRateLimitStateForTests,
} = vi.hoisted(() => {
  const mockPrisma = {
    enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
    class: { findFirst: vi.fn(), findMany: vi.fn() },
    discussionThread: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    discussionPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    discussionUpvote: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    discussionLastRead: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const mockLogAudit = vi.fn();
  const mockSendPushToUser = vi.fn();
  const mockRequireRole = vi.fn();
  const mockCheckRateLimit = vi.fn();
  const mockRateLimitExceededResponse = vi.fn();
  const mockResetRateLimitStateForTests = vi.fn();
  return {
    mockPrisma,
    mockLogAudit,
    mockSendPushToUser,
    mockRequireRole,
    mockCheckRateLimit,
    mockRateLimitExceededResponse,
    mockResetRateLimitStateForTests,
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/push/sendPush", () => ({
  sendPushToUser: mockSendPushToUser,
  sendPushToClass: vi.fn(),
  sendPushToMany: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: vi.fn(),
  authOptions: {},
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: mockRateLimitExceededResponse,
  resetRateLimitStateForTests: mockResetRateLimitStateForTests,
}));

import { NextRequest } from "next/server";

// ===== Helpers =====

const STUDENT_USER = { id: "student-user-1", role: "STUDENT", schoolId: "school-1", name: "Alice" };
const TEACHER_USER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1", name: "Mr. Smith" };
const ADMIN_USER = { id: "admin-1", role: "ADMIN", schoolId: "school-1", name: "Admin" };

function makeReq(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

const THREAD = {
  id: "thread-1",
  classId: "class-1",
  schoolId: "school-1",
  title: "What is photosynthesis?",
  authorId: "student-user-1",
  authorRole: "STUDENT",
  pinned: false,
  locked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  class: { gradeLevel: 8 },
};

const POST_RECORD = {
  id: "post-1",
  threadId: "thread-1",
  authorId: "student-user-1",
  authorRole: "STUDENT",
  body: "I think it involves chlorophyll",
  parentPostId: null,
  upvotes: 0,
  flagged: false,
  pending: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ===== Tests =====

// 1. Student can create thread in own class → 201
describe("POST /api/discussion/threads — student creates thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetRateLimitStateForTests.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
  });

  it("student enrolled in class can create a thread → 201", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      id: "enr-1",
      Class: { gradeLevel: 8, schoolId: "school-1" },
    });
    mockPrisma.discussionThread.create.mockResolvedValueOnce({
      id: "thread-1",
      classId: "class-1",
      schoolId: "school-1",
      title: "My Question",
      authorId: "student-user-1",
      authorRole: "STUDENT",
      pinned: false,
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { POST } = await import("@/app/api/discussion/threads/route");
    const req = makeReq("/api/discussion/threads", {
      method: "POST",
      body: { classId: "class-1", title: "My Question", body: "What is photosynthesis?" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.discussionThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ classId: "class-1", title: "My Question", schoolId: "school-1" }),
      })
    );
  });
});

// 2. Student cannot create thread in class they are not enrolled in → 403
describe("POST /api/discussion/threads — student NOT enrolled → 403", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when student is not enrolled in the class", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/discussion/threads/route");
    const req = makeReq("/api/discussion/threads", {
      method: "POST",
      body: { classId: "class-99", title: "Sneaky", body: "Trying to post" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

// 3. G1-6 student posts are pending by default
describe("POST /api/discussion/threads — G1-6 first post is pending", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates first post with pending=true for grade 6 student", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      id: "enr-1",
      Class: { gradeLevel: 6, schoolId: "school-1" },
    });
    mockPrisma.discussionThread.create.mockResolvedValueOnce({
      id: "thread-2",
      classId: "class-1",
      schoolId: "school-1",
      title: "Help!",
    });
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { POST } = await import("@/app/api/discussion/threads/route");
    const req = makeReq("/api/discussion/threads", {
      method: "POST",
      body: { classId: "class-1", title: "Help!", body: "I need help" },
    });
    await POST(req);

    // Check that the nested posts.create has pending: true
    const callArgs = mockPrisma.discussionThread.create.mock.calls[0][0];
    expect(callArgs.data.posts.create.pending).toBe(true);
  });
});

// 4. G7+ student posts are not pending
describe("POST /api/discussion/threads — G7+ first post is NOT pending", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates first post with pending=false for grade 7+ student", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      id: "enr-1",
      Class: { gradeLevel: 7, schoolId: "school-1" },
    });
    mockPrisma.discussionThread.create.mockResolvedValueOnce({
      id: "thread-3",
      classId: "class-1",
      schoolId: "school-1",
      title: "Question",
    });
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { POST } = await import("@/app/api/discussion/threads/route");
    const req = makeReq("/api/discussion/threads", {
      method: "POST",
      body: { classId: "class-1", title: "Question", body: "What is gravity?" },
    });
    await POST(req);

    const callArgs = mockPrisma.discussionThread.create.mock.calls[0][0];
    expect(callArgs.data.posts.create.pending).toBe(false);
  });
});

// 5. Teacher can approve pending post → pending: false
describe("PATCH /api/discussion/posts/[postId]/approve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher approving a post sets pending=false", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionPost.update.mockResolvedValueOnce({ ...POST_RECORD, pending: false });
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { PATCH } = await import("@/app/api/discussion/posts/[postId]/approve/route");
    const req = makeReq("/api/discussion/posts/post-1/approve", { method: "PATCH" });
    const res = await PATCH(req, { params: { postId: "post-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pending).toBe(false);
    expect(mockPrisma.discussionPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "post-1" }, data: { pending: false } })
    );
  });

  it("student cannot approve a post → 403", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { PATCH } = await import("@/app/api/discussion/posts/[postId]/approve/route");
    const req = makeReq("/api/discussion/posts/post-1/approve", { method: "PATCH" });
    const res = await PATCH(req, { params: { postId: "post-1" } } as any);
    expect(res.status).toBe(403);
  });
});

// 6. Teacher can pin thread → toggles pinned
describe("PATCH /api/discussion/threads/[threadId]/pin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher pins an unpinned thread → pinned toggles to true", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce({ ...THREAD, pinned: false });
    mockPrisma.discussionThread.update.mockResolvedValueOnce({ ...THREAD, pinned: true });

    const { PATCH } = await import("@/app/api/discussion/threads/[threadId]/pin/route");
    const req = makeReq("/api/discussion/threads/thread-1/pin", { method: "PATCH" });
    const res = await PATCH(req, { params: { threadId: "thread-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pinned).toBe(true);
    expect(mockPrisma.discussionThread.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pinned: true } })
    );
  });
});

// 7. Teacher can lock thread → toggles locked
describe("PATCH /api/discussion/threads/[threadId]/lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher locks an unlocked thread → locked toggles to true", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce({ ...THREAD, locked: false });
    mockPrisma.discussionThread.update.mockResolvedValueOnce({ ...THREAD, locked: true });

    const { PATCH } = await import("@/app/api/discussion/threads/[threadId]/lock/route");
    const req = makeReq("/api/discussion/threads/thread-1/lock", { method: "PATCH" });
    const res = await PATCH(req, { params: { threadId: "thread-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.locked).toBe(true);
    expect(mockPrisma.discussionThread.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { locked: true } })
    );
  });
});

// 8. Locked thread rejects new posts → 400
describe("POST /api/discussion/posts — locked thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns 400 when posting to a locked thread", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce({
      ...THREAD,
      locked: true,
      class: { gradeLevel: 8 },
    });

    const { POST } = await import("@/app/api/discussion/posts/route");
    const req = makeReq("/api/discussion/posts", {
      method: "POST",
      body: { threadId: "thread-1", body: "But the thread is locked!" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Thread is locked");
  });
});

// 9. Upvote is idempotent (existing upvote → "Already upvoted" 200)
describe("PATCH /api/discussion/posts/[postId]/upvote — idempotent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with 'Already upvoted' if user already upvoted", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionUpvote.findUnique.mockResolvedValueOnce({ id: "upvote-1", postId: "post-1", userId: "student-user-1" });

    const { PATCH } = await import("@/app/api/discussion/posts/[postId]/upvote/route");
    const req = makeReq("/api/discussion/posts/post-1/upvote", { method: "PATCH" });
    const res = await PATCH(req, { params: { postId: "post-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Already upvoted");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates upvote and increments count on first upvote", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionUpvote.findUnique.mockResolvedValueOnce(null);
    mockPrisma.$transaction.mockResolvedValueOnce([{ id: "upvote-new" }, { id: "post-1", upvotes: 1 }]);

    const { PATCH } = await import("@/app/api/discussion/posts/[postId]/upvote/route");
    const req = makeReq("/api/discussion/posts/post-1/upvote", { method: "PATCH" });
    const res = await PATCH(req, { params: { postId: "post-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.upvoted).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

// 10. Rate limit: 11th post in 24h returns 429
describe("POST /api/discussion/posts — rate limit enforced", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 429 when rate limit is exceeded", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce({
      ...THREAD,
      locked: false,
      class: { gradeLevel: 8 },
    });
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({ id: "enr-1" });
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 3600000 });
    mockRateLimitExceededResponse.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 })
    );

    const { POST } = await import("@/app/api/discussion/posts/route");
    const req = makeReq("/api/discussion/posts", {
      method: "POST",
      body: { threadId: "thread-1", body: "My 11th post today" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});

// 11. Teacher reply fires push to thread author
describe("POST /api/discussion/posts — teacher reply sends push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
  });

  it("sends push notification to thread author when teacher replies", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce({
      ...THREAD,
      authorId: "student-user-1", // different from teacher-1
      locked: false,
      class: { gradeLevel: 8 },
    });
    mockPrisma.class.findFirst.mockResolvedValueOnce({ id: "class-1", schoolId: "school-1" });
    mockPrisma.discussionPost.create.mockResolvedValueOnce({
      ...POST_RECORD,
      authorId: "teacher-1",
      authorRole: "TEACHER",
    });
    mockPrisma.discussionThread.update.mockResolvedValueOnce(THREAD);
    mockSendPushToUser.mockResolvedValueOnce(undefined);
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { POST } = await import("@/app/api/discussion/posts/route");
    const req = makeReq("/api/discussion/posts", {
      method: "POST",
      body: { threadId: "thread-1", body: "Great question about photosynthesis!" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "student-user-1",
      expect.objectContaining({ title: "Teacher replied to your question" })
    );
  });
});

// 12. DELETE thread: teacher succeeds (200), student gets 403
describe("DELETE /api/discussion/threads/[threadId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher can delete a thread → 200", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce(THREAD);
    mockPrisma.discussionThread.delete.mockResolvedValueOnce(THREAD);
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { DELETE } = await import("@/app/api/discussion/threads/[threadId]/route");
    const req = makeReq("/api/discussion/threads/thread-1", { method: "DELETE" });
    const res = await DELETE(req, { params: { threadId: "thread-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it("student cannot delete a thread → 403", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { DELETE } = await import("@/app/api/discussion/threads/[threadId]/route");
    const req = makeReq("/api/discussion/threads/thread-1", { method: "DELETE" });
    const res = await DELETE(req, { params: { threadId: "thread-1" } } as any);
    expect(res.status).toBe(403);
  });
});

// 13. DELETE post: author succeeds on own post
describe("DELETE /api/discussion/posts/[postId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student can delete their own post", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionPost.findUnique.mockResolvedValueOnce({
      ...POST_RECORD,
      authorId: "student-user-1",
    });
    mockPrisma.discussionPost.delete.mockResolvedValueOnce(POST_RECORD);
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { DELETE } = await import("@/app/api/discussion/posts/[postId]/route");
    const req = makeReq("/api/discussion/posts/post-1", { method: "DELETE" });
    const res = await DELETE(req, { params: { postId: "post-1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it("student cannot delete another student's post → 403", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionPost.findUnique.mockResolvedValueOnce({
      ...POST_RECORD,
      authorId: "another-student", // different author
    });

    const { DELETE } = await import("@/app/api/discussion/posts/[postId]/route");
    const req = makeReq("/api/discussion/posts/post-1", { method: "DELETE" });
    const res = await DELETE(req, { params: { postId: "post-1" } } as any);
    expect(res.status).toBe(403);
  });
});

// 14. Pending posts hidden from other students (OR filter)
describe("GET /api/discussion/threads/[threadId]/posts — pending visibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student query includes OR filter to hide others' pending posts", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce(THREAD);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({ id: "enr-1" });
    mockPrisma.discussionLastRead.upsert.mockResolvedValueOnce({ id: "lr-1" });
    mockPrisma.discussionPost.findMany.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/discussion/threads/[threadId]/posts/route");
    const req = makeReq("/api/discussion/threads/thread-1/posts");
    await GET(req, { params: { threadId: "thread-1" } } as any);

    const callArgs = mockPrisma.discussionPost.findMany.mock.calls[0][0];
    // Should include OR filter for student
    expect(callArgs.where).toMatchObject({
      threadId: "thread-1",
      parentPostId: null,
      OR: expect.arrayContaining([
        { pending: false },
        { authorId: "student-user-1" },
      ]),
    });
  });

  it("teacher query does NOT apply pending OR filter", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce(THREAD);
    mockPrisma.class.findFirst.mockResolvedValueOnce({ id: "class-1", schoolId: "school-1" });
    mockPrisma.discussionLastRead.upsert.mockResolvedValueOnce({ id: "lr-1" });
    mockPrisma.discussionPost.findMany.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/discussion/threads/[threadId]/posts/route");
    const req = makeReq("/api/discussion/threads/thread-1/posts");
    await GET(req, { params: { threadId: "thread-1" } } as any);

    const callArgs = mockPrisma.discussionPost.findMany.mock.calls[0][0];
    // Teacher should NOT have the OR filter restricting pending posts
    expect(callArgs.where.OR).toBeUndefined();
  });
});

// 15. DiscussionLastRead upserted on thread open (GET posts)
describe("GET /api/discussion/threads/[threadId]/posts — marks last read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts DiscussionLastRead when student opens a thread", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT_USER);
    mockPrisma.discussionThread.findUnique.mockResolvedValueOnce(THREAD);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({ id: "enr-1" });
    mockPrisma.discussionLastRead.upsert.mockResolvedValueOnce({ id: "lr-1", userId: "student-user-1", threadId: "thread-1", readAt: new Date() });
    mockPrisma.discussionPost.findMany.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/discussion/threads/[threadId]/posts/route");
    const req = makeReq("/api/discussion/threads/thread-1/posts");
    const res = await GET(req, { params: { threadId: "thread-1" } } as any);

    expect(res.status).toBe(200);
    expect(mockPrisma.discussionLastRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_threadId: { userId: "student-user-1", threadId: "thread-1" } },
        update: expect.objectContaining({ readAt: expect.any(Date) }),
        create: expect.objectContaining({ userId: "student-user-1", threadId: "thread-1" }),
      })
    );
  });
});
