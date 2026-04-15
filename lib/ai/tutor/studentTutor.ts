/**
 * lib/ai/tutor/studentTutor.ts
 *
 * Lesson-grounded student tutor responses for LiberiaLearn.
 * No PII is placed in prompts or telemetry metadata.
 */

import { buildLessonPromptExcerpt } from "@/lib/ai/lessonPromptContext";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { retrieveRelevantLessons, type RelevantLesson } from "@/lib/ai/rag/retrievalService";
import { routedCompletion } from "@/lib/ai/router";
import { prisma } from "@/lib/db";
import { isRagTutorEnabled } from "@/lib/serverFlags";

export type TutorRequestType =
  | "explain"
  | "practice"
  | "step_by_step"
  | "reinforce";

export type GuidanceLevel = "light" | "moderate" | "intensive";

export type StudentTutorInput = {
  subject: string;
  strandKey: string;
  gradeLevel?: number;
  lessonTitle: string;
  lessonContent: string;
  studentQuestion: string;
  masteryState: string;
  proficiencyState: string;
  gradeBand: string;
  requestType: TutorRequestType;
};

type StudentTutorUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
  lessonId?: string | null;
  contentId?: string | null;
};

export type StudentTutorResult = {
  explanation: string;
  practicePrompt?: string;
  guidanceLevel: GuidanceLevel;
  confidenceScore: number;
  hadFallback: boolean;
  estimatedCostUSD: number;
  tokensUsed: number;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
  tokensUsed: 0,
};

const systemPromptMetadata = getPromptMetadata("student.tutor.system");
const userPromptMetadata = getPromptMetadata("student.tutor.user");

function describeGradeContext(input: StudentTutorInput): string {
  if (typeof input.gradeLevel === "number" && Number.isFinite(input.gradeLevel)) {
    return `Grade ${input.gradeLevel} (${input.gradeBand.replace(/_/g, " ")})`;
  }

  return input.gradeBand.replace(/_/g, " ");
}

function buildSystemPrompt(input: StudentTutorInput): string {
  return buildPrompt("student.tutor.system", {
    persona:
      "an educational AI tutor for LiberiaLearn, a platform for students in Liberia.",
    subjectContext: input.subject.replace(/_/g, " "),
    gradeContext: describeGradeContext(input),
    strandContext: input.strandKey.replace(/_/g, " "),
    lessonTitle: input.lessonTitle,
    lessonExcerpt: buildLessonPromptExcerpt(input.lessonContent),
    contextBlock: "",
    instructionBlock: [
      "Guide students to understand concepts and never provide direct assessment answers.",
      "Use simple, encouraging language and keep the explanation concise and grade-appropriate.",
      "Where examples help, prefer familiar Liberian daily-life situations such as markets, transport, family routines, farming, school, or community work.",
      "",
      "You MUST respond with valid JSON only. No prose outside the JSON object.",
      "",
      "Response schema:",
      "{",
      '  "explanation": "<2-3 sentence concept explanation grounded in the lesson>",',
      '  "practicePrompt": "<one short practice question, or null>",',
      '  "guidanceLevel": "light" | "moderate" | "intensive",',
      '  "confidenceScore": <0.0-1.0>',
      "}",
    ].join("\n"),
  });
}

function buildChatSystemPrompt(grade: number | string, subjects: string): string {
  return buildPrompt("student.tutor.system", {
    persona:
      "a helpful educational tutor for LiberiaLearn, an AI-powered learning platform for students in Liberia.",
    subjectContext: subjects,
    gradeContext: `Grade ${grade}`,
    strandContext: "general learning support",
    lessonTitle: "General study support",
    lessonExcerpt: "No single lesson excerpt was supplied for this chat request.",
    contextBlock: `Student context:
- Grade level: ${grade}
- Subject(s): ${subjects}
- Learning environment: low-bandwidth classroom in Liberia`,
    instructionBlock: `Your role:
- Help with homework and classwork; guide the student, do not simply give answers.
- Use simple, encouraging language appropriate for the student's grade level.
- Keep responses concise (2-3 paragraphs max).
- Relate concepts to everyday Liberian life and contexts where helpful.
- If you are unsure, say so honestly.
- Always be patient, supportive, and culturally aware.`,
  });
}

