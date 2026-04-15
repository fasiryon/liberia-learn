import { buildLessonPromptExcerpt } from "@/lib/ai/lessonPromptContext";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/router";

export type TeacherLessonPlannerInput = {
  lessonTitle: string;
  lessonContent: string;
  subject: string;
  gradeLevel: number;
  classSize: number;
  timeAvailableMinutes: 30 | 45 | 60 | 90;
  specialConsiderations?: string | null;
};

type TeacherLessonPlannerUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
  contentId?: string | null;
};

export type TeacherLessonPlanStep = {
  segment: string;
  minutes: number;
  teacherMoves: string;
  studentExperience: string;
};

export type TeacherLessonPlannerResult = {
  learningObjectives: string[];
  warmUpActivity: string;
  teachingSequence: TeacherLessonPlanStep[];
  assessmentCheck: string;
  homeworkSuggestion: string;
  hadFallback: boolean;
  estimatedCostUSD: number;
  tokensUsed: number;
};

const systemPromptMetadata = getPromptMetadata("teacher.lessonPlanner.system");
const userPromptMetadata = getPromptMetadata("teacher.lessonPlanner.user");

const FALLBACK: TeacherLessonPlannerResult = {
  learningObjectives: [
    "State the lesson goal in simple language.",
    "Practice the core skill from the lesson with whole-class support.",
    "Check understanding before students leave class.",
  ],
  warmUpActivity:
    "Start with one quick review question and ask students to explain their thinking to a partner before sharing aloud.",
  teachingSequence: [
    {
      segment: "Model the core idea",
      minutes: 10,
      teacherMoves:
        "Explain the main lesson idea using the board and one familiar local example.",
      studentExperience:
        "Students listen, answer one check-for-understanding question, and repeat the key idea in their own words.",
    },
    {
      segment: "Guided practice",
      minutes: 15,
      teacherMoves:
        "Work through one or two examples with the whole class, pausing for choral responses and pair discussion.",
      studentExperience:
        "Students solve with support, compare answers with a partner, and explain where they were unsure.",
    },
    {
      segment: "Independent check",
      minutes: 10,
      teacherMoves:
        "Give one short task that shows whether students can apply the lesson on their own.",
      studentExperience:
        "Students attempt the task independently, then self-check or discuss answers briefly.",
    },
  ],
  assessmentCheck:
    "Use one exit-ticket question or one oral cold-call round to confirm the key idea before dismissal.",
  homeworkSuggestion:
    "Assign one short practice problem or summary question that students can complete without technology.",
  hadFallback: true,
  estimatedCostUSD: 0,
  tokensUsed: 0,
};

function buildSystemPrompt() {
  return buildPrompt("teacher.lessonPlanner.system");
}

function buildUserPrompt(input: TeacherLessonPlannerInput) {
  return buildPrompt("teacher.lessonPlanner.user", {
    lessonTitle: input.lessonTitle,
    subject: input.subject.replace(/_/g, " "),
    gradeLevel: input.gradeLevel,
    classSize: input.classSize,
    timeAvailableMinutes: input.timeAvailableMinutes,
    specialConsiderations:
      input.specialConsiderations?.trim() || "None provided.",
    lessonExcerpt: buildLessonPromptExcerpt(input.lessonContent),
  });
}

function parseAndValidate(raw: string): TeacherLessonPlannerResult | null {
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
  const learningObjectives = Array.isArray(value.learningObjectives)
    ? value.learningObjectives
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const teachingSequence = Array.isArray(value.teachingSequence)
    ? value.teachingSequence
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const item = entry as Record<string, unknown>;
          if (
            typeof item.segment !== "string" ||
            typeof item.minutes !== "number" ||
            typeof item.teacherMoves !== "string" ||
            typeof item.studentExperience !== "string"
          ) {
            return null;
          }

          return {
            segment: item.segment.trim(),
            minutes: Math.max(1, Math.round(item.minutes)),
            teacherMoves: item.teacherMoves.trim(),
            studentExperience: item.studentExperience.trim(),
          };
        })
        .filter((entry): entry is TeacherLessonPlanStep => Boolean(entry))
    : [];

  if (
    learningObjectives.length === 0 ||
    teachingSequence.length === 0 ||
    typeof value.warmUpActivity !== "string" ||
    !value.warmUpActivity.trim() ||
    typeof value.assessmentCheck !== "string" ||
    !value.assessmentCheck.trim() ||
    typeof value.homeworkSuggestion !== "string" ||
    !value.homeworkSuggestion.trim()
  ) {
    return null;
  }

  return {
    learningObjectives,
    warmUpActivity: value.warmUpActivity.trim(),
    teachingSequence,
    assessmentCheck: value.assessmentCheck.trim(),
    homeworkSuggestion: value.homeworkSuggestion.trim(),
    hadFallback: false,
    estimatedCostUSD: 0,
    tokensUsed: 0,
  };
}

export async function getTeacherLessonPlannerResponse(
  input: TeacherLessonPlannerInput,
  usageContext?: TeacherLessonPlannerUsageContext
): Promise<TeacherLessonPlannerResult> {
  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      maxTokens: 800,
      forceSmartTier: true,
      aiUsage: usageContext
        ? {
            route: usageContext.route,
            feature: "teacherAssist",
            schoolId: usageContext.schoolId ?? null,
            userId: usageContext.userId ?? null,
            contentId: usageContext.contentId ?? null,
            subject: input.subject,
            requestType: "lesson_planner",
            promptKey: `${systemPromptMetadata.key}+${userPromptMetadata.key}`,
            promptVersion: systemPromptMetadata.version,
            promptHash: systemPromptMetadata.hash,
            budgetFallbackContent: JSON.stringify({
              learningObjectives: FALLBACK.learningObjectives,
              warmUpActivity: FALLBACK.warmUpActivity,
              teachingSequence: FALLBACK.teachingSequence,
              assessmentCheck: FALLBACK.assessmentCheck,
              homeworkSuggestion: FALLBACK.homeworkSuggestion,
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
