/**
 * lib/workflows/ai/assignmentTutor.ts — Block 12B: Assignment Tutor Workflow
 *
 * Generates structured AI tutor guidance scoped to an assignment's context
 * (grade, subject, strand, rubric, question prompt). Teacher-facing only.
 *
 * Design:
 *   - No student identifiers in any input, prompt, or output.
 *   - JSON-structured response; always falls back safely on AI failure.
 *   - Feature-flagged: ENABLE_ASSIGNMENT_TUTOR (default OFF).
 *   - Reuses lib/ai/router.ts (same layer as Block 10 tutor/teacher assist).
 *   - Advisory only — no mutations to assignment or student data.
 *
 * See docs/product/WORKFLOW_AI.md for governance rules.
 */

import { routedCompletion } from "@/lib/ai/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssignmentTutorInput = {
  /** Grade level number (1–12). */
  grade: number;
  subject: string;
  strandKey: string;
  /** Rubric criteria as a plain string. No student identifiers. */
  rubric: string;
  /** The assignment question or task prompt. No student identifiers. */
  questionPrompt: string;
};

export type AssignmentTutorResult = {
  /** Teaching hints scoped to this assignment's rubric and question. */
  teachingHints: string[];
  /** Common misconceptions teachers should anticipate for this strand. */
  anticipatedMisconceptions: string[];
  /** Suggested scaffolding approaches for students who struggle. */
  scaffoldingSuggestions: string[];
  /** Whether this result came from the fallback path. */
  hadFallback: boolean;
  estimatedCostUSD: number;
  tokensUsed: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK: AssignmentTutorResult = {
  teachingHints: [
    "Break the task into smaller sub-questions and guide students through each step.",
    "Use worked examples on the board before students attempt independently.",
  ],
  anticipatedMisconceptions: [
    "Students may confuse surface features of the question with the underlying concept.",
  ],
  scaffoldingSuggestions: [
    "Provide a sentence starter or partially completed model answer for students who are stuck.",
    "Allow partner discussion before individual written response.",
  ],
  hadFallback: true,
  estimatedCostUSD: 0,
  tokensUsed: 0,
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an instructional design assistant for LiberiaLearn teachers.
Your role is to provide practical teaching guidance for a specific assignment.

Rules:
- NEVER reference individual students or their data.
- Keep all guidance concrete and suitable for Liberian classrooms (low-resource context).
- Language must be supportive and constructive.
- Do NOT use punitive or deficit-focused language.

You MUST respond with valid JSON only. No prose outside the JSON object.

Response schema:
{
  "teachingHints": ["<hint 1>", "<hint 2>"],
  "anticipatedMisconceptions": ["<misconception 1>"],
  "scaffoldingSuggestions": ["<suggestion 1>", "<suggestion 2>"]
}`;
}

function buildUserPrompt(input: AssignmentTutorInput): string {
  return `Grade: ${input.grade}
Subject: ${input.subject}
Strand: ${input.strandKey}
Rubric: ${input.rubric.slice(0, 500)}
Assignment question/task: ${input.questionPrompt.slice(0, 400)}

Provide teaching hints, anticipated misconceptions, and scaffolding suggestions for this assignment.
Respond in JSON only.`;
}

// ─── Parse + validate ─────────────────────────────────────────────────────────

function parseAndValidate(raw: string): AssignmentTutorResult | null {
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

  const teachingHints = toStringArray(r.teachingHints);
  const anticipatedMisconceptions = toStringArray(r.anticipatedMisconceptions);
  const scaffoldingSuggestions = toStringArray(r.scaffoldingSuggestions);

  if (teachingHints.length === 0) return null;

  return {
    teachingHints,
    anticipatedMisconceptions,
    scaffoldingSuggestions,
    hadFallback: false,
    estimatedCostUSD: 0,
    tokensUsed: 0,
  };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns AI tutor guidance scoped to an assignment context.
 * Always returns a result — falls back safely on any error.
 * No student identifiers in input, prompt, or output.
 */
export async function getAssignmentTutorGuidance(
  input: AssignmentTutorInput
): Promise<AssignmentTutorResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 500,
      forceSmartTier: true,
    });

    const validated = parseAndValidate(result.content);
    if (!validated) {
      console.error(
        "[ASSIGNMENT_TUTOR] Response validation failed:",
        result.content.slice(0, 200)
      );
      return { ...FALLBACK };
    }

    validated.estimatedCostUSD = result.estimatedCostUSD;
    validated.tokensUsed = result.inputTokens + result.outputTokens;
    return validated;
  } catch (err: any) {
    console.error("[ASSIGNMENT_TUTOR] Call failed:", err?.message);
    return { ...FALLBACK };
  }
}