function buildRagSystemPrompt(
  lessons: RelevantLesson[],
  grade: number | string
): string {
  const context =
    "Relevant lesson content from your curriculum:\n" +
    lessons
      .map((lesson) => `--- ${lesson.title} ---\n${lesson.content}`)
      .join("\n\n");

  return buildPrompt("student.tutor.system", {
    persona: "a helpful tutor for a Liberian student.",
    subjectContext: lessons[0]?.subject ?? "current lesson",
    gradeContext: `Grade ${grade}`,
    strandContext: "curriculum-aligned support",
    lessonTitle: lessons[0]?.title ?? "Curriculum support",
    lessonExcerpt: buildLessonPromptExcerpt(context),
    contextBlock: context,
    instructionBlock: `Answer based on the following lesson content from the student's curriculum. If the answer is not in the lessons, say so and provide general guidance. Always be encouraging and clear. Use simple language appropriate for the student's grade level (${grade}).`,
  });
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

  return buildPrompt("student.tutor.user", {
    requestLabel: requestLabels[input.requestType],
    masteryState: input.masteryState,
    proficiencyState: input.proficiencyState,
    gradeBand: input.gradeBand,
    studentQuestion: input.studentQuestion.trim() || requestLabels[input.requestType],
  });
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

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const value = parsed as Record<string, unknown>;
  if (typeof value.explanation !== "string" || !value.explanation.trim()) {
    return null;
  }
  if (typeof value.confidenceScore !== "number") {
    return null;
  }

  const guidanceLevel = VALID_GUIDANCE_LEVELS.includes(
    value.guidanceLevel as GuidanceLevel
  )
    ? (value.guidanceLevel as GuidanceLevel)
    : null;
  if (!guidanceLevel) {
    return null;
  }

  return {
    explanation: value.explanation.trim(),
    practicePrompt:
      typeof value.practicePrompt === "string" && value.practicePrompt.trim()
        ? value.practicePrompt.trim()
        : undefined,
    guidanceLevel,
    confidenceScore: Math.max(0, Math.min(1, value.confidenceScore)),
    hadFallback: false,
    estimatedCostUSD: 0,
    tokensUsed: 0,
  };
}

async function loadStudentChatContext(studentId: string): Promise<{
  grade: number | string;
  subjects: string;
}> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      currentGrade: true,
      enrollments: {
        select: {
          Class: {
            select: {
              subject: true,
            },
          },
        },
      },
    },
  });

  const subjects =
    Array.from(
      new Set(
        student?.enrollments
          .map((enrollment) => enrollment.Class.subject)
          .filter(Boolean) ?? []
      )
    ).join(", ") || "General";

  return {
    grade: student?.currentGrade ?? "unknown",
    subjects,
  };
}

export function isValidRequestType(v: unknown): v is TutorRequestType {
  return VALID_REQUEST_TYPES.includes(v as TutorRequestType);
}

export async function getStudentTutorResponse(
  input: StudentTutorInput,
  usageContext?: StudentTutorUsageContext
): Promise<StudentTutorResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt(input) },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 400,
      forceSmartTier: true,
      aiUsage: usageContext
        ? {
            route: usageContext.route,
            feature: "tutor",
            schoolId: usageContext.schoolId ?? null,
            userId: usageContext.userId ?? null,
            lessonId: usageContext.lessonId ?? null,
            contentId: usageContext.contentId ?? null,
            subject: input.subject,
            strandKey: input.strandKey,
            requestType: input.requestType,
            promptKey: `${systemPromptMetadata.key}+${userPromptMetadata.key}`,
            promptVersion: systemPromptMetadata.version,
            promptHash: systemPromptMetadata.hash,
            budgetFallbackContent: JSON.stringify({
              explanation: FALLBACK.explanation,
              practicePrompt: FALLBACK.practicePrompt ?? null,
              guidanceLevel: FALLBACK.guidanceLevel,
              confidenceScore: FALLBACK.confidenceScore,
            }),
          }
        : undefined,
    });

    const validated = parseAndValidate(result.content);
    if (!validated) {
      return { ...FALLBACK };
    }

    validated.hadFallback = result.budgetBlocked === true;
    validated.estimatedCostUSD = result.estimatedCostUSD;
    validated.tokensUsed = result.inputTokens + result.outputTokens;
    return validated;
  } catch {
    return { ...FALLBACK };
  }
}

export async function answerStudentQuestion(
  studentId: string,
  question: string,
  conversationHistory: Message[]
): Promise<string> {
  const { grade, subjects } = await loadStudentChatContext(studentId);

  let systemPrompt = buildChatSystemPrompt(grade, subjects);
  if (isRagTutorEnabled()) {
    const lessons = await retrieveRelevantLessons(question, studentId);
    if (lessons.length > 0) {
      systemPrompt = buildRagSystemPrompt(lessons, grade);
    }
  }

  const result = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: question },
    ],
    maxTokens: 512,
    forceSmartTier: true,
  });

  return result.content;
}
