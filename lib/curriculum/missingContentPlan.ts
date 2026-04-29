import { CURRICULUM_YEAR_TARGETS, type YearReadinessRow } from "@/lib/curriculum/yearPlan";

export type MissingLessonType = "CORE" | "REVIEW" | "LAB" | "ASSESSMENT" | "PROJECT";

export type MissingCurriculumPlanOptions = {
  grade?: number;
  subject?: string;
  limit?: number;
  batchSize?: number;
  completedContentIds?: Iterable<string>;
};

export type PlannedMissingLesson = {
  plannedContentId: string;
  grade: number;
  subject: string;
  weekNumber: number;
  dayNumber: number;
  lessonType: MissingLessonType;
  priority: "CRITICAL" | "PARTIAL" | "STRONG";
  reason: string;
};

export type MissingCurriculumGroupPlan = {
  grade: number;
  subject: string;
  currentLessons: number;
  mappedLessons: number;
  readinessPct: number;
  classification: YearReadinessRow["classification"];
  missingWeeks: number[];
  lessonsNeeded: number;
  plannedLessons: PlannedMissingLesson[];
};

export type MissingCurriculumPlan = {
  generatedContent: false;
  dryRunOnly: true;
  targetLessonsPerGroup: number;
  skippedStrongGroups: number;
  duplicatePlannedIds: string[];
  groups: MissingCurriculumGroupPlan[];
  lessons: PlannedMissingLesson[];
};

export type CostEstimateOptions = {
  inputTokensPerLesson?: number;
  outputTokensPerLesson?: number;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  secondsPerLesson?: number;
};

export type GenerationCostEstimate = {
  lessonCount: number;
  inputTokensPerLesson: number;
  outputTokensPerLesson: number;
  totalTokensPerLesson: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedMinutes: number;
};

export type DraftLessonSkeleton = {
  contentId: string;
  grade: number;
  subject: string;
  status: "DRAFT";
  lessonType: MissingLessonType;
  payload: {
    lessonContent: string;
    teacherGuide: string;
    studentWorksheet: string;
    homeworkSet: string;
    quiz: { questions: unknown[] };
    aiTutorContext: string;
    lab?: string;
    audioMetadata?: { status: "OPTIONAL"; requested: boolean };
    trustSignal: {
      routedCompletionRequired: true;
      promptRegistryRequired: true;
      promptKey: "curriculum.missingContent.v1";
      generatedBy: "phase6_missing_content_generation";
      reviewStatus: "NEEDS_REVIEW";
    };
  };
};

const DEFAULT_COST_OPTIONS = {
  inputTokensPerLesson: 2_500,
  outputTokensPerLesson: 3_500,
  inputCostPerMillionUsd: 0.15,
  outputCostPerMillionUsd: 0.6,
  secondsPerLesson: 75,
} as const;

function normalizeSubject(subject: string) {
  return subject.trim().toUpperCase();
}

