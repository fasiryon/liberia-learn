/**
 * lib/ai/tutor/studentTutor.ts
 *
 * Lesson-grounded student tutor responses for LiberiaLearn.
 * No PII is placed in prompts or telemetry metadata.
 */

import { buildLessonPromptExcerpt } from "@/lib/ai/lessonPromptContext";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/router";
import { moderateText } from "@/lib/agents/moderation";

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

export function isValidRequestType(v: unknown): v is TutorRequestType {
  return VALID_REQUEST_TYPES.includes(v as TutorRequestType);
}

export async function getStudentTutorResponse(
  input: StudentTutorInput,
  usageContext?: StudentTutorUsageContext
): Promise<StudentTutorResult> {
  try {
    const inputVerdict = await moderateText(input.studentQuestion, "input", {
      audience: "minor",
    });
    if (inputVerdict.verdict !== "SAFE") {
      return { ...FALLBACK };
    }

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

    const outputVerdict = await moderateText(
      [validated.explanation, validated.practicePrompt].filter(Boolean).join("\n"),
      "output",
      { audience: "minor" }
    );
    if (outputVerdict.verdict !== "SAFE") {
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
