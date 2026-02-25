/**
 * lib/ai/tutor/studentTutor.ts — Block 10: Student AI Tutor
 *
 * Builds a strand-targeted AI explanation based on mastery context.
 * NO PII — no studentId, name, or school name in any prompt or output.
 *
 * Uses the established lib/ai/router.ts routedCompletion layer (smart tier).
 * Output is advisory-only and NEVER mutates profiles, flags, or any state.
 *
 * Guardrails:
 *   - JSON-only response format; fallback on parse or validation failure
 *   - Minor-safe: no violence, adult content, or personal data in prompt
 *   - guidanceLevel derived from masteryState when model omits it
 */

import { routedCompletion } from "@/lib/ai/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TutorRequestType =
  | "explain"
  | "practice"
  | "step_by_step"
  | "reinforce";

export type GuidanceLevel = "light" | "moderate" | "intensive";

export type StudentTutorInput = {
  subject: string;
  strandKey: string;
  /** e.g. DEVELOPING | APPROACHING | MASTERED | NOT_ASSESSED */
  masteryState: string;
  /** e.g. BELOW_PROFICIENT | APPROACHING | PROFICIENT */
  proficiencyState: string;
  /** e.g. lower_primary | upper_primary | junior_secondary */
  gradeBand: string;
  requestType: TutorRequestType;
};

export type StudentTutorResult = {
  explanation: string;
  practicePrompt?: string;
  guidanceLevel: GuidanceLevel;
  /** 0.0–1.0: model's stated confidence in the explanation */
  confidenceScore: number;
  hadFallback: boolean;
  estimatedCostUSD: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_GUIDANCE_LEVELS: GuidanceLevel[] = [
  "light",
  "moderate",
  "intensive",
];

const VALID_REQUEST_TYPES: TutorRequestType[] = [
  "explain",
  "practice",
  "step_by_step",
  "reinforce",
];

const FALLBACK: StudentTutorResult = {
  explanation:
    "The AI tutor is temporarily unavailable. Please ask your teacher for help with this topic.",
  practicePrompt: undefined,
  guidanceLevel: "light",
  confidenceScore: 0,
  hadFallback: true,
  estimatedCostUSD: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferGuidanceLevel(masteryState: string): GuidanceLevel {
  if (masteryState === "MASTERED" || masteryState === "APPROACHING")
    return "light";
  if (masteryState === "DEVELOPING") return "moderate";
  return "intensive";
}

function buildSystemPrompt(): string {
  return `You are an educational AI tutor for LiberiaLearn, a platform for students in Liberia.
Guide students to understand concepts — never give direct assessment answers.
Use simple, encouraging language. Keep responses concise (2-3 sentences max for explanation).
Relate to everyday Liberian life where helpful.

You MUST respond with valid JSON only. No prose outside the JSON object.

Response schema:
{
  "explanation": "<2-3 sentence concept explanation>",
  "practicePrompt": "<one short practice question, or null>",
  "guidanceLevel": "light" | "moderate" | "intensive",
  "confidenceScore": <0.0–1.0>
}`;
}

function buildUserPrompt(input: StudentTutorInput): string {
  const requestLabels: Record<TutorRequestType, string> = {
    explain: "Explain this concept clearly in simple terms.",
    practice:
      "Provide a short practice question with hints to guide understanding.",
    step_by_step: "Walk through this concept step by step.",
    reinforce:
      "Reinforce understanding with a different angle or a relatable analogy.",
  };

  return `Subject: ${input.subject}
Strand: ${input.strandKey}
Student mastery level: ${input.masteryState}
Student proficiency level: ${input.proficiencyState}
Grade band: ${input.gradeBand}
Task: ${requestLabels[input.requestType]}

Respond in JSON only.`;
}

function parseAndValidate(raw: string): StudentTutorResult | null {
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

  if (typeof r.explanation !== "string" || !r.explanation.trim()) return null;
  if (typeof r.confidenceScore !== "number") return null;

  const level = VALID_GUIDANCE_LEVELS.includes(r.guidanceLevel as GuidanceLevel)
    ? (r.guidanceLevel as GuidanceLevel)
    : null;
  if (!level) return null;

  return {
    explanation: r.explanation.trim(),
    practicePrompt:
      typeof r.practicePrompt === "string" && r.practicePrompt.trim()
        ? r.practicePrompt.trim()
        : undefined,
    guidanceLevel: level,
    confidenceScore: Math.max(0, Math.min(1, r.confidenceScore)),
    hadFallback: false,
    estimatedCostUSD: 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isValidRequestType(v: unknown): v is TutorRequestType {
  return VALID_REQUEST_TYPES.includes(v as TutorRequestType);
}

/**
 * Calls the AI router and returns a validated StudentTutorResult.
 * Always returns a result — falls back safely on any error.
 * NO PII in input, prompt, or output.
 */
export async function getStudentTutorResponse(
  input: StudentTutorInput
): Promise<StudentTutorResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 400,
      forceSmartTier: true,
    });

    const validated = parseAndValidate(result.content);
    if (!validated) {
      console.error(
        "[AI_TUTOR] Response validation failed:",
        result.content.slice(0, 200)
      );
      return { ...FALLBACK };
    }

    validated.estimatedCostUSD = result.estimatedCostUSD;
    return validated;
  } catch (err: any) {
    console.error("[AI_TUTOR] Call failed:", err?.message);
    return { ...FALLBACK };
  }
}
