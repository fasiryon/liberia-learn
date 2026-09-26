import type { DraftLesson } from "./types";
import { UNIT1_LESSONS } from "./unit1";
import { UNIT2_LESSONS } from "./unit2";
import { UNIT3_LESSONS } from "./unit3";
import { UNIT4_LESSONS } from "./unit4";
import { UNIT5_LESSONS } from "./unit5";
import { UNIT6_LESSONS } from "./unit6";

/** All Grade 4 Math draft lessons (DRAFT_UNREVIEWED), one per MOE objective except p3-obj4. */
export const GRADE4_MATH_DRAFT_LESSONS: readonly DraftLesson[] = Object.freeze([
  ...UNIT1_LESSONS, ...UNIT2_LESSONS, ...UNIT3_LESSONS, ...UNIT4_LESSONS, ...UNIT5_LESSONS, ...UNIT6_LESSONS,
]);

export type { DraftLesson, DraftLessonPayload, Mcq, Problem } from "./types";
