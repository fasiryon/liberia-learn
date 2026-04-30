/**
 * lib/workflows/ai/gradingAssist.ts — Block 12B: AI-Assisted Grading Workflow
 *
 * Provides rubric-aligned feedback and suggested score bands for an
 * anonymized student submission. Teacher-facing only.
 *
 * Design:
 *   - Input must be fully anonymized by the server route: no studentId, name, or identifiers.
 *   - Punitive language guardrail: reuses the same keyword list as teacherAssist.ts.
 *   - "Teacher final authority" marker is always true in the response — AI is advisory only.
 *   - JSON-structured response; always falls back safely on any error.
 *   - Feature-flagged: ENABLE_AI_GRADING_ASSIST (default OFF).
 *
 * See docs/product/WORKFLOW_AI.md for teacher-authority governance rules.
 */

import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt, getPromptMetadata, getSystemPrompt } from "@/lib/ai/promptRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GradingAssistInput = {
  subject: string;
  strandKey: string;
  /** Rubric criteria as a plain string. No student identifiers. */
  rubric: string;
  /**
   * Anonymized submission content (no name, student ID, or school reference).
   * Server route is responsible for stripping all PII before passing this field.
   */
  submissionContent: string;
  /** Optional: the expected or model answer to compare against. */
  expectedAnswer?: string;
};

type GradingAssistUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
};

export type ScoreBand = {
  label: string;      // e.g. "Meets Standard", "Approaching Standard", "Below Standard"
  scoreRange: string; // e.g. "80–100%"
};

export type GradingAssistResult = {
  /** Suggested editable score. Teacher must approve or change it. */
  suggestedScore: number | null;
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
  tokensUsed: number;
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
  suggestedScore: null,
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
  tokensUsed: 0,
};
const gradingPromptMetadata = getPromptMetadata("teacher.grading.system");

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return getSystemPrompt("teacher.grading.system");
}

function buildUserPrompt(input: GradingAssistInput): string {
  const expectedSection = input.expectedAnswer
    ? `Expected/model answer: ${input.expectedAnswer.slice(0, 300)}`
    : "";

  return buildPrompt("teacher.grading.user", {
    subject: input.subject,
    strandKey: input.strandKey,
    rubric: input.rubric.slice(0, 500),
    expectedSection,
    submissionContent: input.submissionContent.slice(0, 600),
  });
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
    // ACCEPTABLE NULL - return type includes null.
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;

  const feedback = toStringArray(r.feedback);
  if (feedback.length === 0) return null;

  return {
    suggestedScore:
      typeof r.suggestedScore === "number" && Number.isFinite(r.suggestedScore)
        ? Math.max(0, Math.min(100, Math.round(r.suggestedScore)))
        : null,
    feedback,
    suggestedScoreBands: parseScoreBands(r.suggestedScoreBands),
    strengths: toStringArray(r.strengths),
    areasForDevelopment: toStringArray(r.areasForDevelopment),
    teacherFinalAuthority: true,
    hadFallback: false,
    estimatedCostUSD: 0,
    tokensUsed: 0,
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
  input: GradingAssistInput,
  usageContext?: GradingAssistUsageContext
): Promise<GradingAssistResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 600,
      forceSmartTier: true,
      aiUsage: usageContext
        ? {
            route: usageContext.route,
            feature: "grading",
            schoolId: usageContext.schoolId ?? null,
            userId: usageContext.userId ?? null,
            subject: input.subject,
            strandKey: input.strandKey,
            requestType: "grading_assist",
            promptKey: gradingPromptMetadata.key,
            promptVersion: gradingPromptMetadata.version,
            promptHash: gradingPromptMetadata.hash,
            budgetFallbackContent: JSON.stringify({
              feedback: FALLBACK.feedback,
              suggestedScoreBands: FALLBACK.suggestedScoreBands,
              strengths: FALLBACK.strengths,
              areasForDevelopment: FALLBACK.areasForDevelopment,
            }),
          }
        : undefined,
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

    validated.hadFallback = result.budgetBlocked === true;
    validated.estimatedCostUSD = result.estimatedCostUSD;
    validated.tokensUsed = result.inputTokens + result.outputTokens;
    return validated;
  } catch (err: any) {
    console.error("[GRADING_ASSIST] Call failed:", err?.message);
    return { ...FALLBACK };
  }
}