function contentIdSubject(subject: string) {
  return normalizeSubject(subject).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function lessonTypeFor(subject: string, dayNumber: number, weekNumber: number): MissingLessonType {
  if (weekNumber % 6 === 0 && dayNumber === 4) return "REVIEW";
  if (normalizeSubject(subject) === "SCIENCE" && dayNumber === 4) return "LAB";
  return "CORE";
}

function missingSlot(existingMappedLessons: number, offset: number) {
  const sequence = existingMappedLessons + offset + 1;
  return {
    weekNumber: Math.min(
      CURRICULUM_YEAR_TARGETS.weeksPerGradeSubject,
      Math.floor((sequence - 1) / CURRICULUM_YEAR_TARGETS.lessonsPerWeek) + 1
    ),
    dayNumber: ((sequence - 1) % CURRICULUM_YEAR_TARGETS.lessonsPerWeek) + 1,
  };
}

function plannedContentId(input: {
  grade: number;
  subject: string;
  weekNumber: number;
  dayNumber: number;
  lessonType: MissingLessonType;
}) {
  return [
    "draft",
    "phase6",
    `g${input.grade}`,
    contentIdSubject(input.subject),
    `w${String(input.weekNumber).padStart(2, "0")}`,
    `d${input.dayNumber}`,
    input.lessonType.toLowerCase(),
  ].join("-");
}

function priorityRows(rows: YearReadinessRow[]) {
  return [...rows].sort((left, right) => {
    if (left.classification !== right.classification) {
      if (left.classification === "CRITICAL") return -1;
      if (right.classification === "CRITICAL") return 1;
    }
    return (
      left.readinessPct - right.readinessPct ||
      right.missingWeeks.length - left.missingWeeks.length ||
      left.grade - right.grade ||
      left.subject.localeCompare(right.subject)
    );
  });
}

export function buildMissingCurriculumPlan(
  rows: YearReadinessRow[],
  options: MissingCurriculumPlanOptions = {}
): MissingCurriculumPlan {
  const completedContentIds = new Set(options.completedContentIds ?? []);
  const lessons: PlannedMissingLesson[] = [];
  const groups: MissingCurriculumGroupPlan[] = [];
  const seen = new Set<string>();
  const duplicatePlannedIds: string[] = [];
  let skippedStrongGroups = 0;

  for (const row of priorityRows(rows)) {
    if (options.grade !== undefined && row.grade !== options.grade) continue;
    if (options.subject && normalizeSubject(row.subject) !== normalizeSubject(options.subject)) continue;

    const totalMappedLessons = row.totalMappedLessons ?? row.mappedLessons;
    const lessonsNeeded = Math.max(0, CURRICULUM_YEAR_TARGETS.lessonsPerGradeSubject - totalMappedLessons);

    if (lessonsNeeded === 0) {
      skippedStrongGroups += 1;
      continue;
    }

    const remainingCapacity = options.limit === undefined ? Number.POSITIVE_INFINITY : options.limit - lessons.length;
    if (remainingCapacity <= 0) break;

    const groupLessons: PlannedMissingLesson[] = [];
    const plannedForGroup = Math.min(lessonsNeeded, remainingCapacity);

    for (let index = 0; index < plannedForGroup; index += 1) {
      const { weekNumber, dayNumber } = missingSlot(totalMappedLessons, index);
      const lessonType = lessonTypeFor(row.subject, dayNumber, weekNumber);
      const id = plannedContentId({
        grade: row.grade,
        subject: row.subject,
        weekNumber,
        dayNumber,
        lessonType,
      });

      if (completedContentIds.has(id)) continue;
      if (seen.has(id)) {
        duplicatePlannedIds.push(id);
        continue;
      }
      seen.add(id);

      groupLessons.push({
        plannedContentId: id,
        grade: row.grade,
        subject: row.subject,
        weekNumber,
        dayNumber,
        lessonType,
        priority: row.classification,
        reason: `${row.classification}: ${row.mappedLessons}/${CURRICULUM_YEAR_TARGETS.lessonsPerGradeSubject} lessons mapped`,
      });
    }

    if (groupLessons.length > 0) {
      lessons.push(...groupLessons);
      groups.push({
        grade: row.grade,
        subject: row.subject,
        currentLessons: row.totalLessons,
        mappedLessons: totalMappedLessons,
        readinessPct: row.totalReadinessPct ?? row.readinessPct,
        classification: row.classification,
        missingWeeks: row.missingWeeks,
        lessonsNeeded,
        plannedLessons: groupLessons,
      });
    }
  }

  return {
    generatedContent: false,
    dryRunOnly: true,
    targetLessonsPerGroup: CURRICULUM_YEAR_TARGETS.lessonsPerGradeSubject,
    skippedStrongGroups,
    duplicatePlannedIds,
    groups,
    lessons,
  };
}

export function estimateMissingCurriculumCost(
  plan: Pick<MissingCurriculumPlan, "lessons">,
  options: CostEstimateOptions = {}
): GenerationCostEstimate {
  const merged = { ...DEFAULT_COST_OPTIONS, ...options };
  const lessonCount = plan.lessons.length;
  const totalInputTokens = lessonCount * merged.inputTokensPerLesson;
  const totalOutputTokens = lessonCount * merged.outputTokensPerLesson;
  const estimatedCostUsd =
    (totalInputTokens / 1_000_000) * merged.inputCostPerMillionUsd +
    (totalOutputTokens / 1_000_000) * merged.outputCostPerMillionUsd;

  return {
    lessonCount,
    inputTokensPerLesson: merged.inputTokensPerLesson,
    outputTokensPerLesson: merged.outputTokensPerLesson,
    totalTokensPerLesson: merged.inputTokensPerLesson + merged.outputTokensPerLesson,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    estimatedMinutes: Math.ceil((lessonCount * merged.secondsPerLesson) / 60),
  };
}

export function assertNoDuplicatePlannedLessons(plan: Pick<MissingCurriculumPlan, "duplicatePlannedIds" | "lessons">) {
  if (plan.duplicatePlannedIds.length > 0) {
    throw new Error(`Duplicate planned content IDs detected: ${plan.duplicatePlannedIds.join(", ")}`);
  }
  const unique = new Set(plan.lessons.map((lesson) => lesson.plannedContentId));
  if (unique.size !== plan.lessons.length) {
    throw new Error("Duplicate planned content IDs detected");
  }
}

export function assertGenerationApproved(input: { dryRun: boolean; approved?: boolean }) {
  if (!input.dryRun && !input.approved) {
    throw new Error("Human approval is required before missing curriculum content generation can run.");
  }
}

export function buildDraftLessonSkeleton(lesson: PlannedMissingLesson): DraftLessonSkeleton {
  const isScienceLab = normalizeSubject(lesson.subject) === "SCIENCE" && lesson.lessonType === "LAB";
  return {
    contentId: lesson.plannedContentId,
    grade: lesson.grade,
    subject: lesson.subject,
    status: "DRAFT",
    lessonType: lesson.lessonType,
    payload: {
      lessonContent: "",
      teacherGuide: "",
      studentWorksheet: "",
      homeworkSet: "",
      quiz: { questions: [] },
      aiTutorContext: "",
      ...(isScienceLab ? { lab: "" } : {}),
      audioMetadata: { status: "OPTIONAL", requested: false },
      trustSignal: {
        routedCompletionRequired: true,
        promptRegistryRequired: true,
        promptKey: "curriculum.missingContent.v1",
        generatedBy: "phase6_missing_content_generation",
        reviewStatus: "NEEDS_REVIEW",
      },
    },
  };
}

export function validateDraftLessonSkeleton(draft: DraftLessonSkeleton) {
  return Boolean(
    draft.contentId &&
      draft.status === "DRAFT" &&
      draft.payload &&
      "lessonContent" in draft.payload &&
      "teacherGuide" in draft.payload &&
      "studentWorksheet" in draft.payload &&
      "homeworkSet" in draft.payload &&
      "quiz" in draft.payload &&
      "aiTutorContext" in draft.payload &&
      draft.payload.trustSignal.routedCompletionRequired &&
      draft.payload.trustSignal.promptRegistryRequired &&
      draft.payload.trustSignal.reviewStatus === "NEEDS_REVIEW"
  );
}
