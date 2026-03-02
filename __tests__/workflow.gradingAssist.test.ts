// SILENCE_GRADING_ASSIST_LOGS
// Prevent noisy stderr output during this test file.
import { beforeAll, afterAll } from "vitest";
const __origConsoleError = console.error;
const __origConsoleWarn  = console.warn;

beforeAll(() => {
  console.error = () => {};
  console.warn  = () => {};
});

afterAll(() => {
  console.error = __origConsoleError;
  console.warn  = __origConsoleWarn;
});

/**
 * __tests__/workflow.gradingAssist.test.ts — Block 12B
 *
 * Tests for POST /api/teacher/grading/assist:
 *   - flag OFF → 404
 *   - punitive language guardrail triggers fallback
 *   - structured JSON response always valid
 *   - teacherFinalAuthority always true
 *   - no PII in prompt / submissionContent not in audit log
 *   - fallback safety (AI throw + invalid JSON)
 *   - budget exhaustion → 503
 *   - non-TEACHER role denied
 *   - input validation
 *   - audit log written on success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole              = vi.hoisted(() => vi.fn());
const mockIsAiGradingAssistEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap    = vi.hoisted(() => vi.fn());
const mockRoutedCompletion         = vi.hoisted(() => vi.fn());
const mockLogAudit                 = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent        = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate   = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAiGradingAssistEnabled: mockIsAiGradingAssistEnabled,
  getAiBudgetMonthlyCap:    mockGetAiBudgetMonthlyCap,
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

import { POST } from "@/app/api/teacher/grading/assist/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TEACHER = {
  id: "teacher-3",
  role: "TEACHER",
  schoolId: "school-ccc",
  isPlatformAdmin: false,
};

const VALID_BODY = {
  subject: "SCIENCE",
  strandKey: "biology.cells",
  rubric:
    "Student must describe the structure and function of the cell membrane. Include diffusion and osmosis.",
  submissionContent:
    "The cell membrane controls what enters and exits the cell. It allows small molecules to pass through by diffusion.",
};

const VALID_AI_RESPONSE = JSON.stringify({
  feedback: [
    "Good explanation of the cell membrane's selective permeability.",
    "Osmosis was not explicitly addressed — include this in revision.",
  ],
  suggestedScoreBands: [
    { label: "Approaching Standard", scoreRange: "50–74%" },
  ],
  strengths: ["Clear description of diffusion concept."],
  areasForDevelopment: [
    "Expand on osmosis and provide a specific example.",
  ],
});

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/teacher/grading/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function setupDefaults() {
  mockIsAiGradingAssistEnabled.mockReturnValue(true);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue(VALID_TEACHER);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-3" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: VALID_AI_RESPONSE,
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 200,
    outputTokens: 150,
    estimatedCostUSD: 0.00022,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — feature flag", () => {
  it("returns 404 when ENABLE_AI_GRADING_ASSIST=false", async () => {
    mockIsAiGradingAssistEnabled.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("ai_grading_assist_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });
});

// ─── Valid response ───────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — valid response", () => {
  it("returns 200 with feedback array", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.feedback)).toBe(true);
    expect(body.feedback.length).toBeGreaterThan(0);
  });

  it("returns suggestedScoreBands array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.suggestedScoreBands)).toBe(true);
  });

  it("returns strengths array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.strengths)).toBe(true);
  });

  it("returns areasForDevelopment array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.areasForDevelopment)).toBe(true);
  });

  it("teacherFinalAuthority is always true", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.teacherFinalAuthority).toBe(true);
  });

  it("returns hadFallback=false on clean AI response", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.hadFallback).toBe(false);
  });
});

// ─── Punitive language guardrail ──────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — punitive language guardrail", () => {
  it("returns hadFallback=true when AI response contains punitive keywords", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        feedback: [
          "This is a failure of basic understanding. The student is incompetent.",
        ],
        suggestedScoreBands: [{ label: "Below Standard", scoreRange: "0–49%" }],
        strengths: [],
        areasForDevelopment: ["Student shows deficit thinking."],
      }),
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 60,
      estimatedCostUSD: 0.0001,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(body.teacherFinalAuthority).toBe(true);
  });

  it("fallback feedback is non-punitive and non-empty", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("AI unavailable"));
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(Array.isArray(body.feedback)).toBe(true);
    expect(body.feedback.length).toBeGreaterThan(0);
    const feedbackText = body.feedback.join(" ").toLowerCase();
    expect(feedbackText).not.toMatch(/fail|incompetent|lazy|stupid/);
  });
});

// ─── Fallback safety ──────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — fallback", () => {
  it("returns 200 with hadFallback=true when AI throws", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("AI timeout"));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(body.teacherFinalAuthority).toBe(true);
  });

  it("returns 200 with hadFallback=true when AI returns invalid JSON", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "Here is my feedback in plain prose, no JSON here",
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

describe("POST /api/teacher/grading/assist — budget", () => {
  it("returns 503 when monthly budget is exhausted", async () => {
    mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 100 } });
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — auth", () => {
  it("returns 403 when user is not TEACHER", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
});

// ─── PII checks ───────────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — PII checks", () => {
  it("prompt does not contain teacher/school identifiers", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    // No camelCase or colon-style PII field names in prompt
    expect(allText).not.toMatch(/studentId\s*[":=]/i);
    expect(allText).not.toMatch(/student[_-]id/i);
    expect(allText).not.toContain(VALID_TEACHER.id);
    expect(allText).not.toContain(VALID_TEACHER.schoolId);
  });

  it("audit log does not contain submissionContent", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    const serialized = JSON.stringify(auditArgs.details);
    // First 20 chars of submissionContent must not appear in audit log
    expect(serialized).not.toContain(VALID_BODY.submissionContent.slice(0, 20));
  });

  it("audit log action is correct", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.action).toBe("grading.assist.used");
  });

  it("audit log does not have studentId field", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.details).not.toHaveProperty("studentId");
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("POST /api/teacher/grading/assist — input validation", () => {
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

  it("returns 400 when submissionContent is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, submissionContent: "" }));
    expect(res.status).toBe(400);
  });
});
