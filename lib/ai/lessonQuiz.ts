import { randomUUID } from "crypto";

import { buildLessonPromptExcerpt } from "@/lib/ai/lessonPromptContext";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion, type AiUsageContext } from "@/lib/ai/router";

export type LessonQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type LessonQuiz = {
  quizId: string;
  questions: LessonQuizQuestion[];
};

export type LessonGapAnalysisConcept = {
  concept: string;
  explanation: string;
  rereadSuggestion: string;
};

export type LessonGapAnalysis = {
  missedConcepts: LessonGapAnalysisConcept[];
  closingMessage: string;
};

const lessonQuizSystemPrompt = getPromptMetadata("student.lessonQuiz.system");
const lessonQuizUserPrompt = getPromptMetadata("student.lessonQuiz.user");
const gapSystemPrompt = getPromptMetadata("student.lessonGapAnalysis.system");
const gapUserPrompt = getPromptMetadata("student.lessonGapAnalysis.user");

function buildUsageContext(
  usageContext: AiUsageContext | undefined,
  promptKey: string,
  promptVersion: string,
  promptHash: string,
  fallbackContent: string
): AiUsageContext | undefined {
  if (!usageContext) {
    return undefined;
  }

  return {
    ...usageContext,
    promptKey,
    promptVersion,
    promptHash,
    budgetFallbackContent: fallbackContent,
  };
}

function parseQuiz(content: string): LessonQuizQuestion[] {
  const parsed = JSON.parse(content) as { questions?: unknown };
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5) {
    throw new Error("invalid_quiz_payload");
  }

  return parsed.questions.map((question, index) => {
    const value = question as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      typeof value.question !== "string" ||
      !Array.isArray(value.options) ||
      value.options.length !== 4 ||
      value.options.some((option) => typeof option !== "string") ||
      !Number.isInteger(value.correctIndex) ||
      Number(value.correctIndex) < 0 ||
      Number(value.correctIndex) > 3 ||
      typeof value.explanation !== "string"
    ) {
      throw new Error(`invalid_quiz_question_${index + 1}`);
    }

    return {
      id: value.id,
      question: value.question.trim(),
      options: value.options.map((option) => String(option).trim()),
      correctIndex: Number(value.correctIndex),
      explanation: value.explanation.trim(),
    };
  });
}

function parseGapAnalysis(content: string): LessonGapAnalysis {
  const parsed = JSON.parse(content) as {
    missedConcepts?: unknown;
    closingMessage?: unknown;
  };

  if (!Array.isArray(parsed.missedConcepts) || typeof parsed.closingMessage !== "string") {
    throw new Error("invalid_gap_analysis_payload");
  }

  return {
    missedConcepts: parsed.missedConcepts
      .map((entry) => {
        const value = entry as Record<string, unknown>;
        if (
          typeof value.concept !== "string" ||
          typeof value.explanation !== "string" ||
          typeof value.rereadSuggestion !== "string"
        ) {
          return null;
        }

        return {
          concept: value.concept.trim(),
          explanation: value.explanation.trim(),
          rereadSuggestion: value.rereadSuggestion.trim(),
        };
      })
      .filter((entry): entry is LessonGapAnalysisConcept => Boolean(entry)),
    closingMessage: parsed.closingMessage.trim(),
  };
}

async function completeJsonPrompt<T>({
  messages,
  parser,
  usageContext,
}: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  parser: (content: string) => T;
  usageContext?: AiUsageContext;
}): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await routedCompletion({
        forceSmartTier: true,
        maxTokens: 1600,
        messages,
        aiUsage:
          usageContext && usageContext.metadata
            ? {
                ...usageContext,
                metadata: {
                  ...usageContext.metadata,
                  parseAttempt: attempt,
                },
              }
            : usageContext
              ? {
                  ...usageContext,
                  metadata: { parseAttempt: attempt },
                }
              : undefined,
      });
      return parser(response.content);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("invalid_ai_json");
    }
  }

  throw lastError ?? new Error("invalid_ai_json");
}

