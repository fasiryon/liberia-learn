/**
 * lib/grading/gradeEssay.ts  — NR-14C Phase 1
 *
 * Rubric-based LLM essay grading via routedCompletion.
 * NEVER calls OpenAI/Groq directly — always through the router.
 *
 * The grade is ADVISORY:
 *   - Shown to student + teacher as a "suggested grade"
 *   - Teacher can always override
 *   - Never used as a hard pass/fail gate
 *   - WAEC-aligned rubric for secondary; simplified for primary
 *
 * Quality guardrails:
 *   - Essays under MIN_WORDS_TO_GRADE (50) return a "too short" signal
 *     rather than a low score (prevents punishing short attempts)
 *   - JSON parsing is fault-tolerant — malformed LLM output gets a
 *     neutral score + standard fallback feedback
 *   - Input capped at 8000 chars to keep token cost bounded
 */

import { routedCompletion } from "@/lib/ai/router";
import { moderateText } from "@/lib/agents/moderation";
import { enqueueEscalation } from "@/lib/agents/escalation";

export const MIN_WORDS_TO_GRADE = 50;

export type EssayRubricCriterion = {
  key: string;
  label: string;
  weight: number; // must sum to 1.0
};

export type EssayRubric = {
  criteria: EssayRubricCriterion[];
};

/** WAEC-aligned default rubric for essay grading */
export const DEFAULT_RUBRIC: EssayRubric = {
  criteria: [
    { key: "content",   label: "Ideas & content",        weight: 0.35 },
    { key: "structure", label: "Organization & structure", weight: 0.25 },
    { key: "language",  label: "Grammar & vocabulary",   weight: 0.25 },
    { key: "mechanics", label: "Spelling & punctuation", weight: 0.15 },
  ],
};

export type EssayCriterionResult = {
  score: number;   // 0..1
  comment: string;
};

export type EssayGradeResult = {
  score: number;                                   // 0..1 weighted total
  breakdown: Record<string, EssayCriterionResult>; // per-criterion scores
  feedback: string;                                // 2-3 sentences for student
  tooShort: false;
};

export type EssayTooShortResult = {
  tooShort: true;
  wordCount: number;
  minWords: number;
};

export type EssayGradeOutput = EssayGradeResult | EssayTooShortResult;

