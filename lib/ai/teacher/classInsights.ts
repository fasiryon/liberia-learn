import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/router";
import type { TeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";

export type TeacherClassInsightsResult = {
  recommendations: string[];
  strugglingLesson: string;
  reteachApproach: string;
  hadFallback: boolean;
  estimatedCostUSD: number;
  tokensUsed: number;
};

type TeacherClassInsightsUsageContext = {
  route: string;
  schoolId?: string | null;
  userId?: string | null;
  classId?: string | null;
};

const systemPromptMetadata = getPromptMetadata("teacher.classInsights.system");
const userPromptMetadata = getPromptMetadata("teacher.classInsights.user");

const FALLBACK: TeacherClassInsightsResult = {
  recommendations: [
    "Start the week by reteaching the hardest lesson with one worked example on the board and a quick pair explanation.",
    "Use a short oral check after each step so you can catch confusion before independent practice begins.",
    "Group confident learners with classmates who need support for one guided practice round before homework.",
  ],
  strugglingLesson: "Recent lesson quiz",
  reteachApproach:
    "Break the lesson into one small step at a time, model each step, then ask the whole class to respond before moving on.",
  hadFallback: true,
  estimatedCostUSD: 0,
  tokensUsed: 0,
};

function buildSystemPrompt() {
  return buildPrompt("teacher.classInsights.system");
}

function buildUserPrompt(input: TeacherClassPerformance) {
  return buildPrompt("teacher.classInsights.user", {
    className: input.className,
    subject: input.subject.replace(/_/g, " "),
    performanceJson: JSON.stringify(input),
  });
}

function parseAndValidate(raw: string): TeacherClassInsightsResult | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

    if (
      recommendations.length !== 3 ||
      typeof parsed.strugglingLesson !== "string" ||
      !parsed.strugglingLesson.trim() ||
      typeof parsed.reteachApproach !== "string" ||
      !parsed.reteachApproach.trim()
    ) {
      return null;
    }

    return {
      recommendations,
      strugglingLesson: parsed.strugglingLesson.trim(),
      reteachApproach: parsed.reteachApproach.trim(),
      hadFallback: false,
      estimatedCostUSD: 0,
      tokensUsed: 0,
    };
  } catch {
    return null;
  }
}

export async function getTeacherClassInsightsResponse(
  input: TeacherClassPerformance,
  usageContext?: TeacherClassInsightsUsageContext
): Promise<TeacherClassInsightsResult> {
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
            requestType: "class_insights",
            promptKey: `${systemPromptMetadata.key}+${userPromptMetadata.key}`,
            promptVersion: systemPromptMetadata.version,
            promptHash: systemPromptMetadata.hash,
            metadata: {
              classId: usageContext.classId ?? null,
              className: input.className,
            },
            budgetFallbackContent: JSON.stringify({
              recommendations: FALLBACK.recommendations,
              strugglingLesson: FALLBACK.strugglingLesson,
              reteachApproach: FALLBACK.reteachApproach,
            }),
          }
        : undefined,
    });

    const parsed = parseAndValidate(result.content);
    if (!parsed) {
      return { ...FALLBACK };
    }

    parsed.hadFallback = result.budgetBlocked === true;
    parsed.estimatedCostUSD = result.estimatedCostUSD;
    parsed.tokensUsed = result.inputTokens + result.outputTokens;
    return parsed;
  } catch {
    return { ...FALLBACK };
  }
}
