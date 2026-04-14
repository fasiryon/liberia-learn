import { routedCompletion } from "@/lib/ai/router";
import { getPrompt } from "@/lib/ai/promptRegistry";
import type { DifficultyTier } from "@/lib/adaptive/difficultyAdapter";
import type { MasteryGap } from "@/lib/adaptive/gapDetector";

export type PracticeQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hintText: string;
};

export type PracticeSet = {
  strand: string;
  difficultyTier: string;
  questions: PracticeQuestion[];
  generatedAt: Date;
};

export type PracticeGenerationResult = {
  practice: PracticeSet;
  estimatedCostUSD: number;
  tokensUsed: number;
  hadFallback?: boolean;
};

type PracticeUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
};

function parsePracticeSet(content: string, gap: MasteryGap, difficultyTier: DifficultyTier): PracticeSet {
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("[adaptive.practiceGenerator] Failed to parse AI response", error);
    throw new Error("Adaptive practice response was malformed");
  }

  const questions = parsed?.questions;
  if (!Array.isArray(questions) || questions.length !== 5) {
    throw new Error("Adaptive practice response must contain exactly 5 questions");
  }

  const normalizedQuestions = questions.map((question: any, index: number) => {
    if (
      typeof question?.id !== "string" ||
      typeof question?.prompt !== "string" ||
      !Array.isArray(question?.options) ||
      question.options.length !== 4 ||
      question.options.some((option: unknown) => typeof option !== "string") ||
      !Number.isInteger(question?.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex > 3 ||
      typeof question?.explanation !== "string" ||
      typeof question?.hintText !== "string"
    ) {
      throw new Error(`Adaptive practice question ${index + 1} was malformed`);
    }

    return {
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      hintText: question.hintText,
    } satisfies PracticeQuestion;
  });

  return {
    strand: gap.strand,
    difficultyTier,
    questions: normalizedQuestions,
    generatedAt: new Date(),
  };
}

export async function generateTargetedPracticeWithUsage(
  gap: MasteryGap,
  difficultyTier: DifficultyTier,
  usageContext?: PracticeUsageContext
): Promise<PracticeGenerationResult> {
  const prompt = getPrompt("adaptive.practice");
  const result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content: `${prompt.template}\nNo markdown. No prose outside JSON.`,
      },
      {
        role: "user",
        content: [
          "Generate exactly 5 multiple-choice questions as JSON with this shape:",
          '{ "questions": [{ "id": "string", "prompt": "string", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "string", "hintText": "string" }] }',
          `Target strand code: ${gap.strand}`,
          `Subject: ${gap.subject}`,
          `Grade level: ${gap.grade}`,
          `Difficulty tier: ${difficultyTier}`,
          "Requirements:",
          "- Exactly 5 questions",
          "- Exactly 4 options per question",
          "- One correct answer only",
          "- Explanations and hints must be clear and age-appropriate",
          "- Use Liberian context throughout",
          "- Match the strand and grade precisely",
        ].join("\n"),
      },
    ],
    aiUsage: usageContext
      ? {
          route: usageContext.route,
          feature: "curriculum",
          schoolId: usageContext.schoolId ?? null,
          userId: usageContext.userId ?? null,
          subject: gap.subject,
          strandKey: gap.strand,
          requestType: "adaptive_practice",
          promptKey: prompt.key,
          promptVersion: prompt.version,
          promptHash: prompt.hash,
          budgetFallbackContent: JSON.stringify({
            questions: Array.from({ length: 5 }, (_, index) => ({
              id: `fallback-${index + 1}`,
              prompt: `Review question ${index + 1} for ${gap.strand}.`,
              options: ["Option A", "Option B", "Option C", "Option D"],
              correctIndex: 0,
              explanation: "Review the lesson notes with your teacher.",
              hintText: "Use your class notes and try one step at a time.",
            })),
          }),
        }
      : undefined,
  });

  return {
    practice: parsePracticeSet(result.content, gap, difficultyTier),
    estimatedCostUSD: result.estimatedCostUSD,
    tokensUsed: result.inputTokens + result.outputTokens,
    hadFallback: result.budgetBlocked === true,
  };
}

export async function generateTargetedPractice(
  gap: MasteryGap,
  difficultyTier: DifficultyTier
): Promise<PracticeSet> {
  const result = await generateTargetedPracticeWithUsage(gap, difficultyTier);
  return result.practice;
}
