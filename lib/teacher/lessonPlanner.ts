import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { prisma } from "@/lib/db";

export type GeneratedWeeklyLessonPlan = {
  weekTitle: string;
  days: Array<{
    day: string;
    lessonTitle: string;
    contentId: string | null;
    objectives: string[];
    suggestedActivities: string[];
    estimatedMinutes: number;
  }>;
  teacherNotes: string;
};

export async function generateLessonPlan(input: {
  teacherId: string;
  classId: string;
  subject: string;
  gradeLevel: number;
  weekStartDate: string;
  existingContentIds?: string[];
}): Promise<GeneratedWeeklyLessonPlan> {
  const cls = await prisma.class.findFirst({
    where: { id: input.classId, teacherId: input.teacherId },
    select: { id: true, schoolId: true, teacherId: true, name: true },
  });
  if (!cls) {
    throw Object.assign(new Error("Class not found"), { status: 404 });
  }

  const explicitIds = input.existingContentIds?.filter(Boolean) ?? [];
  const lessons = await prisma.curriculumContent.findMany({
    where: {
      grade: input.gradeLevel,
      subject: input.subject,
      status: { in: ["APPROVED", "PUBLISHED"] },
      ...(explicitIds.length > 0 ? { contentId: { in: explicitIds } } : {}),
    },
    select: { contentId: true, title: true, payload: true },
    orderBy: [{ updatedAt: "desc" }, { contentId: "asc" }],
    take: 20,
  });

  if (lessons.length === 0) {
    return buildFallbackPlan(input, []);
  }

  const lessonList = lessons
    .map((lesson, index) => {
      const title = lesson.title ?? (lesson.payload as any)?.title ?? lesson.contentId;
      const objectives = extractObjectives(lesson.payload).slice(0, 3).join("; ");
      return `${index + 1}. ${title} [contentId: ${lesson.contentId}]${
        objectives ? ` Objectives: ${objectives}` : ""
      }`;
    })
    .join("\n");
  const systemMeta = getPromptMetadata("teacher.lessonPlan.v1");
  const system = buildPrompt("teacher.lessonPlan.v1", {
    GRADE: input.gradeLevel,
    SUBJECT: input.subject.replace(/_/g, " "),
  });
  const user = [
    `Class: ${cls.name}`,
    `Week start date: ${input.weekStartDate}`,
    "Available approved lessons:",
    lessonList,
    "",
    "Return only valid JSON with weekTitle, days, and teacherNotes.",
    "days must contain exactly five items for Monday through Friday.",
    "Each day must include day, lessonTitle, contentId, objectives, suggestedActivities, and estimatedMinutes.",
  ].join("\n");

  const result = await routedCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 1100,
    forceSmartTier: true,
    aiUsage: {
      route: "/api/teacher/lesson-plan",
      feature: "teacherAssist",
      schoolId: cls.schoolId,
      userId: input.teacherId,
      subject: input.subject,
      requestType: "teacher_weekly_lesson_plan",
      promptKey: systemMeta.key,
      promptVersion: systemMeta.version,
      promptHash: systemMeta.hash,
    },
  });

  const parsed = parsePlan(result.content, new Set(lessons.map((lesson) => lesson.contentId)));
  return normalizePlan(parsed ?? buildFallbackPlan(input, lessons), lessons);
}

function extractObjectives(payload: unknown): string[] {
  const value = (payload ?? {}) as Record<string, unknown>;
  const raw = value.objectives ?? value.learningObjectives;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string").map((item) => item.trim());
}

function parsePlan(raw: string, allowedIds: Set<string>): GeneratedWeeklyLessonPlan | null {
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.days)) return null;
    return {
      weekTitle: typeof parsed.weekTitle === "string" ? parsed.weekTitle.trim() : "Weekly lesson plan",
      days: parsed.days.map((day: any) => ({
        day: typeof day.day === "string" ? day.day.trim() : "",
        lessonTitle: typeof day.lessonTitle === "string" ? day.lessonTitle.trim() : "",
        contentId:
          typeof day.contentId === "string" && allowedIds.has(day.contentId) ? day.contentId : null,
        objectives: toStringArray(day.objectives).slice(0, 4),
        suggestedActivities: toStringArray(day.suggestedActivities).slice(0, 4),
        estimatedMinutes:
          typeof day.estimatedMinutes === "number"
            ? Math.max(10, Math.min(120, Math.round(day.estimatedMinutes)))
            : 45,
      })),
      teacherNotes:
        typeof parsed.teacherNotes === "string"
          ? parsed.teacherNotes.trim()
          : "Review and adapt this plan before teaching.",
    };
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizePlan(
  plan: GeneratedWeeklyLessonPlan,
  lessons: Array<{ contentId: string; title: string | null; payload: unknown }>
): GeneratedWeeklyLessonPlan {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const byId = new Map(lessons.map((lesson) => [lesson.contentId, lesson]));
  return {
    weekTitle: plan.weekTitle || "Weekly lesson plan",
    days: days.map((day, index) => {
      const source: Partial<GeneratedWeeklyLessonPlan["days"][number]> = plan.days[index] ?? {};
      const lesson = source.contentId
        ? byId.get(source.contentId)
        : lessons.length > 0
          ? lessons[index % lessons.length]
          : null;
      const objectives = source.objectives?.length ? source.objectives : extractObjectives(lesson?.payload);
      return {
        day,
        lessonTitle:
          source.lessonTitle ||
          lesson?.title ||
          (lesson?.payload as any)?.title ||
          "Review and practice",
        contentId: lesson?.contentId ?? null,
        objectives: objectives.slice(0, 3),
        suggestedActivities: source.suggestedActivities?.length
          ? source.suggestedActivities
          : ["Review prior knowledge", "Model the key idea", "Use guided practice", "Close with an exit check"],
        estimatedMinutes: source.estimatedMinutes ?? 45,
      };
    }),
    teacherNotes: plan.teacherNotes || "Teacher should review and adapt timing for class needs.",
  };
}

function buildFallbackPlan(
  input: { subject: string; weekStartDate: string },
  lessons: Array<{ contentId: string; title: string | null; payload: unknown }>
): GeneratedWeeklyLessonPlan {
  return normalizePlan(
    {
      weekTitle: `${input.subject.replace(/_/g, " ")} week of ${input.weekStartDate}`,
      days: [],
      teacherNotes:
        lessons.length === 0
          ? "No approved lessons were found for this grade and subject. Add or approve curriculum content before scheduling a full weekly plan."
          : "AI planning was unavailable, so this draft uses the approved lesson list directly.",
    },
    lessons
  );
}
