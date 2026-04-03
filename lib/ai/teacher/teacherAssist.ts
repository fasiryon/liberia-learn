/**
 * lib/ai/teacher/teacherAssist.ts — Block 10: Teacher Support Assistant
 *
 * Generates reinforcement suggestions based on class-level aggregate mastery.
 * NO individual student data in any prompt or output.
 * Language is always supportive — guardrail rejects punitive output.
 *
 * Uses the established lib/ai/router.ts routedCompletion layer (smart tier).
 * Output is advisory-only and NEVER evaluates teacher performance.
 */

import { routedCompletion } from "@/lib/ai/router";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeacherAssistInput = {
  subject: string;
  strandKey: string;
  /** Class-wide aggregate mastery state — not individual */
  classAverageMasteryState: string;
  /** Strands where the class needs additional support (max 10) */
  weakStrandKeys: string[];
  gradeBand: string;
};

type TeacherAssistUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
};

export type TeacherAssistResult = {
  reinforcementSuggestions: string[];
  pacingSuggestion: string;
  resourceHints: string[];
  hadFallback: boolean;
  estimatedCostUSD: number;
  tokensUsed: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Words that indicate punitive or evaluative framing — trigger fallback. */
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
];

const FALLBACK: TeacherAssistResult = {
  reinforcementSuggestions: [
    "Review the strand concepts using whole-class discussion to surface common misconceptions.",
    "Try pair activities where students who grasped the concept support their peers.",
    "Use a quick exit-ticket question at lesson end to gauge understanding before moving on.",
  ],
  pacingSuggestion:
    "Consider spending one additional lesson on the foundational concepts before progressing to the next strand.",
  resourceHints: [
    "Refer to the curriculum guide for this strand for suggested activities.",
  ],
  hadFallback: true,
  estimatedCostUSD: 0,
  tokensUsed: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return getSystemPrompt("teacher.assist.system");
}

function buildUserPrompt(input: TeacherAssistInput): string {
  const weakList =
    input.weakStrandKeys.length > 0
      ? input.weakStrandKeys.slice(0, 10).join(", ")
      : "none identified yet";

  return `Subject: ${input.subject}
Primary strand: ${input.strandKey}
Class average mastery level: ${input.classAverageMasteryState}
Strands needing additional support: ${weakList}
Grade band: ${input.gradeBand}

Suggest practical reinforcement activities and pacing guidance.
Respond in JSON only.`;
}

function hasPunitiveLanguage(result: TeacherAssistResult): boolean {
  const allText = [
    ...result.reinforcementSuggestions,
    result.pacingSuggestion,
    ...result.resourceHints,
  ]
    .join(" ")
    .toLowerCase();
  return PUNITIVE_KEYWORDS.some((kw) => allText.includes(kw));
}

function parseAndValidate(raw: string): TeacherAssistResult | null {
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

  if (!Array.isArray(r.reinforcementSuggestions) || r.reinforcementSuggestions.length === 0)
    // ACCEPTABLE NULL - return type includes null.
    return null;
  if (typeof r.pacingSuggestion !== "string" || !r.pacingSuggestion.trim())
    // ACCEPTABLE NULL - return type includes null.
    return null;

  const suggestions = (r.reinforcementSuggestions as unknown[])
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  const hints = Array.isArray(r.resourceHints)
    ? (r.resourceHints as unknown[])
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (suggestions.length === 0) return null;

  return {
    reinforcementSuggestions: suggestions,
    pacingSuggestion: r.pacingSuggestion.trim(),
    resourceHints: hints,
    hadFallback: false,
    estimatedCostUSD: 0,
    tokensUsed: 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls the AI router and returns validated TeacherAssistResult.
 * Always returns a result — falls back safely on any error or punitive language.
 * NO individual student data in input, prompt, or output.
 */
export async function getTeacherAssistResponse(
  input: TeacherAssistInput,
  usageContext?: TeacherAssistUsageContext
): Promise<TeacherAssistResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 500,
      forceSmartTier: true,
      aiUsage: usageContext
        ? {
            route: usageContext.route,
            feature: "teacherAssist",
            schoolId: usageContext.schoolId ?? null,
            userId: usageContext.userId ?? null,
            subject: input.subject,
            strandKey: input.strandKey,
            requestType: "teacher_assist",
            budgetFallbackContent: JSON.stringify({
              reinforcementSuggestions: FALLBACK.reinforcementSuggestions,
              pacingSuggestion: FALLBACK.pacingSuggestion,
              resourceHints: FALLBACK.resourceHints,
            }),
          }
        : undefined,
    });

    const validated = parseAndValidate(result.content);
    if (!validated) {
      console.error(
        "[AI_TEACHER] Response validation failed:",
        result.content.slice(0, 200)
      );
      return { ...FALLBACK };
    }

    if (hasPunitiveLanguage(validated)) {
      console.error(
        "[AI_TEACHER] Punitive language detected in AI response — substituting fallback"
      );
      return { ...FALLBACK };
    }

    validated.hadFallback = result.budgetBlocked === true;
    validated.estimatedCostUSD = result.estimatedCostUSD;
    validated.tokensUsed = result.inputTokens + result.outputTokens;
    return validated;
  } catch (err: any) {
    console.error("[AI_TEACHER] Call failed:", err?.message);
    return { ...FALLBACK };
  }
}
