/**
 * __tests__/ops-explain.test.ts
 *
 * Tests for POST /api/admin/ops/findings/[findingId]/explain
 *
 * Validates:
 *   - 403 when OPS_AI_EXPLANATIONS_ENABLED=false
 *   - 403 when finding severity is below OPS_AI_MIN_SEVERITY threshold
 *   - 404 when finding does not exist
 *   - 403 when finding belongs to a different school (tenant isolation)
 *   - 502 when OpenAI returns non-JSON output (safe failure)
 *   - 502 when OpenAI returns JSON missing required fields
 *   - 201 + stored explanation on success
 *   - Prompt contains NO PII
 *   - Returns cached explanation on second call (idempotent)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Auth mock ──────────────────────────────────────────────────────────────────

const mockUser = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false };

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue(mockUser),
}));

// ── Prisma mock ────────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    opsFinding: {
      findUnique: vi.fn(),
    },
    opsExplanation: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// ── OpenAI mock ────────────────────────────────────────────────────────────────

const mockResponsesCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
  })),
}));

// ── findings-engine mock (buildSafePromptContext) ─────────────────────────────

vi.mock("@/lib/ops/findings-engine", () => ({
  buildSafePromptContext: vi.fn().mockReturnValue({
    signalKey:   "sms.high_failure_rate",
    severity:    "warn",
    category:    "sms",
    windowHours: 168,
    baseline:    0.1,
    current:     0.4,
    deltaPct:    300,
    recommendedActions: ["Check provider"],
    recommendedFlags:   [],
  }),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/admin/ops/findings/[findingId]/explain/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(findingId = "finding-1"): [NextRequest, { params: { findingId: string } }] {
  const req = new NextRequest(`http://localhost/api/admin/ops/findings/${findingId}/explain`, {
    method: "POST",
  });
  return [req, { params: { findingId } }];
}

const GOOD_FINDING = {
  id:                "finding-1",
  schoolId:          "school-1",
  severity:          "warn",
  category:          "sms",
  signalKey:         "sms.high_failure_rate",
  windowHours:       168,
  baseline:          0.1,
  current:           0.4,
  deltaPct:          300,
  recommendedActions: ["Check provider"],
  recommendedFlags:   [],
  explanation:       null,
};

const VALID_AI_OUTPUT = JSON.stringify({
  summary:     "SMS failure rate spiked due to provider outage.",
  hypotheses:  ["AfricasTalking service disruption", "Network congestion"],
  checklist:   ["Step 1: Check provider dashboard", "Step 2: Review failed logs"],
  monitor_next: ["Watch sms.failed events over next 24 hours"],
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/ops/findings/[findingId]/explain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: flag ON, threshold = warn
    process.env.OPS_AI_EXPLANATIONS_ENABLED = "true";
    process.env.OPS_AI_MIN_SEVERITY         = "warn";

    prismaMock.opsFinding.findUnique.mockResolvedValue(GOOD_FINDING);
    mockResponsesCreate.mockResolvedValue({ output_text: VALID_AI_OUTPUT });
    prismaMock.opsExplanation.create.mockResolvedValue({
      id: "exp-1",
      findingId: "finding-1",
      summary:   "SMS failure rate spiked.",
    });
  });

  // ── Feature flag ─────────────────────────────────────────────────────────

  it("returns 403 feature_disabled when OPS_AI_EXPLANATIONS_ENABLED is false", async () => {
    process.env.OPS_AI_EXPLANATIONS_ENABLED = "false";
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("feature_disabled");
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("returns 403 feature_disabled when OPS_AI_EXPLANATIONS_ENABLED is unset", async () => {
    delete process.env.OPS_AI_EXPLANATIONS_ENABLED;
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("feature_disabled");
  });

  // ── Severity threshold ───────────────────────────────────────────────────

  it("returns 403 below_threshold when finding severity is info and min is warn", async () => {
    process.env.OPS_AI_MIN_SEVERITY = "warn";
    prismaMock.opsFinding.findUnique.mockResolvedValue({ ...GOOD_FINDING, severity: "info" });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("below_threshold");
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("returns 403 below_threshold when finding is warn and min is critical", async () => {
    process.env.OPS_AI_MIN_SEVERITY = "critical";
    prismaMock.opsFinding.findUnique.mockResolvedValue({ ...GOOD_FINDING, severity: "warn" });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("below_threshold");
  });

  it("allows info finding when OPS_AI_MIN_SEVERITY=info", async () => {
    process.env.OPS_AI_MIN_SEVERITY = "info";
    prismaMock.opsFinding.findUnique.mockResolvedValue({ ...GOOD_FINDING, severity: "info" });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    // Should proceed (201 or 502 from mock, not 403)
    expect(res.status).not.toBe(403);
  });

  // ── Not found ────────────────────────────────────────────────────────────

  it("returns 404 when finding does not exist", async () => {
    prismaMock.opsFinding.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeRequest("nonexistent");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  // ── Tenant isolation ─────────────────────────────────────────────────────

  it("returns 403 when finding belongs to a different school", async () => {
    prismaMock.opsFinding.findUnique.mockResolvedValue({
      ...GOOD_FINDING,
      schoolId: "school-OTHER",
    });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  // ── JSON validation failures ─────────────────────────────────────────────

  it("returns 502 when OpenAI returns non-JSON text", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "Sorry, I cannot help with that." });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("invalid_ai_response");
    expect(prismaMock.opsExplanation.create).not.toHaveBeenCalled();
  });

  it("returns 502 when OpenAI returns JSON missing required fields", async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({ summary: "OK", hypotheses: ["one"] }),
      // Missing: checklist, monitor_next
    });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("invalid_ai_response");
  });

  it("returns 502 when OpenAI call itself throws", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("API timeout"));
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ai_call_failed");
  });

  // ── Success path ─────────────────────────────────────────────────────────

  it("returns 201 with explanation on valid AI output", async () => {
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.explanation).toBeDefined();
    expect(body.cached).toBe(false);
  });

  it("stores explanation in OpsExplanation linked to finding", async () => {
    const [req, ctx] = makeRequest();
    await POST(req, ctx);
    expect(prismaMock.opsExplanation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          findingId: "finding-1",
          summary:   expect.any(String),
          modelUsed: expect.any(String),
          promptHash: expect.any(String),
        }),
      })
    );
  });

  it("stores a promptHash (not the prompt itself) for audit", async () => {
    const [req, ctx] = makeRequest();
    await POST(req, ctx);
    const createCall = prismaMock.opsExplanation.create.mock.calls[0][0];
    const hash = createCall.data.promptHash;
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
    // Prompt text itself must NOT be stored (only the hash)
    expect(JSON.stringify(createCall.data)).not.toContain("You are an educational platform");
  });

  // ── Idempotency ──────────────────────────────────────────────────────────

  it("returns cached explanation without calling OpenAI again", async () => {
    prismaMock.opsFinding.findUnique.mockResolvedValue({
      ...GOOD_FINDING,
      explanation: {
        id:        "exp-existing",
        findingId: "finding-1",
        summary:   "Previously generated.",
      },
    });
    const [req, ctx] = makeRequest();
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  // ── PII guard ────────────────────────────────────────────────────────────

  it("prompt passed to OpenAI contains no PII keys", async () => {
    let capturedPrompt = "";
    mockResponsesCreate.mockImplementation(async (args: any) => {
      capturedPrompt = typeof args.input === "string" ? args.input : JSON.stringify(args.input);
      return { output_text: VALID_AI_OUTPUT };
    });

    const [req, ctx] = makeRequest();
    await POST(req, ctx);

    const piiPatterns = ["phone", "email", "studentId", "guardianId", "teacherId", "guardianPhone"];
    for (const pattern of piiPatterns) {
      expect(capturedPrompt.toLowerCase()).not.toContain(pattern.toLowerCase());
    }
  });
});
