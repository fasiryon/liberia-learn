/**
 * lib/student/unitSequence.ts — Phase 2, Deliverable 1 (Unit Map)
 *
 * Pure helpers that turn the lesson-sequence data the platform already has
 * (CurriculumContent.unitId + orderInUnit, StudentProgress, LessonPrerequisite)
 * into a student-facing "this lesson is N of M in its unit" view.
 *
 * No data is invented here. Lessons with no unitId never reach this code, and
 * units with no CurriculumUnit row get a name synthesised from lesson titles.
 */

export type UnitLessonStatus = "completed" | "current" | "upcoming";

export type UnitLessonNode = {
  contentId: string;
  title: string;
  orderInUnit: number;
  lessonType: string | null;
  status: UnitLessonStatus;
  scheduledWorkId: string | null;
  locked: boolean;
  href: string;
};

export type UnitSequence = {
  unitId: string;
  unitName: string;
  subject: string;
  grade: number;
  lessons: UnitLessonNode[];
  completedCount: number;
  totalCount: number;
  completionPct: number;
};

type LessonInput = {
  contentId: string;
  title: string | null;
  orderInUnit: number | null;
  lessonType: string | null;
  grade: number;
  subject: string;
};

type ProgressEntry = { scheduledWorkId: string | null; completed: boolean };

/**
 * Human-readable unit name. Preference order:
 *  1. an explicit CurriculumUnit.name (when a row exists)
 *  2. the shared title prefix before a colon (e.g. "Geometry: Foundations",
 *     "Geometry: Assessment" → "Geometry")
 *  3. a humanised version of the unitId slug, dropping leading subject/grade/
 *     number tokens (e.g. "math-g8-5-geometry-and-spatial-thinking" →
 *     "Geometry And Spatial Thinking")
 */
export function deriveUnitName(
  unitId: string,
  curriculumUnitName: string | null,
  lessonTitles: string[]
): string {
  if (curriculumUnitName && curriculumUnitName.trim().length > 0) {
    return curriculumUnitName.trim();
  }

  const prefixes = lessonTitles
    .map((t) => (t.includes(":") ? t.slice(0, t.indexOf(":")).trim() : ""))
    .filter((p) => p.length > 0);
  if (prefixes.length >= 2 && prefixes.every((p) => p === prefixes[0])) {
    return prefixes[0];
  }

  return humaniseSlug(unitId);
}

function humaniseSlug(slug: string): string {
  const tokens = slug.split("-").filter(Boolean);
  // Drop a leading subject token, a gradeband token (g8, grade8), and a bare
  // number token — these are organisational, not part of the unit's name.
  const cleaned: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLeading = cleaned.length === 0;
    if (isLeading && /^(g\d+|grade\d*|\d+)$/i.test(token)) continue;
    if (isLeading && i === 0 && /^[a-z_]+$/i.test(token) && /^(math|science|english|literacy|civics|history|biology|chemistry|physics|geography|economics|social|computer|engineering)$/i.test(token)) {
      continue;
    }
    cleaned.push(token);
  }
  const finalTokens = cleaned.length > 0 ? cleaned : tokens;
  return finalTokens
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

export function buildUnitSequence(input: {
  unitId: string;
  curriculumUnitName: string | null;
  currentContentId: string | null;
  lessons: LessonInput[];
  progressByContentId: Map<string, ProgressEntry>;
  /** contentId → required-strength prerequisite contentIds (within this unit). */
  requiredPrereqsByContentId?: Map<string, string[]>;
}): UnitSequence {
  const ordered = [...input.lessons].sort(
    (a, b) => (a.orderInUnit ?? 0) - (b.orderInUnit ?? 0)
  );

  const completedSet = new Set(
    ordered
      .filter((l) => input.progressByContentId.get(l.contentId)?.completed)
      .map((l) => l.contentId)
  );

  // Resolve which lesson is "current": the viewed lesson if it is not already
  // completed, otherwise the first incomplete lesson in order.
  let currentContentId = input.currentContentId;
  if (!currentContentId || completedSet.has(currentContentId)) {
    currentContentId = ordered.find((l) => !completedSet.has(l.contentId))?.contentId ?? null;
  }

  const requiredPrereqs = input.requiredPrereqsByContentId ?? new Map<string, string[]>();

  const lessons: UnitLessonNode[] = ordered.map((l) => {
    const progress = input.progressByContentId.get(l.contentId) ?? null;
    const completed = completedSet.has(l.contentId);
    const status: UnitLessonStatus = completed
      ? "completed"
      : l.contentId === currentContentId
        ? "current"
        : "upcoming";

    const prereqs = requiredPrereqs.get(l.contentId) ?? [];
    const locked =
      !completed &&
      l.contentId !== currentContentId &&
      prereqs.some((p) => !completedSet.has(p));

    const scheduledWorkId = progress?.scheduledWorkId ?? null;
    const href = scheduledWorkId
      ? `/student/lessons/${scheduledWorkId}`
      : `/student/lesson/${l.contentId}`;

    return {
      contentId: l.contentId,
      title: l.title ?? l.contentId,
      orderInUnit: l.orderInUnit ?? 0,
      lessonType: l.lessonType,
      status,
      scheduledWorkId,
      locked,
      href,
    };
  });

  const totalCount = lessons.length;
  const completedCount = completedSet.size;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const first = ordered[0];
  return {
    unitId: input.unitId,
    unitName: deriveUnitName(
      input.unitId,
      input.curriculumUnitName,
      ordered.map((l) => l.title ?? "").filter(Boolean)
    ),
    subject: first?.subject ?? "",
    grade: first?.grade ?? 0,
    lessons,
    completedCount,
    totalCount,
    completionPct,
  };
}
