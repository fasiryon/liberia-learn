/**
 * __tests__/workflow.assignmentTutor.test.ts — Block 12B
 *
 * Tests for POST /api/teacher/assignment/tutor:
 *   - flag OFF → 404
 *   - guardrails + fallback safety
 *   - structured JSON response always valid
 *   - no PII in payload/logs
 *   - budget exhaustion → 503
 *   - input validation
 *   - audit log written on success
 *   - non-TEACHER role denied
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole            = vi.hoisted(() => vi.fn());
const mockIsAssignmentTutorEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap  = vi.hoisted(() => vi.fn());
const mockRoutedCompletion       = vi.hoisted(() => vi.fn());
const mockLogAudit               = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent      = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAssignmentTutorEnabled:   mockIsAssignmentTutorEnabled,
  getAiBudgetMonthlyCap:      mockGetAiBudgetMonthlyCap,
}));
vi.mock("@/lib/ai/router", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/audit",          () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      aggregate: mockAiInteractionLogAggregate,
      create:    mockAiInteractionLogCreate,
    },
  },
}));

import { POST } from "@/app/api/teacher/assignment/tutor/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TEACHER = {
  id: "teacher-2",
  role: "TEACHER",
  schoolId: "school-bbb",
  isPlatformAdmin: false,
};

const VALID_BODY = {
  grade: 7,
  subject: "MATH",
  strandKey: "algebra.linear-equations",
  rubric: "Student must set up and solve a two-step linear equation. Show all working.",
  questionPrompt: "Solve for x: 2x + 5 = 17. Show your steps.",
};

const VALID_AI_RESPONSE = JSON.stringify({
  teachingHints: [
    "Model the two-step process explicitly on the board before students attempt.",
    "Emphasise the need to show each inverse operation.",
  ],
  anticipatedMisconceptions: [
    "Students may subtract before dividing instead of applying inverse operations in order.",
  ],
  scaffoldingSuggestions: [
    "Provide a partially completed worked example with blanks for students to fill in.",
    "Allow peer discussion after the first attempt.",
  ],
});

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/teacher/assignment/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function setupDefaults() {
  mockIsAssignmentTutorEnabled.mockReturnValue(true);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue(VALID_TEACHER);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-2" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: VALID_AI_RESPONSE,
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 150,
    outputTokens: 120,
    estimatedCostUSD: 0.00018,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — feature flag", () => {
  it("returns 404 when ENABLE_ASSIGNMENT_TUTOR=false", async () => {
    mockIsAssignmentTutorEnabled.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("assignment_tutor_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });
});

// ─── Valid response ───────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — valid response", () => {
  it("returns 200 with teachingHints array", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.teachingHints)).toBe(true);
    expect(body.teachingHints.length).toBeGreaterThan(0);
  });

  it("returns anticipatedMisconceptions array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.anticipatedMisconceptions)).toBe(true);
  });

  it("returns scaffoldingSuggestions array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.scaffoldingSuggestions)).toBe(true);
  });

  it("returns hadFallback=false on success", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.hadFallback).toBe(false);
  });
});

// ─── No PII in payload/logs ───────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — no PII", () => {
  it("prompt does not contain student identifiers", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    expect(allText).not.toMatch(/student.*id/i);
    expect(allText).not.toContain(VALID_TEACHER.id);
    expect(allText).not.toContain(VALID_TEACHER.schoolId);
  });

  it("audit log details do not contain studentId", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.details).not.toHaveProperty("studentId");
    expect(JSON.stringify(auditArgs.details)).not.toContain("student-");
  });

  it("audit log action is correct", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.action).toBe("assignment.tutor.used");
  });
});

// ─── Fallback safety ──────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — fallback", () => {
  it("returns 200 with hadFallback=true when AI throws", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("AI unavailable"));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(Array.isArray(body.teachingHints)).toBe(true);
    expect(body.teachingHints.length).toBeGreaterThan(0);
  });

  it("returns 200 with hadFallback=true when AI returns invalid JSON", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "Here are some tips but not JSON",
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 50,
      outputTokens: 20,
      estimatedCostUSD: 0,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
  });
});

// ─── Budget exhaustion ────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — budget", () => {
  it("returns a graceful fallback when the shared budget guard blocks the request", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        teachingHints: [
          "Break the task into smaller sub-questions and guide students through each step.",
        ],
        anticipatedMisconceptions: [
          "Students may confuse surface features of the question with the underlying concept.",
        ],
        scaffoldingSuggestions: [
          "Provide a sentence starter or partially completed model answer for students who are stuck.",
        ],
      }),
      tier: "smart",
      model: "budget_guard",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      budgetBlocked: true,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).hadFallback).toBe(true);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — auth", () => {
  it("returns 403 when user is not TEACHER", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("POST /api/teacher/assignment/tutor — input validation", () => {
  it("returns 400 when subject is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, subject: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when strandKey is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, strandKey: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rubric is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, rubric: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questionPrompt is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, questionPrompt: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when grade is out of range", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, grade: 15 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when grade is 0", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, grade: 0 }));
    expect(res.status).toBe(400);
  });
});
