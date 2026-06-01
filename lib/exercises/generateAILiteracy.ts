/**
 * lib/exercises/generateAILiteracy.ts  — NR-14D Phase 4
 *
 * Generates AI literacy exercises for CS lessons that involve AI topics.
 * Four types:
 *   - prompt_engineering  student writes a prompt to accomplish a task
 *   - bias_detection      student identifies bias in AI-generated content
 *   - ethics_scenario     student reasons about an AI ethics dilemma
 *   - output_critique     student evaluates an AI-generated answer for accuracy
 *
 * Each exercise comes with an LLM-gradeable rubric.
 * Pure LLM generation — no Judge0 needed (no code runs).
 */

import { routedCompletion } from "@/lib/ai/router";

export type AILiteracyExerciseType =
  | "prompt_engineering"
  | "bias_detection"
  | "ethics_scenario"
  | "output_critique";

export type AILiteracyRubricCriterion = {
  key: string;
  label: string;
  description: string;
  weight: number;
};

export type GeneratedAILiteracyExercise = {
  title: string;
  type: AILiteracyExerciseType;
  scenario: string;
  studentPromptInstruction: string | null;
  rubric: { criteria: AILiteracyRubricCriterion[] };
};

export type GenerateAILiteracyResult =
  | { success: true; exercise: GeneratedAILiteracyExercise }
  | { success: false; reason: string };

function safeParseJSON(raw: string): GeneratedAILiteracyExercise | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as Partial<GeneratedAILiteracyExercise>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.scenario !== "string" ||
      !parsed.rubric?.criteria?.length
    )
      return null;
    return parsed as GeneratedAILiteracyExercise;
  } catch {
    return null;
  }
}