/** Type guard — returns true when the result is a full grade (not a too-short signal) */
export function isEssayGradeResult(r: EssayGradeOutput): r is EssayGradeResult {
  return r.tooShort === false;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function safeParseGradeJSON(raw: string): {
  criteria?: Record<string, { score?: unknown; comment?: unknown }>;
  feedback?: unknown;
} {
  // Strip code fences if present (some models wrap JSON in ```json ... ```)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

/**
 * Grade an essay submission against a rubric.
 *
 * @param input.essayText   The student's essay (raw text)
 * @param input.grade       Grade number (1-12) — affects tone instructions
 * @param input.subject     Subject (ENGLISH, LITERACY, etc.)
 * @param input.prompt      The essay prompt / question the student responded to
 * @param input.rubric      Optional custom rubric (defaults to DEFAULT_RUBRIC)
 *
 * @returns EssayGradeResult on success, EssayTooShortResult if under 50 words
 */
const NEUTRAL_BLOCKED_FEEDBACK = "Your essay has been received. Your teacher will review and provide feedback soon.";

function neutralBlockedResult(rubric: EssayRubric): EssayGradeResult {
  const breakdown: Record<string, EssayCriterionResult> = {};
  for (const c of rubric.criteria) {
    breakdown[c.key] = { score: 0.5, comment: "Your teacher will review this section." };
  }
  return { score: 0.5, breakdown, feedback: NEUTRAL_BLOCKED_FEEDBACK, tooShort: false };
}

export async function gradeEssay(input: {
  essayText: string;
  grade: number;
  subject: string;
  prompt: string;
  rubric?: EssayRubric;
}): Promise<EssayGradeOutput> {
  const wordCount = countWords(input.essayText);
  if (wordCount < MIN_WORDS_TO_GRADE) {
    return { tooShort: true, wordCount, minWords: MIN_WORDS_TO_GRADE };
  }

  const rubric = input.rubric ?? DEFAULT_RUBRIC;

  const inputVerdict = await moderateText(input.essayText.slice(0, 8000), "input");
  if (inputVerdict.verdict === "UNSAFE") {
    await enqueueEscalation({
      agentName: "lib.grading.gradeEssay",
      reason: `Essay submission flagged unsafe on input moderation (subject: ${input.subject}, grade: ${input.grade}).`,
      priority: "HIGH",
    });
    return neutralBlockedResult(rubric);
  }
  const gradeLabel = input.grade <= 6 ? "primary" : "secondary";

  const systemPrompt = `You are a fair, encouraging Grade ${input.grade} (${gradeLabel} level) teacher in Liberia grading a student essay.

Grade ONLY against the rubric below. Be constructive — identify strengths first, then specific improvements.
Never use harsh language. Use encouraging, patient Liberian classroom tone.

Essay prompt: ${input.prompt}

Rubric criteria (score each 0.0–1.0):
${rubric.criteria.map((c) => `  - ${c.key}: ${c.label} (weight ${c.weight})`).join("\n")}

Return ONLY valid JSON — no preamble, no code fences:
{
  "criteria": {
    ${rubric.criteria.map((c) => `"${c.key}": { "score": 0.0, "comment": "..." }`).join(",\n    ")}
  },
  "feedback": "2-3 encouraging sentences with concrete next steps for the student"
}`;

  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.essayText.slice(0, 8000) },
      ],
      maxTokens: 700,
      responseFormat: "json",
      forceSmartTier: false,
      aiUsage: {
        route: "lib/grading/gradeEssay",
        feature: "grading",
        subject: input.subject,
        requestType: "essay_grade",
        metadata: { grade: input.grade, wordCount },
      },
    });

    const parsed = safeParseGradeJSON(result.content);
    const criteriaResult = parsed.criteria ?? {};

    // Build per-criterion results and compute weighted total
    const breakdown: Record<string, EssayCriterionResult> = {};
    let score = 0;

    for (const criterion of rubric.criteria) {
      const raw = criteriaResult[criterion.key];
      const criterionScore =
        typeof raw?.score === "number"
          ? Math.min(1, Math.max(0, raw.score))
          : 0.5; // neutral fallback — don't punish for parse error
      const comment =
        typeof raw?.comment === "string" && raw.comment.length > 0
          ? raw.comment
          : "Good effort on this area.";
      breakdown[criterion.key] = { score: criterionScore, comment };
      score += criterionScore * criterion.weight;
    }

    const feedback =
      typeof parsed.feedback === "string" && parsed.feedback.length > 10
        ? parsed.feedback
        : "Well done for completing your essay. Keep practising — every essay makes you a stronger writer!";

    const feedbackText = [feedback, ...Object.values(breakdown).map((b) => b.comment)].join("\n");
    const outputVerdict = await moderateText(feedbackText, "output");
    if (outputVerdict.verdict === "UNSAFE") {
      await enqueueEscalation({
        agentName: "lib.grading.gradeEssay",
        reason: `Essay grading output flagged unsafe for a K-12 audience (subject: ${input.subject}, grade: ${input.grade}).`,
        priority: "HIGH",
      });
      return neutralBlockedResult(rubric);
    }

    return { score, breakdown, feedback, tooShort: false };
  } catch {
    // AI call failed — return neutral advisory score so the submission is not lost
    const neutralBreakdown: Record<string, EssayCriterionResult> = {};
    for (const c of rubric.criteria) {
      neutralBreakdown[c.key] = {
        score: 0.5,
        comment: "Your teacher will review this section.",
      };
    }
    return {
      score: 0.5,
      breakdown: neutralBreakdown,
      feedback:
        "Your essay has been received. Your teacher will review and provide feedback soon.",
      tooShort: false,
    };
  }
}
