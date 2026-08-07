/**
 * lib/grading/gradeAILiteracy.ts  — NR-14D Phase 4
 *
 * Rubric-based LLM grading for AI literacy exercises.
 * Reuses the routedCompletion infrastructure from gradeEssay.ts.
 *
 * Key difference from essay grading:
 *   - ethics_scenario rewards multi-perspective reasoning, NOT one "correct" answer
 *   - bias_detection checks against specific content, not just writing quality
 *   - output_critique is graded on reasoning quality, not correctness of the claim identified
 *
 * Grade is always ADVISORY — shown to student + teacher, never a hard gate.
 */

import { routedCompletion } from "@/lib/ai/router";
import { moderateText } from "@/lib/agents/moderation";
import { enqueueEscalation } from "@/lib/agents/escalation";
import type { AILiteracyExerciseType, AILiteracyRubricCriterion } from "../exercises/generateAILiteracy";

export type AILiteracyCriterionResult = {
  score: number;   // 0..1
  comment: string;
};

export type AILiteracyGradeResult = {
  score: number;                                        // weighted total 0..1
  breakdown: Record<string, AILiteracyCriterionResult>;
  feedback: string;                                     // 2-3 sentences for student
  tooShort: false;
};

export type AILiteracyTooShortResult = {
  tooShort: true;
  wordCount: number;
  minWords: number;
};

export type AILiteracyGradeOutput = AILiteracyGradeResult | AILiteracyTooShortResult;

export function isAILiteracyGradeResult(r: AILiteracyGradeOutput): r is AILiteracyGradeResult {
  return r.tooShort === false;
}

const MIN_WORDS = 30;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function safeParseJSON(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const TYPE_GUIDANCE: Record<AILiteracyExerciseType, string> = {
  prompt_engineering:
    "Grade based on the QUALITY of the prompt the student wrote — does it clearly specify the task, provide enough context, and set appropriate constraints? A prompt that would produce a useful AI output should score high.",
  bias_detection:
    "Grade based on whether the student CORRECTLY IDENTIFIED the specific bias, explained who is disadvantaged, and proposed a genuinely more inclusive alternative. Accept valid alternative phrasings of the same insight.",
  ethics_scenario:
    "IMPORTANT: There is no single correct answer. Reward multi-perspective reasoning, a clearly stated position WITH justification, and a realistic proposed safeguard. Do NOT penalize a student for taking a different position than you would — reward the QUALITY of their reasoning.",
  output_critique:
    "Grade based on whether the student correctly identified what seems trustworthy (with justification) vs. what to verify (with a specific reason), and proposed a concrete verification strategy.",
};

/**
 * Grade an AI literacy exercise submission.
 */
function neutralBlockedResult(rubric: { criteria: AILiteracyRubricCriterion[] }): AILiteracyGradeResult {
  const breakdown: Record<string, AILiteracyCriterionResult> = {};
  for (const c of rubric.criteria) {
    breakdown[c.key] = { score: 0.5, comment: "Your teacher will review this response." };
  }
  return {
    score: 0.5,
    breakdown,
    feedback: "Your response has been received. Your teacher will review and provide feedback soon.",
    tooShort: false,
  };
}

export async function gradeAILiteracy(input: {
  studentResponse: string;
  exerciseType: AILiteracyExerciseType;
  scenario: string;
  studentPromptInstruction: string | null;
  rubric: { criteria: AILiteracyRubricCriterion[] };
  grade: number;
}): Promise<AILiteracyGradeOutput> {
  const wordCount = countWords(input.studentResponse);
  if (wordCount < MIN_WORDS) {
    return { tooShort: true, wordCount, minWords: MIN_WORDS };
  }

  const inputVerdict = await moderateText(input.studentResponse.slice(0, 4000), "input", { audience: "minor" });
  if (inputVerdict.verdict !== "SAFE") {
    await enqueueEscalation({
      agentName: "lib.grading.gradeAILiteracy",
      reason: `AI literacy exercise response flagged unsafe on input moderation (exerciseType: ${input.exerciseType}, grade: ${input.grade}).`,
      priority: "HIGH",
    });
    return neutralBlockedResult(input.rubric);
  }

  const typeGuidance = TYPE_GUIDANCE[input.exerciseType];

  const systemPrompt = `You are a fair, encouraging Grade ${input.grade} teacher in Liberia grading an AI literacy exercise.

Exercise type: ${input.exerciseType}
Grading guidance: ${typeGuidance}

Scenario shown to student:
${input.scenario.slice(0, 2000)}

${input.studentPromptInstruction ? `Student instruction: ${input.studentPromptInstruction}` : ""}

Rubric criteria (score each 0.0–1.0):
${input.rubric.criteria.map((c) => `  - ${c.key}: ${c.label} — ${c.description} (weight ${c.weight})`).join("\n")}

Be constructive and encouraging. Identify strengths first.
Never be harsh. Use patient Liberian classroom tone.

Return ONLY valid JSON — no preamble, no code fences:
{
  "criteria": {
    ${input.rubric.criteria.map((c) => `"${c.key}": { "score": 0.0, "comment": "..." }`).join(",\n    ")}
  },
  "feedback": "2-3 encouraging sentences with one concrete improvement suggestion"
}`;

  const result = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Student response:\n${input.studentResponse.slice(0, 4000)}` },
    ],
    maxTokens: 600,
    aiUsage: {
      route: "lib/grading/gradeAILiteracy",
      feature: "grading",
      requestType: `ai_literacy_grade_${input.exerciseType}`,
    },
  });

  const parsed = safeParseJSON(result.content);
  const rawCriteria = (parsed.criteria ?? {}) as Record<
    string,
    { score?: unknown; comment?: unknown }
  >;
  const feedback =
    typeof parsed.feedback === "string"
      ? parsed.feedback
      : "Thank you for your thoughtful response. Keep thinking critically about AI!";

  const breakdown: Record<string, AILiteracyCriterionResult> = {};
  let totalScore = 0;

  for (const criterion of input.rubric.criteria) {
    const raw = rawCriteria[criterion.key] ?? {};
    const score = typeof raw.score === "number" ? Math.max(0, Math.min(1, raw.score)) : 0.5;
    const comment =
      typeof raw.comment === "string" ? raw.comment : "Keep developing this skill.";
    breakdown[criterion.key] = { score, comment };
    totalScore += score * criterion.weight;
  }

  const feedbackText = [feedback, ...Object.values(breakdown).map((b) => b.comment)].join("\n");
  const outputVerdict = await moderateText(feedbackText, "output", { audience: "minor" });
  if (outputVerdict.verdict !== "SAFE") {
    await enqueueEscalation({
      agentName: "lib.grading.gradeAILiteracy",
      reason: `AI literacy grading output flagged unsafe for a K-12 audience (exerciseType: ${input.exerciseType}, grade: ${input.grade}).`,
      priority: "HIGH",
    });
    return neutralBlockedResult(input.rubric);
  }

  return { score: totalScore, breakdown, feedback, tooShort: false };
}