export async function generateLessonQuiz(
  input: {
    lessonTitle: string;
    lessonContent: string;
    subject: string;
    gradeLevel: number;
    preAuthoredQuestions?: LessonQuizQuestion[];
  },
  usageContext?: AiUsageContext
): Promise<LessonQuiz> {
  if (input.preAuthoredQuestions?.length === 5) {
    return {
      quizId: `lesson-quiz-${input.lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,
      questions: input.preAuthoredQuestions,
    };
  }

  const lessonExcerpt = buildLessonPromptExcerpt(input.lessonContent);
  const fallbackQuestions = JSON.stringify({
    questions: Array.from({ length: 5 }, (_, index) => ({
      id: `fallback-${index + 1}`,
      question: `Review question ${index + 1} for ${input.lessonTitle}.`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "Review this part of the lesson again before trying another quiz.",
    })),
  });

  const questions = await completeJsonPrompt({
    messages: [
      {
        role: "system",
        content: buildPrompt("student.lessonQuiz.system"),
      },
      {
        role: "user",
        content: buildPrompt("student.lessonQuiz.user", {
          lessonTitle: input.lessonTitle,
          subject: input.subject.replace(/_/g, " "),
          gradeLevel: input.gradeLevel,
          lessonExcerpt,
        }),
      },
    ],
    parser: parseQuiz,
    usageContext: buildUsageContext(
      usageContext,
      `${lessonQuizSystemPrompt.key}+${lessonQuizUserPrompt.key}`,
      lessonQuizSystemPrompt.version,
      lessonQuizSystemPrompt.hash,
      fallbackQuestions
    ),
  });

  if (questions.some((question) =>
    /^(review question|option [a-d])\b/i.test(question.question) ||
    question.options.some((option) => /^option [a-d]$/i.test(option))
  )) {
    throw new Error("invalid_quiz_placeholder_content");
  }

  return {
    quizId: randomUUID(),
    questions,
  };
}

function summarizeIncorrectAnswers(
  answers: Array<{
    question: string;
    selectedOption: string;
    correctOption: string;
    explanation: string;
  }>
) {
  return answers
    .map(
      (answer, index) =>
        `Question ${index + 1}: ${answer.question} | Student chose: ${answer.selectedOption} | Correct answer: ${answer.correctOption} | Explanation: ${answer.explanation}`
    )
    .join(" || ");
}

export async function generateLessonGapAnalysis(
  input: {
    lessonTitle: string;
    lessonContent: string;
    subject: string;
    gradeLevel: number;
    incorrectAnswers: Array<{
      question: string;
      selectedOption: string;
      correctOption: string;
      explanation: string;
    }>;
  },
  usageContext?: AiUsageContext
): Promise<LessonGapAnalysis> {
  const lessonExcerpt = buildLessonPromptExcerpt(input.lessonContent);
  const incorrectSummary = summarizeIncorrectAnswers(input.incorrectAnswers);
  const fallbackContent = JSON.stringify({
    missedConcepts: [],
    closingMessage:
      "You finished the quiz. Re-read the lesson sections connected to the questions you missed, then try again.",
  });

  return completeJsonPrompt({
    messages: [
      {
        role: "system",
        content: buildPrompt("student.lessonGapAnalysis.system"),
      },
      {
        role: "user",
        content: buildPrompt("student.lessonGapAnalysis.user", {
          lessonTitle: input.lessonTitle,
          subject: input.subject.replace(/_/g, " "),
          gradeLevel: input.gradeLevel,
          lessonExcerpt,
          incorrectSummary,
        }),
      },
    ],
    parser: parseGapAnalysis,
    usageContext: buildUsageContext(
      usageContext,
      `${gapSystemPrompt.key}+${gapUserPrompt.key}`,
      gapSystemPrompt.version,
      gapSystemPrompt.hash,
      fallbackContent
    ),
  });
}
