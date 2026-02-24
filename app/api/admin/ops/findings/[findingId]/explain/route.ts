/**
 * POST /api/admin/ops/findings/[findingId]/explain
 *
 * Generates an AI-powered explanation for an OpsFinding using OpenAI Responses API.
 *
 * GUARDRAILS (non-negotiable):
 *   - Server-side only — OpenAI client is never exposed to the browser.
 *   - PII-free prompts — only aggregate signal values enter the prompt.
 *   - Advisory only — response MUST NOT mutate flags, config, or messages.
 *   - Feature-flagged: OPS_AI_EXPLANATIONS_ENABLED=true required.
 *   - Severity-gated: finding must meet OPS_AI_MIN_SEVERITY threshold.
 *   - JSON validation: malformed model responses are caught and logged safely.
 *   - Idempotent: if explanation already exists, return it without re-calling OpenAI.
 *
 * AI output is stored in OpsExplanation linked to the finding for audit.
 * The promptHash (SHA-256 of the sanitized prompt) enables replay detection.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpsAiEnabled, getOpsAiMinSeverity, severityMeetsThreshold } from "@/lib/serverFlags";
import { buildSafePromptContext } from "@/lib/ops/findings-engine";

export const dynamic = "force-dynamic";

type Params = { params: { findingId: string } };

// ── Expected model output shape ───────────────────────────────────────────────

interface ExplanationOutput {
  summary: string;
  hypotheses: string[];
  checklist: string[];
  monitor_next: string[];
}

function parseAndValidateOutput(rawText: string): ExplanationOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Model returned non-JSON output");
  }

  const p = parsed as Record<string, unknown>;
  if (
    typeof p.summary !== "string" ||
    !Array.isArray(p.hypotheses) ||
    !Array.isArray(p.checklist) ||
    !Array.isArray(p.monitor_next)
  ) {
    throw new Error("Model JSON missing required fields: summary, hypotheses, checklist, monitor_next");
  }

  return {
    summary:     String(p.summary),
    hypotheses:  (p.hypotheses as unknown[]).map(String),
    checklist:   (p.checklist as unknown[]).map(String),
    monitor_next:(p.monitor_next as unknown[]).map(String),
  };
}

// ── PII-safe prompt builder ───────────────────────────────────────────────────

function buildPrompt(safeCtx: Record<string, unknown>): string {
  return `You are an educational platform operations analyst for a national learning platform serving schools in Liberia.
Analyze the following operational finding and return ONLY valid JSON. Do not include markdown fences, explanations, or any text outside the JSON object.

Finding (aggregate signals only — no PII):
${JSON.stringify(safeCtx, null, 2)}

Return EXACTLY this JSON structure:
{
  "summary": "1–2 sentence plain-language summary of what this signal means operationally",
  "hypotheses": ["most likely root cause", "second possibility", "third possibility"],
  "checklist": ["Step 1: specific actionable check", "Step 2: ...", "Step 3: ..."],
  "monitor_next": ["What metric or event to watch over the next 24–48 hours"]
}`;
}

// ── OpenAI Responses API call (server-side only) ──────────────────────────────

async function callOpenAI(prompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY not configured"), { status: 500 });

  // Dynamic import keeps the OpenAI client strictly server-side.
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const model = "gpt-4o-mini";

  // Use the OpenAI Responses API (stateless, single-turn)
  const response = await openai.responses.create({
    model,
    input: prompt,
  });

  const text = response.output_text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("OpenAI returned empty output");
  }

  return { text, model };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN");

    // ── 1. Feature flag check ─────────────────────────────────────────────────
    if (!isOpsAiEnabled()) {
      return NextResponse.json(
        { error: "feature_disabled", message: "OPS_AI_EXPLANATIONS_ENABLED is not set." },
        { status: 403 }
      );
    }

    // ── 2. Load finding ───────────────────────────────────────────────────────
    const finding = await prisma.opsFinding.findUnique({
      where: { id: params.findingId },
      include: { explanation: true },
    });

    if (!finding) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Tenant isolation
    if (!user.isPlatformAdmin && finding.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3. Severity threshold check ───────────────────────────────────────────
    const minSeverity = getOpsAiMinSeverity();
    if (!severityMeetsThreshold(finding.severity, minSeverity)) {
      return NextResponse.json(
        {
          error: "below_threshold",
          message: `Finding severity "${finding.severity}" is below OPS_AI_MIN_SEVERITY="${minSeverity}".`,
        },
        { status: 403 }
      );
    }

    // ── 4. Idempotency: return existing explanation if present ────────────────
    if (finding.explanation) {
      return NextResponse.json({ explanation: finding.explanation, cached: true });
    }

    // ── 5. Build PII-free prompt ──────────────────────────────────────────────
    const safeCtx = buildSafePromptContext(finding);
    const prompt = buildPrompt(safeCtx);
    const promptHash = createHash("sha256").update(prompt).digest("hex");

    // ── 6. Call OpenAI Responses API ──────────────────────────────────────────
    let rawText: string;
    let modelUsed: string;

    try {
      const result = await callOpenAI(prompt);
      rawText    = result.text;
      modelUsed  = result.model;
    } catch (aiErr: any) {
      // Log the failure safely — no prompt content in the error response
      console.error("[ops-explain] OpenAI call failed:", aiErr?.message);
      return NextResponse.json(
        { error: "ai_call_failed", message: "OpenAI request failed — check server logs." },
        { status: 502 }
      );
    }

    // ── 7. Parse + validate JSON output ──────────────────────────────────────
    let parsed: ExplanationOutput;
    try {
      parsed = parseAndValidateOutput(rawText);
    } catch (parseErr: any) {
      console.error("[ops-explain] JSON parse/validation failed:", parseErr?.message, "raw:", rawText.slice(0, 200));
      return NextResponse.json(
        { error: "invalid_ai_response", message: "Model returned unexpected format — see server logs." },
        { status: 502 }
      );
    }

    // ── 8. Store explanation (audit trail) ────────────────────────────────────
    const explanation = await prisma.opsExplanation.create({
      data: {
        findingId:   finding.id,
        summary:     parsed.summary,
        hypotheses:  parsed.hypotheses as unknown as any,
        checklist:   parsed.checklist  as unknown as any,
        monitorNext: parsed.monitor_next as unknown as any,
        modelUsed,
        promptHash,
        rawJson:     { text: rawText } as unknown as any,
      },
    });

    return NextResponse.json({ explanation, cached: false }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
