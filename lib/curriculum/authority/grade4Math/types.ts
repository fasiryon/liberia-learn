/**
 * Grade 4 Math draft lesson authority (V1).
 *
 * One lesson per MOE Grade 4 Math objective, authored against the template
 * cell lib/learning-authority/cells/grade4Math.ts. Drafts are repository
 * data only: DRAFT_UNREVIEWED, never published, never MOE-approved. A draft
 * becomes governed only after human review and publication through the
 * canonical curriculum workflow (see scripts/author-grade4-fractions-authority.ts).
 *
 * Example data (population, prices, distances) is illustrative and says so;
 * it is not presented as real Liberian statistics.
 */

export type Mcq = Readonly<{ prompt: string; options: readonly string[]; answer: string }>;
export type Problem = Readonly<{ prompt: string; answer: string }>;

export type DraftLessonPayload = Readonly<{
  title: string;
  body: string;
  objectives: readonly string[];
  /** Classwork: teacher-led and group activities done in class. */
  activities: readonly string[];
  /** Independent practice with answers. */
  practice: readonly Problem[];
  /** Homework with answers (answers are teacher-facing). */
  homework: readonly Problem[];
  /** Short end-of-lesson quiz. */
  quiz: readonly Mcq[];
  /** Prerequisite check given before the lesson. */
  diagnosticCheck: Mcq;
  /** Exit assessment for this objective. */
  assessment: Mcq;
  teacherNotes: string;
  materials: readonly string[];
  /** What the lesson looks like with no device or connection. */
  offline: string;
  durationMins: number;
}>;

export type DraftLesson = Readonly<{
  contentId: string;
  version: string;
  title: string;
  grade: 4;
  subject: "MATH";
  contentType: "lesson";
  moeObjectiveId: string;
  unitId: string;
  authority: Readonly<{
    state: "DRAFT_UNREVIEWED";
    author: string;
    moeApprovalState: "NOT_CLAIMED";
  }>;
  payload: DraftLessonPayload;
}>;

export const DRAFT_AUTHOR = "LiberiaLearn curriculum drafting (AI-assisted); requires human review";

export function draftLesson(input: {
  slug: string;
  moeObjectiveId: string;
  unitId: string;
  payload: Omit<DraftLessonPayload, "durationMins"> & { durationMins?: number };
}): DraftLesson {
  return Object.freeze({
    contentId: `ll-g4-math-${input.slug}-2026.1`,
    version: "0.1.0",
    title: input.payload.title,
    grade: 4,
    subject: "MATH",
    contentType: "lesson",
    moeObjectiveId: input.moeObjectiveId,
    unitId: input.unitId,
    authority: Object.freeze({ state: "DRAFT_UNREVIEWED", author: DRAFT_AUTHOR, moeApprovalState: "NOT_CLAIMED" }),
    payload: Object.freeze({ durationMins: 45, ...input.payload }),
  });
}

export const mcq = (prompt: string, options: string[], answer: string): Mcq => ({ prompt, options, answer });
export const p = (prompt: string, answer: string): Problem => ({ prompt, answer });

export const T = {
  m1: "moe-math-g4-s1-p1-numeration-addition-and-subtraction",
  m2: "moe-math-g4-s1-p2-multiplication-and-division-of-whole-numbers",
  m3: "moe-math-g4-s1-p3-number-theory-and-fraction",
  m4: "moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli",
  m5: "moe-math-g4-s2-p5-measurement",
  m6: "moe-math-g4-s2-p6-geometry-and-statistics",
} as const;
export const U = {
  m1: "g4-math-u1-numeration-add-subtract",
  m2: "g4-math-u2-multiply-divide-whole",
  m3: "g4-math-u3-number-theory-fractions",
  m4: "g4-math-u4-two-digit-decimals",
  m5: "g4-math-u5-measurement",
  m6: "g4-math-u6-geometry-statistics",
} as const;
export const objectiveId = (unit: keyof typeof T, n: number) => `${T[unit]}-obj${n}`;
