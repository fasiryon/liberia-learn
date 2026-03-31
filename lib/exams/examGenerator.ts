import { z } from "zod";
import { routedCompletion } from "@/lib/ai/router";
import { getPrompt } from "@/lib/ai/promptRegistry";

export type ExamGenerationParams = {
  subject: string;
  grade: number;
  moeStandards: string[];
  questionCount?: number;
  timeLimit?: number;
  title?: string;
};

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  moeCode: string;
  points: number;
};

export type GeneratedExam = {
  title: string;
  subject: string;
  grade: number;
  moeStandards: string[];
  timeLimit: number;
  passingScore: number;
  questions: GeneratedQuestion[];
};

export type GeneratedExamWithUsage = {
  exam: GeneratedExam;
  estimatedCostUSD: number;
  tokensUsed: number;
};

const GeneratedQuestionSchema = z.object({
  prompt: z.string().min(10),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(5),
  moeCode: z.string().min(1),
  points: z.number().int().positive().default(1),
});

const GeneratedExamSchema = z.object({
  title: z.string().min(3),
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  moeStandards: z.array(z.string().min(1)).min(1),
  timeLimit: z.number().int().positive(),
  passingScore: z.number().min(0).max(1).default(0.7),
  questions: z.array(GeneratedQuestionSchema),
});

function stripFences(text: string) {
  if (!text.startsWith("```")) return text;
  return text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
}

function buildPrompt(params: Required<ExamGenerationParams>) {
  const standardsList = params.moeStandards.join(", ");
  const standardTarget = Math.max(1, Math.floor(params.questionCount / params.moeStandards.length));

  return `${getPrompt("exam.generation").template}
Return ONLY valid JSON with this shape:
{
  "title": string,
  "subject": string,
  "grade": number,
  "moeStandards": string[],
  "timeLimit": number,
  "passingScore": number,
  "questions": [
    {
      "prompt": string,
      "options": [string, string, string, string],
      "correctIndex": number,
      "explanation": string,
      "moeCode": string,
      "points": number
    }
  ]
}

Rules:
- Generate exactly ${params.questionCount} multiple-choice questions.
- Each question must have exactly 4 answer options.
- correctIndex must always be 0, 1, 2, or 3.
- Every question must align to one of these MOE standard codes: ${standardsList}.
- Distribute questions as evenly as possible across the provided MOE standards, targeting about ${standardTarget} questions per standard.
- Use Liberian classroom context throughout where appropriate.
- Questions must be suitable for Grade ${params.grade} ${params.subject}.
- explanations must briefly explain why the correct answer is correct.
- No markdown, no commentary, no extra keys.`;
}

async function requestExam(
  params: Required<ExamGenerationParams>
): Promise<GeneratedExamWithUsage> {
  const result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 3200,
    messages: [
      { role: "system", content: buildPrompt(params) },
      {
        role: "user",
        content: `Generate the exam titled "${params.title}" for Grade ${params.grade} ${params.subject} with ${params.questionCount} questions and a ${params.timeLimit}-minute time limit.`,
      },
    ],
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripFences(result.content.trim()));
  } catch {
    throw new Error(`Exam generator returned invalid JSON. First 200 chars: ${result.content.slice(0, 200)}`);
  }

  const exam = GeneratedExamSchema.parse(parsedJson);
  if (exam.questions.length !== params.questionCount) {
    throw new Error(`Exam generator returned ${exam.questions.length} questions, expected ${params.questionCount}.`);
  }

  for (const question of exam.questions) {
    if (!params.moeStandards.includes(question.moeCode)) {
      throw new Error(`Question moeCode ${question.moeCode} was not in the requested MOE standards.`);
    }
  }

  return {
    exam,
    estimatedCostUSD: result.estimatedCostUSD,
    tokensUsed: result.inputTokens + result.outputTokens,
  };
}

export async function generateExamWithUsage(
  params: ExamGenerationParams
): Promise<GeneratedExamWithUsage> {
  const normalized: Required<ExamGenerationParams> = {
    subject: params.subject,
    grade: params.grade,
    moeStandards: params.moeStandards,
    questionCount: params.questionCount ?? 20,
    timeLimit: params.timeLimit ?? 60,
    title: params.title ?? `${params.subject} Grade ${params.grade} Examination`,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await requestExam(normalized);
    } catch (error) {
      lastError = error;
      console.error(`[EXAM_GENERATOR] Attempt ${attempt} failed`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Exam generation failed after retry");
}

export async function generateExam(params: ExamGenerationParams): Promise<GeneratedExam> {
  const result = await generateExamWithUsage(params);
  return result.exam;
}
