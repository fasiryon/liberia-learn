/**
 * lib/workflows/ai/gradingAssist.ts — Block 12B: AI-Assisted Grading Workflow
 *
 * Provides rubric-aligned feedback and suggested score bands for an
 * anonymized student submission. Teacher-facing only.
 *
 * Design:
 *   - Input must be fully anonymized: no studentId, name, or identifiers.
 *   - Punitive language guardrail: reuses the same keyword list as teacherAssist.ts.
 *   - "Teacher final authority" marker is always true in the response — AI is advisory only.
 *   - JSON-structured response; always falls back safely on any error.
 *   - Feature-flagged: ENABLE_AI_GRADING_ASSIST (default OFF).
 *
 * See docs/product/WORKFLOW_AI.md for teacher-authority governance rules.
 */

import { routedCompletion } from "@/lib/ai/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GradingAssistInput = {
  subject: string;
  strandKey: string;
  /** Rubric criteria as a plain string. No student identifiers. */
  rubric: string;
  /**
   * Anonymized submission content (no name, student ID, or school reference).
   * Caller is responsible for stripping all PII before passing this field.
   */
  submissionContent: string;
  /** Optional: the expected or model answer to compare against. */
  expectedAnswer?: string;
};

export type ScoreBand = {
  label: string;      // e.g. "Meets Standard", "Approaching Standard", "Below Standard"
  scoreRange: string; // e.g. "80–100%"
};

export type GradingAssistResult = {
  /** Rubric-aligned feedback on the submission. */
  feedback: string[];
  /** Suggested score bands based on rubric alignment. */
  suggestedScoreBands: ScoreBand[];
  /** Strengths identified in the submission. */
  strengths: string[];
  /** Areas needing development. */
  areasForDevelopment: string[];
  /**
   * Always true — AI grading assist is advisory only.
   * The teacher must make the final grading decision.
   */
  teacherFinalAuthority: true;
  /** Whether this result came from the fallback path. */
  hadFallback: boolean;
  estimatedCostUSD: number;
};

// ─── Punitive language guardrail (mirrors teacherAssist.ts) ──────────────────

const PUNITIVE_KEYWORDS = [
  "fail",
  "failure",
  "incompetent",
  "poor performance",
  "underperforming",
  "bad teacher",
  "inadequate",
  "deficit",
  "blame",
  "punish",
  "weak teacher",
  "lazy",
  "careless",
  "stupid",
];

function hasPunitiveLanguage(result: GradingAssistResult): boolean {
  const allText = [
    ...result.feedback,
    ...result.strengths,
    ...result.areasForDevelopment,
    ...result.suggestedScoreBands.map((b) => b.label),
  ]
    .join(" ")
    .toLowerCase();
  return PUNITIVE_KEYWORDS.some((kw) => allText.includes(kw));
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK: GradingAssistResult = {
  feedback: [
    "Review the submission against the rubric criteria and provide specific written feedback.",
    "Note which criteria have been met and which require further development.",
  ],
  suggestedScoreBands: [
    { label: "Meets Standard", scoreRange: "75–100%" },
    { label: "Approaching Standard", scoreRange: "50–74%" },
    { label: "Below Standard", scoreRange: "0–49%" },
  ],
  strengths: [],
  areasForDevelopment: [],
  teacherFinalAuthority: true,
  hadFallback: true,
  estimatedCostUSD: 0,
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a rubric-aligned grading assistant for LiberiaLearn teachers.
Your role is to provide constructive feedback on an anonymized student submission.

Rules:
- The submission has NO student name or identifier — do NOT infer or guess any.
- NEVER use punitive, deficit-focused, or shaming language.
- Feedback must be specific, constructive, and tied to the rubric criteria.
- Always note strengths FIRST, then areas for development.
- Suggest score bands based on rubric alignment only.
- NEVER assign a final score — suggest ranges only. The teacher decides.

You MUST respond with valid JSON only. No prose outside the JSON object.

Response schema:
{
  "feedback": ["<rubric-aligned feedback point 1>", ...],
  "suggestedScoreBands": [
    { "label": "<band name>", "scoreRange": "<range>" }
  ],
  "strengths": ["<strength 1>", ...],
  "areasForDevelopment": ["<area 1>", ...]
}`;
}

function buildUserPrompt(input: GradingAssistInput): string {
  const expectedSection = input.expectedAnswer
    ? `\nExpected/model answer: ${input.expectedAnswer.slice(0, 300)}`
    : "";

  return `Subject: ${input.subject}
Strand: ${input.strandKey}
Rubric: ${input.rubric.slice(0, 500)}${expectedSection}

Anonymized submission:
${input.submissionContent.slice(0, 600)}

Provide rubric-aligned feedback, suggested score bands, strengths, and areas for development.
Respond in JSON only.`;
}

// ─── Parse + validate ─────────────────────────────────────────────────────────

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseScoreBands(v: unknown): ScoreBand[] {
  if (!Array.isArray(v)) return [];
  const result: ScoreBand[] = [];
  for (const item of v) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as any).label === "string" &&
      typeof (item as any).scoreRange === "string"
    ) {
      result.push({
        label: String((item as any).label).trim(),
        scoreRange: String((item as any).scoreRange).trim(),
      });
    }
  }
  return result;
}

function parseAndValidate(raw: string): GradingAssistResult | null {
  let parsed: unknown;
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;

  const feedback = toStringArray(r.feedback);
  if (feedback.length === 0) return null;

  return {
    feedback,
    suggestedScoreBands: parseScoreBands(r.suggestedScoreBands),
    strengths: toStringArray(r.strengths),
    areasForDevelopment: toStringArray(r.areasForDevelopment),
    teacherFinalAuthority: true,
    hadFallback: false,
    estimatedCostUSD: 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns AI-assisted grading feedback for an anonymized submission.
 * Always returns a result — falls back safely on any error or punitive output.
 * The response ALWAYS carries teacherFinalAuthority: true.
 * No student identifiers in input, prompt, or output.
 */
export async function getGradingAssistFeedback(
  input: GradingAssistInput
): Promise<GradingAssistResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 600,
      forceSmartTier: true,
    });

    const validated = parseAndValidate(result.content);
    if (!validated) {
      console.error(
        "[GRADING_ASSIST] Response validation failed:",
        result.content.slice(0, 200)
      );
      return { ...FALLBACK };
    }

    if (hasPunitiveLanguage(validated)) {
      console.error(
        "[GRADING_ASSIST] Punitive language detected — substituting fallback"
      );
      return { ...FALLBACK };
    }

    validated.estimatedCostUSD = result.estimatedCostUSD;
    return validated;
  } catch (err: any) {
    console.error("[GRADING_ASSIST] Call failed:", err?.message);
    return { ...FALLBACK };
  }
}