const TYPE_PROMPTS: Record<AILiteracyExerciseType, (grade: number, topic: string) => string> = {
  prompt_engineering: (grade, topic) =>
    `Create a "prompt engineering" AI literacy exercise for Grade ${grade} Liberian students studying "${topic}".

The student is given a task and must write a good prompt to give to an AI assistant to accomplish it.
Use a realistic Liberian context (markets, schools, mobile money, farms, local businesses).

Return ONLY valid JSON:
{
  "title": "Short exercise title",
  "type": "prompt_engineering",
  "scenario": "Background context + the task the student needs to accomplish using AI. Include examples of POOR prompts to contrast with what a good prompt would do. 3-4 paragraphs.",
  "studentPromptInstruction": "Clear instruction to the student: what prompt should they write, and what goal should it achieve?",
  "rubric": {
    "criteria": [
      { "key": "clarity", "label": "Clarity", "description": "The prompt clearly states what is needed", "weight": 0.3 },
      { "key": "specificity", "label": "Specificity", "description": "The prompt gives enough context and constraints", "weight": 0.3 },
      { "key": "context", "label": "Context", "description": "The prompt includes relevant Liberian context", "weight": 0.2 },
      { "key": "constraints", "label": "Constraints", "description": "The prompt sets appropriate limits (length, format, tone)", "weight": 0.2 }
    ]
  }
}`,

  bias_detection: (grade, topic) =>
    `Create a "bias detection" AI literacy exercise for Grade ${grade} Liberian students studying "${topic}".

Show the student an AI-generated text that contains a SUBTLE bias (assumes electricity access, uses only Western names, ignores rural Liberian context, assumes all users are male, or stereotypes a profession). The bias should be real but not obvious.

Return ONLY valid JSON:
{
  "title": "Short exercise title",
  "type": "bias_detection",
  "scenario": "Show an AI-generated piece of text with a subtle bias embedded. Then ask: 'Read this AI-generated text. Can you spot something that might not apply fairly to all Liberians?'",
  "studentPromptInstruction": "Ask the student to: (1) identify the specific bias, (2) explain who is left out or disadvantaged, (3) suggest a more inclusive rewrite.",
  "rubric": {
    "criteria": [
      { "key": "identification", "label": "Bias Identified", "description": "Student correctly identifies the specific bias", "weight": 0.4 },
      { "key": "explanation", "label": "Explanation", "description": "Student explains WHO is excluded or disadvantaged and WHY", "weight": 0.35 },
      { "key": "alternative", "label": "Alternative", "description": "Student proposes a more inclusive version", "weight": 0.25 }
    ]
  }
}`,

  ethics_scenario: (grade, topic) =>
    `Create an "ethics scenario" AI literacy exercise for Grade ${grade} Liberian students studying "${topic}".

Present a real-world scenario where AI is being used in Liberia in a way that raises ethical questions (fairness, privacy, accountability, impact on jobs, data ownership). The scenario should NOT have one obvious correct answer — it should require weighing multiple perspectives.

Return ONLY valid JSON:
{
  "title": "Short exercise title",
  "type": "ethics_scenario",
  "scenario": "A 3-4 paragraph scenario describing how AI is being used in a Liberian context and the ethical questions it raises. Make it concrete and local (e.g. AI in schools, hospitals, banks, agriculture, courts).",
  "studentPromptInstruction": "Ask the student to: (1) state whether they think this AI use is fair or unfair, (2) identify at least TWO different perspectives (someone who benefits, someone who might be harmed), (3) suggest one rule or safeguard that would make the AI use more fair.",
  "rubric": {
    "criteria": [
      { "key": "position", "label": "Clear Position", "description": "Student takes a clear position with reasoning", "weight": 0.25 },
      { "key": "perspectives", "label": "Multiple Perspectives", "description": "Student identifies at least two different affected groups", "weight": 0.35 },
      { "key": "safeguard", "label": "Practical Safeguard", "description": "Student proposes a realistic, specific rule or protection", "weight": 0.25 },
      { "key": "reasoning", "label": "Quality of Reasoning", "description": "Argument is logical and based on evidence", "weight": 0.15 }
    ]
  }
}`,

  output_critique: (grade, topic) =>
    `Create an "output critique" AI literacy exercise for Grade ${grade} Liberian students studying "${topic}".

Show the student an AI-generated answer that contains a MIX of correct information and subtle errors, outdated facts, or overconfident claims. The student must evaluate what to trust and what to verify.

Return ONLY valid JSON:
{
  "title": "Short exercise title",
  "type": "output_critique",
  "scenario": "An AI was asked a question related to ${topic} in Liberia. Here is its answer: [include 3-4 sentences of AI output that contains 1-2 specific factual errors or overconfident claims mixed with correct information]. Ask the student: 'Evaluate this AI answer. What parts seem correct? What should you double-check? What is missing?'",
  "studentPromptInstruction": "Ask the student to: (1) identify at least one claim that seems correct and explain why, (2) identify at least one claim to verify and explain what is suspicious about it, (3) describe how they would fact-check it.",
  "rubric": {
    "criteria": [
      { "key": "correct_trust", "label": "Identifying Trustworthy Claims", "description": "Student identifies what is likely correct with justification", "weight": 0.3 },
      { "key": "suspicious", "label": "Flagging Suspicious Claims", "description": "Student identifies at least one specific problematic claim", "weight": 0.35 },
      { "key": "verification", "label": "Verification Strategy", "description": "Student proposes a concrete way to fact-check", "weight": 0.35 }
    ]
  }
}`,
};

/**
 * Generate an AI literacy exercise for a CS lesson.
 *
 * @param input.type     Which of the four exercise types to generate
 * @param input.grade    Grade number (affects language complexity)
 */
export async function generateAILiteracy(input: {
  lessonId: string;
  lessonTitle: string;
  lessonBody: string;
  grade: number;
  type: AILiteracyExerciseType;
}): Promise<GenerateAILiteracyResult> {
  const promptFn = TYPE_PROMPTS[input.type];
  const prompt = promptFn(input.grade, input.lessonTitle);

  const result = await routedCompletion({
    messages: [
      {
        role: "system",
        content: `You are an AI literacy curriculum designer for Liberian K-12 students.
Your exercises teach students to THINK CRITICALLY about AI — not just use it.
Always use Liberian context (Monrovia, counties, local names, local businesses).
All JSON must be valid and complete.`,
      },
      { role: "user", content: prompt },
    ],
    maxTokens: 1500,
    forceSmartTier: true,
    aiUsage: {
      route: "lib/exercises/generateAILiteracy",
      feature: "curriculum",
      requestType: `ai_literacy_${input.type}`,
    },
  });

  const exercise = safeParseJSON(result.content);
  if (!exercise) {
    return { success: false, reason: "invalid_json" };
  }

  if (exercise.type !== input.type) {
    return { success: false, reason: `type_mismatch: got ${exercise.type}, expected ${input.type}` };
  }

  return { success: true, exercise };
}
